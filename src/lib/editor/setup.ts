import {
  keymap,
  highlightActiveLine,
  lineNumbers,
  highlightActiveLineGutter,
  EditorView,
} from "@codemirror/view";
import { defaultKeymap, history, historyKeymap, indentWithTab } from "@codemirror/commands";
import { markdown, markdownLanguage } from "@codemirror/lang-markdown";
import { languages } from "@codemirror/language-data";
import { bracketMatching, indentOnInput } from "@codemirror/language";
import { closeBrackets, closeBracketsKeymap } from "@codemirror/autocomplete";
import { searchKeymap, highlightSelectionMatches } from "@codemirror/search";
import type { Extension } from "@codemirror/state";

import { docMdTheme, docMdHighlightStyle } from "./theme";
import { wikilinkPlugin } from "./wikilink";
import { wikilinkAutocomplete } from "./autocomplete";
import { createSelectionPlugin, createFormattingKeymap, type SelectionInfo } from "./toolbar";

export function createEditorExtensions(
  onUpdate?: (content: string) => void,
  onNavigate?: (noteName: string) => void,
  onSelectionChange?: (info: SelectionInfo) => void,
): Extension[] {
  const extensions: Extension[] = [
    lineNumbers(),
    highlightActiveLine(),
    highlightActiveLineGutter(),
    history(),
    indentOnInput(),
    bracketMatching(),
    closeBrackets(),
    highlightSelectionMatches(),
    EditorView.lineWrapping,
    markdown({ base: markdownLanguage, codeLanguages: languages }),
    docMdTheme,
    docMdHighlightStyle,
    wikilinkPlugin,
    wikilinkAutocomplete,
    keymap.of([
      ...defaultKeymap,
      ...historyKeymap,
      ...closeBracketsKeymap,
      ...searchKeymap,
      indentWithTab,
    ]),
  ];

  if (onUpdate) {
    extensions.push(
      EditorView.updateListener.of((update) => {
        if (update.docChanged) {
          onUpdate(update.state.doc.toString());
        }
      }),
    );
  }

  // Ctrl+Click on wikilinks to navigate
  if (onNavigate) {
    extensions.push(
      EditorView.domEventHandlers({
        click(event, view) {
          if (!(event.ctrlKey || event.metaKey)) return false;
          const pos = view.posAtCoords({ x: event.clientX, y: event.clientY });
          if (pos === null) return false;
          const line = view.state.doc.lineAt(pos);
          const WIKILINK = /\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/g;
          let match;
          while ((match = WIKILINK.exec(line.text)) !== null) {
            const from = line.from + match.index;
            const to = from + match[0].length;
            if (pos >= from && pos <= to) {
              event.preventDefault();
              onNavigate(match[1]);
              return true;
            }
          }
          return false;
        },
      }),
    );
  }

  // Selection tracking + formatting keyboard shortcuts
  if (onSelectionChange) {
    extensions.push(createSelectionPlugin(onSelectionChange));
    extensions.push(createFormattingKeymap());
  }

  return extensions;
}
