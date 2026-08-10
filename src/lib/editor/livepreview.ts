/**
 * Live preview (preview-edit mode): an Obsidian-style editing surface built on
 * CodeMirror decorations. Markdown syntax marks are hidden and replaced with
 * formatted rendering; moving the cursor onto a line reveals its source so it
 * stays fully editable. No HTML round-trip — the document is always markdown.
 */
import { syntaxTree } from "@codemirror/language";
import {
  Decoration,
  type DecorationSet,
  EditorView,
  ViewPlugin,
  type ViewUpdate,
  WidgetType,
} from "@codemirror/view";
import { EditorState, type Range } from "@codemirror/state";

const WIKILINK_RE = /\[\[([^\]|]+)(\|([^\]]+))?\]\]/g;

export interface LivePreviewOptions {
  /** Map a markdown image src to a loadable URL (vault-relative -> asset
   * protocol). Return null to leave the raw source visible. */
  resolveImage?: (src: string) => string | null;
}

class BulletWidget extends WidgetType {
  eq() {
    return true;
  }
  toDOM() {
    const span = document.createElement("span");
    span.className = "cm-lp-bullet";
    span.textContent = "•";
    return span;
  }
}

class ImageWidget extends WidgetType {
  constructor(
    readonly src: string,
    readonly alt: string,
  ) {
    super();
  }
  eq(other: ImageWidget) {
    return other.src === this.src && other.alt === this.alt;
  }
  toDOM(view: EditorView) {
    const img = document.createElement("img");
    img.className = "cm-lp-image";
    img.src = this.src;
    img.alt = this.alt;
    img.draggable = false;
    // Height is unknown until load — tell CM to re-measure so following
    // lines don't overlap the image
    img.onload = () => view.requestMeasure();
    return img;
  }
  ignoreEvent() {
    return false;
  }
}

class HrWidget extends WidgetType {
  eq() {
    return true;
  }
  toDOM() {
    const hr = document.createElement("hr");
    hr.className = "cm-lp-hr";
    return hr;
  }
}

class CheckboxWidget extends WidgetType {
  constructor(
    readonly checked: boolean,
    readonly from: number,
    readonly to: number,
  ) {
    super();
  }
  eq(other: CheckboxWidget) {
    return other.checked === this.checked && other.from === this.from && other.to === this.to;
  }
  toDOM(view: EditorView) {
    const box = document.createElement("input");
    box.type = "checkbox";
    box.checked = this.checked;
    box.className = "cm-lp-checkbox";
    box.setAttribute("aria-label", "Toggle task");
    box.onmousedown = (e) => e.preventDefault();
    box.onclick = (e) => {
      e.preventDefault();
      // TaskMarker text is "[ ]" or "[x]" — flip the inner char
      view.dispatch({
        changes: { from: this.from + 1, to: this.to - 1, insert: this.checked ? " " : "x" },
      });
    };
    return box;
  }
  ignoreEvent() {
    return true;
  }
}

/** Line numbers (1-based) that contain any part of the current selection. */
function selectedLines(state: EditorState): Set<number> {
  const lines = new Set<number>();
  for (const range of state.selection.ranges) {
    const fromLine = state.doc.lineAt(range.from).number;
    const toLine = state.doc.lineAt(range.to).number;
    for (let n = fromLine; n <= toLine; n++) lines.add(n);
  }
  return lines;
}

/**
 * Compute live-preview decorations for [from, to). Exported separately from
 * the view plugin so tests can run it against a plain EditorState.
 */
