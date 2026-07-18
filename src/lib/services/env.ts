/** True when running inside a Tauri webview (vs. plain browser / Vitest). */
export function isTauri(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}
