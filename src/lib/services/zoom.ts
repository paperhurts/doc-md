/**
 * Whole-UI zoom for the MAIN window only.
 * In Tauri this uses native WebView2 page zoom (browser-grade handling of
 * CodeMirror measurement and fixed overlays); in a plain browser (dev/mock
 * mode) it falls back to a CSS `--ui-zoom` var consumed by app.css.
 * The sticky and capture windows must never zoom — the capture overlay maps
 * clientX/Y * devicePixelRatio to physical crop pixels, which any zoom would
 * corrupt — so this is only ever called from App.svelte, not from
 * settingsStore.applyCSS() (which runs in every window).
 */
import { isTauri } from "./env";

export const MIN_ZOOM = 0.5;
export const MAX_ZOOM = 2.0;
export const ZOOM_STEP = 0.1;

/** Clamp to [MIN_ZOOM, MAX_ZOOM] and round to one decimal (kills 0.1-step float drift). */
export function clampZoom(z: number): number {
  if (!Number.isFinite(z)) return 1;
  const rounded = Math.round(z * 10) / 10;
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, rounded));
}

/** Map a keydown to a zoom action, or null. Alt is rejected so AltGr layouts never zoom. */
export function zoomKeyAction(
  e: Pick<KeyboardEvent, "key" | "code" | "ctrlKey" | "metaKey" | "altKey">,
): "in" | "out" | "reset" | null {
  if (!(e.ctrlKey || e.metaKey) || e.altKey) return null;
  if (e.key === "=" || e.key === "+" || e.code === "NumpadAdd") return "in";
  if (e.key === "-" || e.key === "_" || e.code === "NumpadSubtract") return "out";
  if (e.key === "0" || e.code === "Numpad0") return "reset";
  return null;
}

/** Apply a zoom factor to the current window. */
export async function applyUiZoom(factor: number): Promise<void> {
  const z = clampZoom(factor);
  if (isTauri()) {
    const { getCurrentWebview } = await import("@tauri-apps/api/webview");
    await getCurrentWebview().setZoom(z);
  } else {
    document.documentElement.style.setProperty("--ui-zoom", String(z));
  }
}
