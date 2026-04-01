import {
  ViewPlugin,
  Decoration,
  type DecorationSet,
  type EditorView,
  type ViewUpdate,
  WidgetType,
} from "@codemirror/view";
import { RangeSetBuilder } from "@codemirror/state";

const WIKILINK_RE = /\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g;
const TAG_RE = /(?:^|\s)(#[a-zA-Z][\w/-]*)/g;

class WikilinkWidget extends WidgetType {
  constructor(
    readonly text: string,
    readonly alias: string | undefined,
  ) {
    super();
  }

  toDOM(): HTMLElement {
    const span = document.createElement("span");
    span.className = "cm-wikilink";
    span.textContent = this.alias ?? this.text;
    span.style.color = "var(--accent)";
    span.style.cursor = "pointer";
    span.style.textDecoration = "underline";
    span.style.textDecorationStyle = "dotted";
    return span;
  }
}

function buildDecorations(view: EditorView): DecorationSet {
  const builder = new RangeSetBuilder<Decoration>();
  const doc = view.state.doc;

  for (let i = 1; i <= doc.lines; i++) {
    const line = doc.line(i);
    const text = line.text;

    // Wiki links
    WIKILINK_RE.lastIndex = 0;
    let match;
    while ((match = WIKILINK_RE.exec(text)) !== null) {
      const from = line.from + match.index;
      const to = from + match[0].length;
      builder.add(
        from,
        to,
        Decoration.mark({ class: "cm-wikilink-syntax" }),
      );
    }

    // Tags
    TAG_RE.lastIndex = 0;
    while ((match = TAG_RE.exec(text)) !== null) {
      const tagStart = line.from + match.index + (match[0].startsWith(" ") ? 1 : 0);
      const tagEnd = tagStart + match[1].length;
      builder.add(
        tagStart,
        tagEnd,
        Decoration.mark({
          class: "cm-tag-syntax",
          attributes: { style: "color: #cba6f7;" },
        }),
      );
    }
  }

  return builder.finish();
}

export const wikilinkPlugin = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;
    constructor(view: EditorView) {
      this.decorations = buildDecorations(view);
    }
    update(update: ViewUpdate) {
      if (update.docChanged || update.viewportChanged) {
        this.decorations = buildDecorations(update.view);
      }
    }
  },
  { decorations: (v) => v.decorations },
);
