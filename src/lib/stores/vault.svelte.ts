import {
  getCurrentVault,
  setCurrentVault,
  listFiles,
  readFile,
  writeFile,
  indexVault,
  indexFile,
  getBacklinks,
  getAllNoteNames,
  buildSearchIndex,
  updateSearchIndex,
  type Backlink,
  type NoteName,
} from "../services/tauri";
import type { VaultEntry } from "../types";

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
      await indexVault(this.vault.path);
      await buildSearchIndex(this.vault.path);
      this.noteNames = await getAllNoteNames();
    } catch (e) {
      console.error("[vault] buildIndex error:", e);
      this.error = "Failed to build index. Search and backlinks may be unavailable.";
    }
  }

  async openFile(path: string, name: string) {
    const existing = this.openFiles.find((f) => f.path === path);
    if (existing) {
      this.activeFilePath = path;
      await this.refreshBacklinks();
      return;
    }

    const content = await readFile(path);
    this.openFiles.push({ path, name, content, dirty: false });
    this.activeFilePath = path;
    await this.refreshBacklinks();
  }

  async navigateToNote(noteName: string) {
    // Find the note by name in the index
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
      this.activeFilePath =
        this.openFiles.length > 0
          ? this.openFiles[this.openFiles.length - 1].path
          : null;
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
      // Re-index the saved file
      try {
        await indexFile(path);
        if (this.vault) {
          await updateSearchIndex(this.vault.path, path);
        }
        this.noteNames = await getAllNoteNames();
        await this.refreshBacklinks();
      } catch (e) {
        console.error("[vault] saveFile re-index error:", e);
      }
    }
  }

  async refreshBacklinks() {
    if (!this.activeFilePath) {
      this.backlinks = [];
      return;
    }
    try {
      this.backlinks = await getBacklinks(this.activeFileName);
    } catch (e) {
      console.error("[vault] refreshBacklinks error:", e);
      this.backlinks = [];
    }
  }
}

export const vaultStore = new VaultStore();
