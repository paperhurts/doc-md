/**
 * OneNote-style screenshot capture (frontend side).
 *
 * Real flow: global hotkey / palette -> Rust freezes the monitor and opens a
 * `?capture=1` overlay window -> the overlay crops via finishCapture, saves
 * the PNG into the vault and emits `screenshot-captured` -> the main window
 * listener inserts the markdown at the cursor, or appends to the daily note
 * when the window is hidden / nothing is open.
 *
 * Mock flow (browser, Vitest): triggerCapture short-circuits the overlay —
 * it saves a tiny synthetic PNG and emits the same event.
 */
import { invoke, convertFileSrc } from "@tauri-apps/api/core";
import { isTauri } from "./env";
import { emitMockEvent, MOCK_VAULT_PATH } from "./mock";
import { listenEvent } from "./events";
import { imageFileName, markdownImageLink } from "./images";
import { writeBinaryFile, getCurrentVault } from "./tauri";
import { vaultStore } from "../stores/vault.svelte";
import { settingsStore } from "../stores/settings.svelte";
import { editorBridge } from "../stores/editorBridge.svelte";

export const DEFAULT_CAPTURE_SHORTCUT = "Ctrl+Shift+S";

/** Smallest valid PNG (1x1) — the mock backend's "screenshot". */
export const MOCK_PNG_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";

export interface CaptureRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface CapturedImage {
  relPath: string;
  markdown: string;
}

/** CSS px -> physical px. The overlay converts; Rust only clamps. */
export function toPhysicalRect(rect: CaptureRect, dpr: number): CaptureRect {
  return {
    x: Math.round(rect.x * dpr),
    y: Math.round(rect.y * dpr),
    width: Math.round(rect.width * dpr),
    height: Math.round(rect.height * dpr),
  };
}

// ---- command wrappers (mock-backed outside Tauri) -------------------------

/** Ready-to-use <img> src of the frozen full-monitor frame (overlay window
 * only). Real flow streams a temp PNG via the asset protocol — base64 over
 * IPC took seconds on large monitors. */
export async function getCaptureFrameSrc(): Promise<string> {
  if (!isTauri()) return `data:image/png;base64,${MOCK_PNG_BASE64}`;
  const path = await invoke<string>("get_capture_frame");
  return convertFileSrc(path);
}

/** Crop the frozen frame (physical px) and get the PNG base64 back. */
export async function finishCapture(rect: CaptureRect): Promise<string> {
  if (!isTauri()) return MOCK_PNG_BASE64;
  return await invoke("finish_capture", {
    x: rect.x,
    y: rect.y,
    w: rect.width,
    h: rect.height,
  });
}

export async function cancelCapture(): Promise<void> {
  if (!isTauri()) return;
  return await invoke("cancel_capture");
}

/** Reveal the overlay window once the frozen frame has painted (it is
 * created hidden so the user never sees a black fullscreen window). */
export async function showCaptureOverlay(): Promise<void> {
  if (!isTauri()) return;
  return await invoke("show_capture_overlay");
}

/**
 * Start a capture. In Tauri this kicks off the Rust flow (overlay etc.); in
 * mock mode it saves a synthetic PNG and emits the event directly so the
 * whole routing path is exercisable in browser/Vitest.
 */
export async function triggerCapture(now: Date = new Date()): Promise<void> {
  if (isTauri()) return await invoke("trigger_capture");
  const vaultPath = vaultStore.vault?.path ?? MOCK_VAULT_PATH;
  const saved = await saveCapturedImage(
    MOCK_PNG_BASE64,
    vaultPath,
    settingsStore.settings.attachmentFolder,
    now,
  );
  emitMockEvent("screenshot-captured", saved);
}

/** Rebind the global hotkey; rejects (with the old binding restored) on conflict. */
export async function setCaptureShortcut(shortcut: string, previous: string): Promise<void> {
  if (!isTauri()) return;
  return await invoke("set_capture_shortcut", { shortcut, previous });
}

/** Startup hotkey registration error, if any (shown in Settings). */
export async function getCaptureShortcutError(): Promise<string | null> {
  if (!isTauri()) return null;
  return (await invoke<string | null>("get_capture_shortcut_error")) ?? null;
}

