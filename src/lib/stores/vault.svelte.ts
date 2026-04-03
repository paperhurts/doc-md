import {
  getCurrentVault,
  setCurrentVault,
  listFiles,
  readFile,
  writeFile,
  deleteFile,
  renameFile,
  startWatching,
} from "../services/tauri";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { linkIndex } from "../services/indexer";
import {
  getDailyNotePath,
  applyTemplate,
  getTemplateVars,
  DAILY_NOTE_TEMPLATE,
  NEW_NOTE_TEMPLATE,
} from "../services/templates";
import { createDirectory } from "../services/tauri";
import { searchIndex } from "../services/search";
import type { VaultEntry, Backlink, NoteName } from "../types";

interface VaultConfig {
  path: string;
  name: string;
}

interface OpenFile {
  path: string;
  name: string;
  content: string;
  dirty: boolean;
}

class VaultStore {
  vault = $state<VaultConfig | null>(null);
  tree = $state<VaultEntry[]>([]);
  openFiles = $state<OpenFile[]>([]);
  activeFilePath = $state<string | null>(null);
  backlinks = $state<Backlink[]>([]);
  noteNames = $state<NoteName[]>([]);
  error = $state<string | null>(null);

  private fsUnlisten: UnlistenFn | null = null;
  private fsDebounce: ReturnType<typeof setTimeout> | undefined;
  private fsPendingPaths = new Set<string>();
  private fsPendingKinds = new Set<string>();

  get activeFile(): OpenFile | undefined {
    return this.openFiles.find((f) => f.path === this.activeFilePath);
  }

  setActiveFile(path: string) {
    if (this.openFiles.some((f) => f.path === path)) {
      this.activeFilePath = path;
      this.refreshBacklinks();
    }
  }

  get activeFileName(): string {
    if (!this.activeFilePath) return "";
    const parts = this.activeFilePath.replace(/\\/g, "/").split("/");
    const filename = parts[parts.length - 1] ?? "";
    return filename.replace(/\.(md|markdown)$/, "");
  }

  async init() {
    try {
      const saved = await getCurrentVault();
      console.log("[vault] init, saved:", saved);
      if (saved) {
        this.vault = saved;
        await this.refreshTree();
        await this.buildIndex();
        await this.startFileWatcher();
      }
    } catch (e) {
      console.error("[vault] init error:", e);
    }
  }

  async openVault(path: string) {
    try {
      const config = await setCurrentVault(path);
      this.vault = config;
      this.openFiles = [];
      this.activeFilePath = null;
      await this.refreshTree();
      await this.buildIndex();
      await this.startFileWatcher();
    } catch (e) {
      console.error("Failed to open vault:", e);
    }
  }

  async deleteNote(path: string) {
    try {
      await deleteFile(path);
      // Close the file if it's open
      this.openFiles = this.openFiles.filter((f) => f.path !== path);
      if (this.activeFilePath === path) {
        const lastOpen = this.openFiles[this.openFiles.length - 1];
        this.activeFilePath = lastOpen?.path ?? null;
      }
      searchIndex.removeFile(path);
      await this.refreshTree();
      await this.buildIndex();
    } catch (e) {
      console.error("Failed to delete note:", e);
    }
  }

  async renameNote(oldPath: string, newPath: string) {
    try {
      await renameFile(oldPath, newPath);
      // Update open file reference
      const openFile = this.openFiles.find((f) => f.path === oldPath);
      if (openFile) {
        const parts = newPath.replace(/\\/g, "/").split("/");
        openFile.path = newPath;
        openFile.name = parts[parts.length - 1] ?? openFile.name;
      }
      if (this.activeFilePath === oldPath) {
        this.activeFilePath = newPath;
      }
      await this.refreshTree();
      await this.buildIndex();
    } catch (e) {
      console.error("Failed to rename note:", e);
    }
  }

