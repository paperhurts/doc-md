import {
  getCurrentVault,
  setCurrentVault,
  listFiles,
  readFile,
  writeFile,
} from "../services/tauri";
import { linkIndex } from "../services/indexer";
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
    } catch (e) {
      console.error("Failed to open vault:", e);
    }
  }

  async createNote(name: string) {
    if (!this.vault) return;
    const fileName = name.endsWith(".md") ? name : `${name}.md`;
    const sep = this.vault.path.includes("\\") ? "\\" : "/";
    const filePath = `${this.vault.path}${sep}${fileName}`;
    try {
      await writeFile(filePath, `# ${name.replace(/\.md$/, "")}\n\n`);
      await this.refreshTree();
      await this.openFile(filePath, fileName);
    } catch (e) {
      console.error("Failed to create note:", e);
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