// ---- saving + routing -----------------------------------------------------

/** Save a captured PNG into <vault>/<attachmentFolder>/screenshot-*.png. */
export async function saveCapturedImage(
  base64: string,
  vaultPath: string,
  attachmentFolder: string,
  now: Date = new Date(),
): Promise<CapturedImage> {
  const name = imageFileName(now, "png", "screenshot-");
  const relPath = `${attachmentFolder}/${name}`;
  const sep = vaultPath.includes("\\") ? "\\" : "/";
  const absPath = `${vaultPath}${sep}${attachmentFolder}${sep}${name}`;
  await writeBinaryFile(absPath, base64);
  return { relPath, markdown: markdownImageLink(relPath) };
}

/** Overlay-side: announce a saved capture to all windows. */
export async function emitCaptured(payload: CapturedImage): Promise<void> {
  if (isTauri()) {
    const { emit } = await import("@tauri-apps/api/event");
    await emit("screenshot-captured", payload);
  } else {
    emitMockEvent("screenshot-captured", payload);
  }
}

/** Overlay-side: surface a capture failure in the main window. Without this
 * every failure is a console.error in a window nobody can see. */
export async function emitCaptureError(message: string): Promise<void> {
  if (isTauri()) {
    const { emit } = await import("@tauri-apps/api/event");
    await emit("screenshot-error", { message });
  } else {
    emitMockEvent("screenshot-error", { message });
  }
}

/**
 * Route a captured image: insert at the cursor when the main window is
 * visible with a live editor; otherwise append to today's daily note.
 * Must never show the hidden main window (tray-resident capture).
 */
export async function routeCapturedImage(markdown: string): Promise<void> {
  try {
    void vaultStore.refreshTree();
    if (await isMainWindowVisible()) {
      if (vaultStore.activeFile && editorBridge.insertAtCursor?.(markdown)) return;
    }
    await vaultStore.appendToDailyNote(`\n${markdown}\n`);
  } catch (e) {
    const { dialogStore } = await import("../stores/dialogs.svelte");
    void dialogStore.alert(`Screenshot saved but couldn't be inserted: ${e}`);
  }
}

async function isMainWindowVisible(): Promise<boolean> {
  if (!isTauri()) return true;
  try {
    const { getCurrentWindow } = await import("@tauri-apps/api/window");
    return await getCurrentWindow().isVisible();
  } catch {
    return true;
  }
}

let listenerInitialized = false;

/**
 * Main-window init: listen for captures and replay a custom hotkey binding
 * from settings (the Rust side registers the default at startup). Idempotent.
 */
export async function initScreenshots(): Promise<void> {
  if (!listenerInitialized) {
    listenerInitialized = true;
    await listenEvent<CapturedImage>("screenshot-captured", (payload) => {
      void routeCapturedImage(payload.markdown);
    });
    await listenEvent<{ message: string }>("screenshot-error", async (payload) => {
      const { dialogStore } = await import("../stores/dialogs.svelte");
      void dialogStore.alert(`Screenshot capture failed: ${payload.message}`);
    });
  }
  const saved = settingsStore.settings.captureHotkey;
  if (isTauri() && saved && saved !== DEFAULT_CAPTURE_SHORTCUT) {
    try {
      await setCaptureShortcut(saved, DEFAULT_CAPTURE_SHORTCUT);
    } catch (e) {
      console.error("[screenshot] failed to rebind saved hotkey:", e);
    }
  }
}

/** Overlay-side one-shot: crop, save, announce. Returns false on cancel-worthy failure. */
export async function completeCaptureFromOverlay(rect: CaptureRect, dpr: number): Promise<boolean> {
  const physical = toPhysicalRect(rect, dpr);
  const base64 = await finishCapture(physical);
  const vault = await getCurrentVault();
  if (!vault) return false;
  const saved = await saveCapturedImage(
    base64,
    vault.path,
    settingsStore.settings.attachmentFolder,
  );
  await emitCaptured(saved);
  return true;
}