  private async startFileWatcher() {
    // Stop any existing watcher listener
    if (this.fsUnlisten) {
      this.fsUnlisten();
      this.fsUnlisten = null;
    }
    if (!this.vault) return;

    try {
      await startWatching(this.vault.path);

      this.fsUnlisten = await listen<{ kind: string; paths: string[] }>(
        "fs-change",
        (event) => {
          this.handleFsChange(event.payload);
        },
      );
      console.log("[vault] file watcher started");
    } catch (e) {
      console.error("[vault] failed to start watcher:", e);
    }
  }

  private handleFsChange(payload: { kind: string; paths: string[] }) {
    // Accumulate all events during debounce window
    for (const p of payload.paths) {
      this.fsPendingPaths.add(p);
    }
    this.fsPendingKinds.add(payload.kind);

    clearTimeout(this.fsDebounce);
    this.fsDebounce = setTimeout(() => this.processFsChanges(), 500);
  }

  private async processFsChanges() {
    const allPaths = [...this.fsPendingPaths];
    const kinds = [...this.fsPendingKinds];
    this.fsPendingPaths.clear();
    this.fsPendingKinds.clear();

    if (allPaths.length === 0) return;

    const mdPaths = allPaths.filter(
      (p) => p.endsWith(".md") || p.endsWith(".markdown"),
    );

    console.log("[vault] fs-change:", kinds.join(","), allPaths.length, "paths,", mdPaths.length, "markdown");

    // Always refresh tree — folder creates/renames/deletes matter too
    await this.refreshTree();

    // Only re-index markdown files
    const paths = mdPaths;

    // Re-index changed files
    const hasRemove = kinds.includes("remove");
    for (const filePath of paths) {
      try {
        const content = await readFile(filePath);
        await linkIndex.indexFile(filePath, content);
        const parts = filePath.replace(/\\/g, "/").split("/");
        searchIndex.updateFile(filePath, parts[parts.length - 1] ?? "", content);

        // Update open file content if changed externally
        const openFile = this.openFiles.find((f) => f.path === filePath);
        if (openFile && !openFile.dirty) {
          openFile.content = content;
        }
      } catch {
        // File was likely deleted — remove from search index
        searchIndex.removeFile(filePath);
      }
    }

    this.noteNames = linkIndex.getAllNoteNames();
    this.refreshBacklinks();
  }

  async createNote(name: string, template?: string) {
    if (!this.vault) return;
    const fileName = name.endsWith(".md") ? name : `${name}.md`;
    const sep = this.vault.path.includes("\\") ? "\\" : "/";
    const filePath = `${this.vault.path}${sep}${fileName}`;
    const title = name.replace(/\.md$/, "");
    const content = template
      ? applyTemplate(template, getTemplateVars(title))
      : applyTemplate(NEW_NOTE_TEMPLATE, getTemplateVars(title));
    try {
      await writeFile(filePath, content);
      await this.refreshTree();
      await this.openFile(filePath, fileName);
    } catch (e) {
      console.error("Failed to create note:", e);
    }
  }

  async openDailyNote() {
    if (!this.vault) return;
    const { filePath, fileName, title } = getDailyNotePath(this.vault.path);
    try {
      // Try to open existing daily note
      const content = await readFile(filePath).catch(() => null);
      if (content !== null) {
        await this.openFile(filePath, fileName);
        return;
      }
      // Create with daily note template
      const sep = this.vault.path.includes("\\") ? "\\" : "/";
      const dailyDir = `${this.vault.path}${sep}daily`;
      await createDirectory(dailyDir);
      const newContent = applyTemplate(DAILY_NOTE_TEMPLATE, getTemplateVars(title));
      await writeFile(filePath, newContent);
      await this.refreshTree();
      await this.openFile(filePath, fileName);
    } catch (e) {
      console.error("Failed to open daily note:", e);
    }
  }

