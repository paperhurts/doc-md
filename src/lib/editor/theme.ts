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
      fontFamily: "var(--font-editor)",
      padding: "16px",
      caretColor: "var(--accent)",
    },
    ".cm-cursor": {
      borderLeftColor: "var(--accent)",
      borderLeftWidth: "2px",
    },
    "&.cm-focused .cm-selectionBackground, .cm-selectionBackground": {
      backgroundColor: "var(--accent-subtle)",
    },
    ".cm-activeLine": {
      backgroundColor: "var(--accent-subtle)",
    },
    ".cm-gutters": {
      backgroundColor: "var(--bg-secondary)",
      color: "var(--text-secondary)",
      borderRight: "1px solid var(--border)",
      fontFamily: "var(--font-mono)",
    },
    ".cm-activeLineGutter": {
      backgroundColor: "var(--accent-subtle)",
    },
    ".cm-scroller": {
      overflow: "auto",
    },
    ".cm-tooltip": {
      backgroundColor: "var(--bg-surface)",
      border: "1px solid var(--border-strong)",
      borderRadius: "var(--radius)",
      boxShadow: "var(--shadow-lg)",
    },
    ".cm-tooltip-autocomplete ul li": {
      fontFamily: "var(--font-ui)",
      fontSize: "13px",
    },
    ".cm-tooltip-autocomplete ul li[aria-selected]": {
      backgroundColor: "var(--accent-subtle)",
      color: "var(--text-primary)",
    },
  },
  { dark: true },
);

export const docMdHighlightStyle = syntaxHighlighting(
  HighlightStyle.define([
    { tag: tags.heading1, color: "var(--heading-1)", fontWeight: "bold", fontSize: "1.6em" },
    { tag: tags.heading2, color: "var(--heading-2)", fontWeight: "bold", fontSize: "1.4em" },
    { tag: tags.heading3, color: "var(--heading-3)", fontWeight: "bold", fontSize: "1.2em" },
    { tag: tags.heading4, color: "var(--accent)", fontWeight: "bold" },
    { tag: tags.heading5, color: "var(--accent)", fontWeight: "bold" },
    { tag: tags.heading6, color: "var(--accent)", fontWeight: "bold" },
    { tag: tags.strong, fontWeight: "bold", color: "var(--strong)" },
    { tag: tags.emphasis, fontStyle: "italic", color: "var(--em)" },
    { tag: tags.strikethrough, textDecoration: "line-through", color: "var(--text-secondary)" },
    { tag: tags.link, color: "var(--accent)", textDecoration: "underline" },
    { tag: tags.url, color: "var(--accent)" },
    { tag: tags.quote, color: "var(--text-secondary)", fontStyle: "italic" },
    { tag: tags.monospace, color: "var(--accent)", fontFamily: "var(--font-mono)" },
    { tag: tags.meta, color: "var(--text-secondary)" },
    { tag: tags.comment, color: "var(--text-secondary)" },
    { tag: tags.processingInstruction, color: "var(--accent)" },
  ]),
);
