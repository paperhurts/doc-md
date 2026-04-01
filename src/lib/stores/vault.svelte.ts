import {
  getCurrentVault,
  setCurrentVault,
  listFiles,
  readFile,
  writeFile,
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

  get activeFile(): OpenFile | undefined {
    return this.openFiles.find((f) => f.path === this.activeFilePath);
  }

  async init() {
    try {
      const saved = await getCurrentVault();
      if (saved) {
        this.vault = saved;
        await this.refreshTree();
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
  }

  async refreshTree() {
    if (!this.vault) return;
    this.tree = await listFiles(this.vault.path);
  }

  async openFile(path: string, name: string) {
    const existing = this.openFiles.find((f) => f.path === path);
    if (existing) {
      this.activeFilePath = path;
      return;
    }

    const content = await readFile(path);
    this.openFiles.push({ path, name, content, dirty: false });
    this.activeFilePath = path;
  }

  closeFile(path: string) {
    this.openFiles = this.openFiles.filter((f) => f.path !== path);
    if (this.activeFilePath === path) {
      this.activeFilePath = this.openFiles.length > 0
        ? this.openFiles[this.openFiles.length - 1].path
        : null;
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
    }
  }
}

export const vaultStore = new VaultStore();
