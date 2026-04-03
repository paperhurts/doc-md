/**
 * Floating formatting toolbar: selection tracking, format commands, keyboard shortcuts.
 */

import { ViewPlugin, type ViewUpdate, EditorView } from "@codemirror/view";
import { keymap } from "@codemirror/view";
import type { Extension } from "@codemirror/state";

const MOD = typeof navigator !== "undefined" && /Mac/.test(navigator.platform) ? "⌘" : "Ctrl+";

export interface SelectionInfo {
  show: boolean;
  x: number;
  y: number;
  selectedText: string;
  from: number;
  to: number;
}

export type FormatAction =
  | "bold" | "italic" | "strikethrough" | "code"
  | "heading" | "link" | "wikilink"
  | "bullet" | "checkbox" | "blockquote";

export const FORMAT_BUTTONS: {
  action: FormatAction;
  label: string;
  shortcut?: string;
  group: number;
}[] = [
  { action: "bold", label: "B", shortcut: `${MOD}B`, group: 0 },
  { action: "italic", label: "I", shortcut: `${MOD}I`, group: 0 },
  { action: "strikethrough", label: "S", shortcut: `${MOD}Shift+S`, group: 0 },
  { action: "code", label: "`", shortcut: `${MOD}E`, group: 0 },
  { action: "heading", label: "H", shortcut: `${MOD}Shift+H`, group: 1 },
  { action: "link", label: "Link", shortcut: `${MOD}K`, group: 2 },
  { action: "wikilink", label: "[[]]", shortcut: `${MOD}Shift+W`, group: 2 },
  { action: "bullet", label: "•", group: 3 },
  { action: "checkbox", label: "☑", group: 3 },
  { action: "blockquote", label: ">", group: 3 },
];

/** Apply a markdown formatting action to the current selection. */
export function applyFormat(view: EditorView, action: FormatAction): void {
  const { from, to } = view.state.selection.main;
  const selected = view.state.sliceDoc(from, to);
  const doc = view.state.doc;

  switch (action) {
    case "bold":
      toggleInlineWrap(view, from, to, selected, "**");
      break;
    case "italic":
      toggleInlineWrap(view, from, to, selected, "_");
      break;
    case "strikethrough":
      toggleInlineWrap(view, from, to, selected, "~~");
      break;
    case "code":
      toggleInlineWrap(view, from, to, selected, "`");
      break;
    case "heading":
      cycleHeading(view, from);
      break;
    case "link": {
      const insert = selected ? `[${selected}]()` : `[link]()`;
      const cursorPos = from + (selected ? selected.length : 4) + 3;
      view.dispatch({
        changes: { from, to, insert },
        selection: { anchor: cursorPos },
      });
      break;
    }
    case "wikilink": {
      const insert = `[[${selected || ""}]]`;
      view.dispatch({
        changes: { from, to, insert },
        selection: { anchor: from + 2 + (selected ? selected.length : 0) },
      });
      break;
    }
    case "bullet":
      toggleLinePrefix(view, from, "- ");
      break;
    case "checkbox":
      toggleLinePrefix(view, from, "- [ ] ");
      break;
    case "blockquote":
      toggleLinePrefix(view, from, "> ");
      break;
  }

  view.focus();
}

function toggleInlineWrap(
  view: EditorView, from: number, to: number, selected: string, marker: string,
): void {
  const len = marker.length;
  const doc = view.state.doc;

  // Check if markers are outside the selection
  const before = view.state.sliceDoc(Math.max(0, from - len), from);
  const after = view.state.sliceDoc(to, Math.min(doc.length, to + len));
  if (before === marker && after === marker) {
    // Unwrap: remove markers around selection
    view.dispatch({
      changes: [
        { from: from - len, to: from, insert: "" },
        { from: to, to: to + len, insert: "" },
      ],
      selection: { anchor: from - len, head: to - len },
    });
    return;
  }

  // Check if selection itself contains markers
  if (selected.startsWith(marker) && selected.endsWith(marker) && selected.length >= len * 2) {
    const inner = selected.slice(len, -len);
    view.dispatch({
      changes: { from, to, insert: inner },
      selection: { anchor: from, head: from + inner.length },
    });
    return;
  }

  // Wrap
  view.dispatch({
    changes: { from, to, insert: `${marker}${selected}${marker}` },
    selection: { anchor: from + len, head: from + len + selected.length },
  });
}

function cycleHeading(view: EditorView, pos: number): void {
  const line = view.state.doc.lineAt(pos);
  const text = line.text;
  const match = text.match(/^(#{1,3}) /);

  let newPrefix: string;
  if (!match) {
    newPrefix = "# ";
  } else if (match[1] === "#") {
    newPrefix = "## ";
  } else if (match[1] === "##") {
    newPrefix = "### ";
  } else {
    newPrefix = "";
  }

  const oldPrefixLen = match ? match[0].length : 0;
  view.dispatch({
    changes: { from: line.from, to: line.from + oldPrefixLen, insert: newPrefix },
  });
}

function toggleLinePrefix(view: EditorView, pos: number, prefix: string): void {
  const line = view.state.doc.lineAt(pos);
  if (line.text.startsWith(prefix)) {
    view.dispatch({
      changes: { from: line.from, to: line.from + prefix.length, insert: "" },
    });
  } else {
    view.dispatch({
      changes: { from: line.from, to: line.from, insert: prefix },
    });
  }
}

/** ViewPlugin that tracks selection changes and fires a callback with position info. */
export function createSelectionPlugin(
  cb: (info: SelectionInfo) => void,
): Extension {
  return ViewPlugin.fromClass(
    class {
      constructor(_view: EditorView) {}
      update(update: ViewUpdate) {
        if (!update.selectionSet && !update.docChanged && !update.focusChanged) return;

        const view = update.view;
        if (!view.hasFocus) {
          cb({ show: false, x: 0, y: 0, selectedText: "", from: 0, to: 0 });
          return;
        }

        const { from, to } = view.state.selection.main;
        if (from === to) {
          cb({ show: false, x: 0, y: 0, selectedText: "", from, to });
          return;
        }

        // Defer coordsAtPos to after the update cycle — CM forbids layout reads during update
        requestAnimationFrame(() => {
          try {
            const coordsFrom = view.coordsAtPos(from);
            const coordsTo = view.coordsAtPos(to);
            if (!coordsFrom || !coordsTo) {
              cb({ show: false, x: 0, y: 0, selectedText: "", from, to });
              return;
            }

            const x = (coordsFrom.left + coordsTo.right) / 2;
            const y = Math.min(coordsFrom.top, coordsTo.top);
            const selectedText = view.state.sliceDoc(from, to);

            cb({ show: true, x, y, selectedText, from, to });
          } catch {
            cb({ show: false, x: 0, y: 0, selectedText: "", from: 0, to: 0 });
          }
        });
      }
    },
  );
}

/** Keyboard shortcuts for formatting actions. */
export function createFormattingKeymap(): Extension {
  return keymap.of([
    { key: "Mod-b", run: (view) => { applyFormat(view, "bold"); return true; } },
    { key: "Mod-i", run: (view) => { applyFormat(view, "italic"); return true; } },
    { key: "Mod-Shift-s", run: (view) => { applyFormat(view, "strikethrough"); return true; } },
    { key: "Mod-e", run: (view) => { applyFormat(view, "code"); return true; } },
    { key: "Mod-Shift-h", run: (view) => { applyFormat(view, "heading"); return true; } },
    { key: "Mod-Shift-w", run: (view) => { applyFormat(view, "wikilink"); return true; } },
  ]);
}
