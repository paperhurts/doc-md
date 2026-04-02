import { EditorView } from "@codemirror/view";
import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { tags } from "@lezer/highlight";

export const docMdTheme = EditorView.theme(
  {
    "&": {
      backgroundColor: "var(--bg-primary)",
      color: "var(--text-primary)",
      fontSize: "14px",
      height: "100%",
    },
    ".cm-content": {
      fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace",
      padding: "16px",
      caretColor: "var(--accent)",
    },
    ".cm-cursor": {
      borderLeftColor: "var(--accent)",
      borderLeftWidth: "2px",
    },
    "&.cm-focused .cm-selectionBackground, .cm-selectionBackground": {
      backgroundColor: "rgba(137, 180, 250, 0.2)",
    },
    ".cm-activeLine": {
      backgroundColor: "rgba(137, 180, 250, 0.05)",
    },
    ".cm-gutters": {
      backgroundColor: "var(--bg-secondary)",
      color: "var(--text-secondary)",
      borderRight: "1px solid var(--border)",
    },
    ".cm-activeLineGutter": {
      backgroundColor: "rgba(137, 180, 250, 0.1)",
    },
    ".cm-scroller": {
      overflow: "auto",
    },
  },
  { dark: true },
);

export const docMdHighlightStyle = syntaxHighlighting(
  HighlightStyle.define([
    { tag: tags.heading1, color: "#f38ba8", fontWeight: "bold", fontSize: "1.6em" },
    { tag: tags.heading2, color: "#fab387", fontWeight: "bold", fontSize: "1.4em" },
    { tag: tags.heading3, color: "#f9e2af", fontWeight: "bold", fontSize: "1.2em" },
    { tag: tags.heading4, color: "#a6e3a1", fontWeight: "bold" },
    { tag: tags.heading5, color: "#89b4fa", fontWeight: "bold" },
    { tag: tags.heading6, color: "#cba6f7", fontWeight: "bold" },
    { tag: tags.strong, fontWeight: "bold", color: "#f38ba8" },
    { tag: tags.emphasis, fontStyle: "italic", color: "#f5c2e7" },
    { tag: tags.strikethrough, textDecoration: "line-through", color: "#6c7086" },
    { tag: tags.link, color: "#89b4fa", textDecoration: "underline" },
    { tag: tags.url, color: "#89b4fa" },
    { tag: tags.quote, color: "#a6adc8", fontStyle: "italic" },
    { tag: tags.monospace, color: "#a6e3a1", fontFamily: "monospace" },
    { tag: tags.meta, color: "#6c7086" },
    { tag: tags.comment, color: "#6c7086" },
    { tag: tags.processingInstruction, color: "#cba6f7" },
  ]),
);
