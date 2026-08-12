const STORAGE_KEY = "doc-md-settings";

/** How the editor pane presents a note. */
export type ViewMode = "source" | "split" | "preview";

export interface AppSettings {
  fontSize: number;
  editorFontSize: number;
  tabSize: number;
  autoSaveDelay: number;
  dailyNoteFolder: string;
  templateFolder: string;
  attachmentFolder: string;
  showLineNumbers: boolean;
  showPreviewByDefault: boolean;
  viewMode: ViewMode;
  closeToTray: boolean;
  /** Global screenshot hotkey (system-wide, registered by Rust). */
  captureHotkey: string;
  /** Whisper model for transcription notes. */
  transcriptionModel: string;
  /** Default source toggles for new transcription sessions. */
  transcriptionMic: boolean;
  transcriptionSystem: boolean;
  /** Whole-UI zoom factor (0.5–2.0). Main window only — never the sticky or capture windows. */
  uiZoom: number;
}

const DEFAULTS: AppSettings = {
  fontSize: 14,
  editorFontSize: 14,
  tabSize: 2,
  autoSaveDelay: 1000,
  dailyNoteFolder: "daily",
  templateFolder: "_templates",
  attachmentFolder: "attachments",
  showLineNumbers: true,
  showPreviewByDefault: true,
  viewMode: "split",
  closeToTray: true,
  captureHotkey: "Ctrl+Shift+S",
  transcriptionModel: "base.en",
  transcriptionMic: true,
  transcriptionSystem: true,
  uiZoom: 1,
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
  { key: "Ctrl+Shift+E", action: "Cycle view mode (source / split / preview)" },
  { key: "Ctrl+,", action: "Settings" },
  { key: "Ctrl+S", action: "Save file" },
  { key: "Ctrl+D", action: "Daily note" },
  { key: "Ctrl+Shift+S", action: "Capture screenshot (works system-wide)" },
  { key: "Ctrl+Shift+F", action: "Search notes" },
  { key: "Ctrl+Shift+G", action: "Graph view" },
  { key: "Ctrl+= / Ctrl+-", action: "Zoom UI in / out (also Ctrl+Scroll)" },
  { key: "Ctrl+0", action: "Reset UI zoom to 100%" },
  { key: "Ctrl+Click", action: "Navigate to wikilink" },
  { key: "Escape", action: "Close modal / cancel" },
];