  /** List template files from _templates/ folder in the vault. */
  async getTemplates(): Promise<{ name: string; path: string }[]> {
    if (!this.vault) return [];
    const sep = this.vault.path.includes("\\") ? "\\" : "/";
    const templateDir = `${this.vault.path}${sep}_templates`;
    try {
      const entries = await listFiles(templateDir);
      return entries
        .filter((e) => !e.is_dir && (e.name.endsWith(".md") || e.name.endsWith(".markdown")))
        .map((e) => ({ name: e.name.replace(/\.(md|markdown)$/, ""), path: e.path }));
    } catch {
      return []; // No _templates folder
    }
  }

  /** Create a new note from a template file. */
  async createFromTemplate(templatePath: string, noteName: string) {
    if (!this.vault) return;
    try {
      const templateContent = await readFile(templatePath);
      await this.createNote(noteName, templateContent);
    } catch (e) {
      console.error("Failed to create from template:", e);
    }
  }

  async refreshTree() {
    if (!this.vault) return;
    try {
      this.tree = await listFiles(this.vault.path);
      console.log("[vault] tree loaded:", this.tree.length, "entries");
    } catch (e) {
      console.error("[vault] refreshTree error:", e);
    }
  }

  async buildIndex() {
    if (!this.vault) return;
    try {
      // Build link index from the file tree (reads all files via Rust IPC)
      const result = await linkIndex.indexVault(this.tree);
      console.log("[vault] indexed:", result);

      this.noteNames = linkIndex.getAllNoteNames();

      // Build search index from the cached content
      const files: { path: string; name: string; content: string }[] = [];
      for (const [path, content] of linkIndex["contentCache"]) {
        const parts = path.replace(/\\/g, "/").split("/");
        files.push({ path, name: parts[parts.length - 1] ?? "", content });
      }
      searchIndex.buildIndex(files);
      console.log("[vault] search index built:", files.length, "files");
    } catch (e) {
      console.error("[vault] buildIndex error:", e);
      this.error = "Failed to build index. Search and backlinks may be unavailable.";
    }
  }

  async openFile(path: string, name: string) {
    const existing = this.openFiles.find((f) => f.path === path);
    if (existing) {
      this.activeFilePath = path;
      this.refreshBacklinks();
      return;
    }

    const content = await readFile(path);
    this.openFiles.push({ path, name, content, dirty: false });
    this.activeFilePath = path;
    this.refreshBacklinks();
  }

  async navigateToNote(noteName: string) {
    const match = this.noteNames.find(
      (n) => n.name === noteName.toLowerCase(),
    );
    if (match) {
      const parts = match.path.replace(/\\/g, "/").split("/");
      const filename = parts[parts.length - 1] ?? noteName;
      await this.openFile(match.path, filename);
    }
  }

  closeFile(path: string) {
    this.openFiles = this.openFiles.filter((f) => f.path !== path);
    if (this.activeFilePath === path) {
      const lastOpen = this.openFiles[this.openFiles.length - 1];
      this.activeFilePath = lastOpen?.path ?? null;
      this.refreshBacklinks();
    }
  }

  updateContent(path: string, content: string) {
    const file = this.openFiles.find((f) => f.path === path);
    if (file) {
      file.content = content;
      file.dirty = true;
    }
  }

  async saveFile(path: string) {
    const file = this.openFiles.find((f) => f.path === path);
    if (file) {
      await writeFile(path, file.content);
      file.dirty = false;
      // Re-index the saved file locally
      try {
        await linkIndex.indexFile(path, file.content);
        const parts = path.replace(/\\/g, "/").split("/");
        searchIndex.updateFile(path, parts[parts.length - 1] ?? "", file.content);
        this.noteNames = linkIndex.getAllNoteNames();
        await this.refreshBacklinks();
      } catch (e) {
        console.error("[vault] saveFile re-index error:", e);
      }
    }
  }

  refreshBacklinks() {
    if (!this.activeFilePath) {
      this.backlinks = [];
      return;
    }
    try {
      this.backlinks = linkIndex.getBacklinks(this.activeFileName);
    } catch (e) {
      console.error("[vault] refreshBacklinks error:", e);
      this.backlinks = [];
    }
  }
}

export const vaultStore = new VaultStore();