export function computeLivePreviewDecorations(
  state: EditorState,
  from: number,
  to: number,
  options: LivePreviewOptions = {},
): Range<Decoration>[] {
  const decorations: Range<Decoration>[] = [];
  const active = selectedLines(state);
  const hidden = Decoration.replace({});

  const lineIsActive = (pos: number) => active.has(state.doc.lineAt(pos).number);

  syntaxTree(state).iterate({
    from,
    to,
    enter: (node) => {
      switch (node.name) {
        case "HeaderMark": {
          if (lineIsActive(node.from)) break;
          // Hide "#…#" plus the following space (ATX); for Setext keep hidden too
          let end = node.to;
          if (state.doc.sliceString(end, end + 1) === " ") end += 1;
          decorations.push(hidden.range(node.from, end));
          break;
        }
        case "EmphasisMark":
        case "CodeMark":
        case "StrikethroughMark": {
          if (lineIsActive(node.from)) break;
          if (node.name === "CodeMark" && node.to - node.from >= 3) {
            // Fence mark: hide the whole fence line ("```js" including the
            // language info) — the block itself is styled via cm-lp-code
            decorations.push(hidden.range(node.from, state.doc.lineAt(node.from).to));
            break;
          }
          decorations.push(hidden.range(node.from, node.to));
          break;
        }
        case "FencedCode": {
          // Style every line of the block like a rendered code block
          const first = state.doc.lineAt(node.from).number;
          const last = state.doc.lineAt(node.to).number;
          for (let n = first; n <= last; n++) {
            const line = state.doc.line(n);
            decorations.push(Decoration.line({ class: "cm-lp-code" }).range(line.from));
          }
          break;
        }
        case "Image": {
          if (lineIsActive(node.from)) break;
          const resolveImage = options.resolveImage;
          if (!resolveImage) break;
          const cursor = node.node.cursor();
          let url: { from: number; to: number } | null = null;
          let altEnd = node.from + 2;
          if (cursor.firstChild()) {
            do {
              if (cursor.name === "URL") url = { from: cursor.from, to: cursor.to };
              // Alt text sits between the "![" mark and the "]" mark
              if (cursor.name === "LinkMark" && state.doc.sliceString(cursor.from, cursor.to) === "]")
                altEnd = cursor.from;
            } while (cursor.nextSibling());
          }
          if (!url) break;
          const resolved = resolveImage(state.doc.sliceString(url.from, url.to));
          if (!resolved) break;
          const alt = state.doc.sliceString(node.from + 2, Math.max(node.from + 2, altEnd));
          decorations.push(
            Decoration.replace({ widget: new ImageWidget(resolved, alt) }).range(
              node.from,
              node.to,
            ),
          );
          break;
        }
        case "Link": {
          if (lineIsActive(node.from)) break;
          // Hide everything except the link text: [text](url) -> text
          const cursor = node.node.cursor();
          if (cursor.firstChild()) {
            do {
              if (cursor.name === "LinkMark" || cursor.name === "URL") {
                decorations.push(hidden.range(cursor.from, cursor.to));
              }
            } while (cursor.nextSibling());
          }
          break;
        }
        case "TaskMarker": {
          if (lineIsActive(node.from)) break;
          const text = state.doc.sliceString(node.from, node.to);
          const checked = /x/i.test(text);
          let end = node.to;
          if (state.doc.sliceString(end, end + 1) === " ") end += 1;
          decorations.push(
            Decoration.replace({
              widget: new CheckboxWidget(checked, node.from, node.to),
            }).range(node.from, end),
          );
          break;
        }
        case "ListMark": {
          if (lineIsActive(node.from)) break;
          const mark = state.doc.sliceString(node.from, node.to);
          // Bullets become •; ordered-list numbers stay visible
          if (mark === "-" || mark === "*" || mark === "+") {
            // A real task item's ListMark is followed by a Task node whose
            // TaskMarker becomes the checkbox — hide the bullet then.
            if (node.node.nextSibling?.name === "Task") {
              decorations.push(hidden.range(node.from, node.to + 1));
              break;
            }
            // An EMPTY task ("- [ ]" with nothing after) parses as a plain
            // paragraph, no TaskMarker — render its literal "[ ]" as a
            // checkbox anyway instead of leaving orphaned source.
            const lineEnd = state.doc.lineAt(node.from).to;
            const rest = state.doc.sliceString(node.to + 1, lineEnd);
            const m = /^\[( |x|X)\]$/.exec(rest);
            if (m) {
              const boxFrom = node.to + 1;
              decorations.push(hidden.range(node.from, boxFrom));
              decorations.push(
                Decoration.replace({
                  widget: new CheckboxWidget(/x/i.test(m[1]), boxFrom, boxFrom + 3),
                }).range(boxFrom, boxFrom + 3),
              );
              break;
            }
            decorations.push(
              Decoration.replace({ widget: new BulletWidget() }).range(node.from, node.to),
            );
          }
          break;
        }
        case "QuoteMark": {
          if (lineIsActive(node.from)) break;
          let end = node.to;
          if (state.doc.sliceString(end, end + 1) === " ") end += 1;
          decorations.push(hidden.range(node.from, end));
          break;
        }
        case "Blockquote": {
          // Style every line of the quote with a left border
          const first = state.doc.lineAt(node.from).number;
          const last = state.doc.lineAt(node.to).number;
          for (let n = first; n <= last; n++) {
            const line = state.doc.line(n);
            decorations.push(Decoration.line({ class: "cm-lp-quote" }).range(line.from));
          }
          break;
        }
        case "HorizontalRule": {
          if (lineIsActive(node.from)) break;
          decorations.push(
            Decoration.replace({ widget: new HrWidget() }).range(node.from, node.to),
          );
          break;
        }
      }
    },
  });

  // Wikilinks are regex-based (not in the markdown syntax tree):
  // [[Target]] -> Target, [[Target|Alias]] -> Alias
  const fromLine = state.doc.lineAt(from).number;
  const toLine = state.doc.lineAt(Math.min(to, state.doc.length)).number;
  for (let n = fromLine; n <= toLine; n++) {
    if (active.has(n)) continue;
    const line = state.doc.line(n);
    WIKILINK_RE.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = WIKILINK_RE.exec(line.text)) !== null) {
      const start = line.from + m.index;
      const end = start + m[0].length;
      if (m[3]) {
        // [[Target|Alias]] — hide "[[Target|" and "]]"
        decorations.push(hidden.range(start, start + 2 + m[1].length + 1));
        decorations.push(hidden.range(end - 2, end));
      } else {
        decorations.push(hidden.range(start, start + 2));
        decorations.push(hidden.range(end - 2, end));
      }
    }
  }

  decorations.sort((a, b) => a.from - b.from || a.to - b.to);
  return decorations;
}

