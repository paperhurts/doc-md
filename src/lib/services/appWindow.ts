/**
 * Main-window behaviors: close-to-tray interception.
 * The tray icon itself lives in Rust (src-tauri/src/lib.rs); the frontend
 * decides what "close" means because the setting lives in localStorage.
 */
import { isTauri } from "./env";
import { settingsStore } from "../stores/settings.svelte";

export async function initCloseToTray(): Promise<void> {
  if (!isTauri()) return;
  const { getCurrentWindow } = await import("@tauri-apps/api/window");
  const win = getCurrentWindow();
  if (win.label !== "main") return;
  await win.onCloseRequested(async (event) => {
    if (settingsStore.settings.closeToTray) {
      event.preventDefault();
      await win.hide();
    }
  });
}
