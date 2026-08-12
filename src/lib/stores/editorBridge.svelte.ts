/**
 * Bridge for injecting text into the mounted CodeMirror editor from outside
 * the component tree (e.g. a screenshot arriving via a Tauri event).
 * EditorPane registers/clears the handler; it returns false when no live
 * editor view exists so callers can fall back (daily note append).
 */
class EditorBridge {
  insertAtCursor = $state<((text: string) => boolean) | null>(null);
  /** Scroll the editor to the end of the document (transcription follow mode). */
  scrollToEnd = $state<(() => boolean) | null>(null);
}

export const editorBridge = new EditorBridge();