export function livePreviewPlugin(options: LivePreviewOptions = {}) {
  return ViewPlugin.fromClass(
    class {
      decorations: DecorationSet;

      constructor(view: EditorView) {
        this.decorations = this.build(view);
      }

      update(update: ViewUpdate) {
        if (update.docChanged || update.selectionSet || update.viewportChanged) {
          this.decorations = this.build(update.view);
        }
      }

      build(view: EditorView): DecorationSet {
        const all: Range<Decoration>[] = [];
        for (const { from, to } of view.visibleRanges) {
          all.push(...computeLivePreviewDecorations(view.state, from, to, options));
        }
        all.sort((a, b) => a.from - b.from || a.to - b.to);
        return Decoration.set(all, true);
      }
    },
    { decorations: (v) => v.decorations },
  );
}

/** Extra editor styling active only in preview-edit mode. */
export const livePreviewTheme = EditorView.theme({
  ".cm-lp-bullet": {
    color: "var(--accent)",
  },
  ".cm-lp-checkbox": {
    accentColor: "var(--accent)",
    verticalAlign: "middle",
    marginRight: "6px",
    cursor: "pointer",
  },
  ".cm-lp-quote": {
    borderLeft: "3px solid var(--accent)",
    paddingLeft: "10px",
  },
  ".cm-lp-code": {
    backgroundColor: "var(--bg-surface)",
    fontFamily: "var(--font-mono)",
  },
  ".cm-lp-image": {
    display: "block",
    maxWidth: "100%",
    borderRadius: "4px",
    margin: "4px 0",
  },
  ".cm-lp-hr": {
    border: "none",
    borderTop: "1px solid var(--border-strong)",
    display: "inline-block",
    width: "100%",
    verticalAlign: "middle",
  },
  ".cm-content": {
    maxWidth: "760px",
    margin: "0 auto",
  },
  // Read like a rendered document, not source: prose font, same as the split
  // preview pane. Extra "&.cm-editor" specificity so this beats the base
  // theme's equally-specific --font-editor rule (tie breaks by sheet order).
  "&.cm-editor .cm-content": {
    fontFamily: "var(--font-body)",
  },
  ".cm-gutters": {
    display: "none",
  },
});

export function livePreviewExtensions(options: LivePreviewOptions = {}) {
  return [livePreviewPlugin(options), livePreviewTheme];
}
