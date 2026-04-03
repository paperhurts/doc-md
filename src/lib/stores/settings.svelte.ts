const STORAGE_KEY = "doc-md-settings";

export interface AppSettings {
  fontSize: number;
  editorFontSize: number;
  tabSize: number;
  autoSaveDelay: number;
  dailyNoteFolder: string;
  templateFolder: string;
  showLineNumbers: boolean;
  showPreviewByDefault: boolean;
}

const DEFAULTS: AppSettings = {
  fontSize: 14,
  editorFontSize: 14,
  tabSize: 2,
  autoSaveDelay: 1000,
  dailyNoteFolder: "daily",
  templateFolder: "_templates",
  showLineNumbers: true,
  showPreviewByDefault: true,
};

class SettingsStore {
  settings = $state<AppSettings>({ ...DEFAULTS });

  init() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        this.settings = { ...DEFAULTS, ...parsed };
      }
    } catch {
      // Corrupted settings — use defaults
    }
    this.applyCSS();
  }

  update(partial: Partial<AppSettings>) {
    this.settings = { ...this.settings, ...partial };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(this.settings));
    this.applyCSS();
  }

  reset() {
    this.settings = { ...DEFAULTS };
    localStorage.removeItem(STORAGE_KEY);
    this.applyCSS();
  }

  private applyCSS() {
    const root = document.documentElement;
    root.style.setProperty("--font-size", `${this.settings.fontSize}px`);
    root.style.setProperty("--editor-font-size", `${this.settings.editorFontSize}px`);
  }
}

export const settingsStore = new SettingsStore();

/** Keyboard shortcuts reference. */
export const SHORTCUTS = [
  { key: "Ctrl+K", action: "Command palette" },
  { key: "Ctrl+,", action: "Settings" },
  { key: "Ctrl+S", action: "Save file" },
  { key: "Ctrl+D", action: "Daily note" },
  { key: "Ctrl+Shift+F", action: "Search notes" },
  { key: "Ctrl+Shift+G", action: "Graph view" },
  { key: "Ctrl+Click", action: "Navigate to wikilink" },
  { key: "Escape", action: "Close modal / cancel" },
];
