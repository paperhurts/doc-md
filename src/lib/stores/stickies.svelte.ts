/**
 * Sticky-note state: which notes are popped out as desktop stickies, their
 * window geometry, and global visibility. Persisted to localStorage, which is
 * shared across the main window and all sticky windows (same origin).
 */

const STORAGE_KEY = "doc-md-stickies";

export interface StickyNote {
  /** Absolute path of the note file. */
  path: string;
  /** Display label (file name without extension). */
  label: string;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
}

interface StickyState {
  notes: StickyNote[];
  /** Global toggle: whether sticky windows are currently shown. */
  visible: boolean;
}

/** Stable window label for a note path (djb2 hash, hex). */
export function stickyLabel(path: string): string {
  let hash = 5381;
  for (let i = 0; i < path.length; i++) {
    hash = ((hash << 5) + hash + path.charCodeAt(i)) >>> 0;
  }
  return `sticky-${hash.toString(16)}`;
}

export function labelForPath(path: string): string {
  const parts = path.replace(/\\/g, "/").split("/");
  return (parts[parts.length - 1] ?? path).replace(/\.(md|markdown)$/, "");
}

class StickyStore {
  notes = $state<StickyNote[]>([]);
  visible = $state(true);

  init() {
    this.load();
    // Sync when another window (main or sticky) updates the list
    window.addEventListener("storage", (e) => {
      if (e.key === STORAGE_KEY) this.load();
    });
  }

  private load() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as StickyState;
        this.notes = parsed.notes ?? [];
        this.visible = parsed.visible ?? true;
      }
    } catch {
      // Corrupted state — start empty
      this.notes = [];
      this.visible = true;
    }
  }

  private save() {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ notes: this.notes, visible: this.visible } satisfies StickyState),
    );
  }

  isSticky(path: string): boolean {
    return this.notes.some((n) => n.path === path);
  }

  get(path: string): StickyNote | undefined {
    return this.notes.find((n) => n.path === path);
  }

  add(path: string): StickyNote {
    const existing = this.get(path);
    if (existing) return existing;
    const note: StickyNote = { path, label: labelForPath(path) };
    this.notes = [...this.notes, note];
    this.save();
    return note;
  }

  remove(path: string) {
    this.notes = this.notes.filter((n) => n.path !== path);
    this.save();
  }

  updateGeometry(path: string, geo: Partial<Pick<StickyNote, "x" | "y" | "width" | "height">>) {
    const note = this.get(path);
    if (!note) return;
    this.notes = this.notes.map((n) => (n.path === path ? { ...n, ...geo } : n));
    this.save();
  }

  setVisible(visible: boolean) {
    this.visible = visible;
    this.save();
  }

  toggleVisible(): boolean {
    this.setVisible(!this.visible);
    return this.visible;
  }
}

export const stickyStore = new StickyStore();
