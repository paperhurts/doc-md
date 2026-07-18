/**
 * Sticky-note window management (Tauri side). Each sticky is a small
 * always-on-top frameless webview window running this same app with
 * ?sticky=<path>; StickyNote.svelte renders inside it.
 */
import { isTauri } from "./env";
import { stickyStore, stickyLabel, type StickyNote } from "../stores/stickies.svelte";
import { listenEvent } from "./events";

async function webviewWindowApi() {
  return await import("@tauri-apps/api/webviewWindow");
}

/** Open (or reveal) the sticky window for a note. */
export async function openStickyWindow(note: StickyNote): Promise<void> {
  if (!isTauri()) return;
  const { WebviewWindow } = await webviewWindowApi();
  const label = stickyLabel(note.path);
  const existing = await WebviewWindow.getByLabel(label);
  if (existing) {
    await existing.show();
    await existing.setFocus();
    return;
  }
  new WebviewWindow(label, {
    url: `index.html?sticky=${encodeURIComponent(note.path)}`,
    title: note.label,
    width: note.width ?? 320,
    height: note.height ?? 300,
    ...(note.x !== undefined && note.y !== undefined ? { x: note.x, y: note.y } : {}),
    alwaysOnTop: true,
    decorations: false,
    skipTaskbar: true,
    resizable: true,
  });
}

export async function closeStickyWindow(path: string): Promise<void> {
  if (!isTauri()) return;
  const { WebviewWindow } = await webviewWindowApi();
  const existing = await WebviewWindow.getByLabel(stickyLabel(path));
  if (existing) await existing.destroy();
}

/** Pop a note out as a sticky (adds to store + opens the window). */
export async function popOutSticky(path: string): Promise<void> {
  const note = stickyStore.add(path);
  stickyStore.setVisible(true);
  await openStickyWindow(note);
}

/** Remove a sticky permanently (un-stick). */
export async function removeSticky(path: string): Promise<void> {
  stickyStore.remove(path);
  await closeStickyWindow(path);
}

/** Show or hide all sticky windows to match `visible`. */
export async function applyStickyVisibility(visible: boolean): Promise<void> {
  if (!isTauri()) return;
  const { WebviewWindow } = await webviewWindowApi();
  for (const note of stickyStore.notes) {
    const win = await WebviewWindow.getByLabel(stickyLabel(note.path));
    if (win) {
      if (visible) await win.show();
      else await win.hide();
    } else if (visible) {
      await openStickyWindow(note);
    }
  }
}

export async function toggleAllStickies(): Promise<void> {
  const visible = stickyStore.toggleVisible();
  await applyStickyVisibility(visible);
}

/**
 * Main-window init: restore sticky windows from a previous session and react
 * to the tray's "toggle-stickies" event.
 */
export async function initStickies(): Promise<void> {
  stickyStore.init();
  await listenEvent("toggle-stickies", () => {
    void toggleAllStickies();
  });
  if (stickyStore.visible) {
    for (const note of stickyStore.notes) {
      await openStickyWindow(note);
    }
  }
}
