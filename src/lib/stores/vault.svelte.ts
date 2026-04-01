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
      if (saved) {
        this.vault = saved;
        await this.refreshTree();
        await this.buildIndex();
      }
    } catch {
      // No saved vault or not in Tauri — that's fine
    }
  }

  async openVault(path: string) {
    const config = await setCurrentVault(path);
    this.vault = config;
    this.openFiles = [];
    this.activeFilePath = null;
    await this.refreshTree();
    await this.buildIndex();
  }

  async refreshTree() {
    if (!this.vault) return;
    this.tree = await listFiles(this.vault.path);
  }

  async buildIndex() {
    if (!this.vault) return;
    try {
      await indexVault(this.vault.path);
      this.noteNames = await getAllNoteNames();
    } catch {
      // Sidecar not available
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
        this.noteNames = await getAllNoteNames();
        await this.refreshBacklinks();
      } catch {
        // Sidecar not available
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
    } catch {
      this.backlinks = [];
    }
  }
}

export const vaultStore = new VaultStore();
