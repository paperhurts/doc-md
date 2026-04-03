/**
 * Wikilink autocomplete: typing [[ shows fuzzy note name suggestions.
 */

import {
  autocompletion,
  type CompletionContext,
  type CompletionResult,
} from "@codemirror/autocomplete";
import type { Extension } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { linkIndex } from "../services/indexer";

function wikilinkCompletions(context: CompletionContext): CompletionResult | null {
  // Match [[ followed by any text (the query)
  const match = context.matchBefore(/\[\[([^\]]*)/);
  if (!match) return null;

  const query = match.text.slice(2).toLowerCase(); // strip [[
  const noteNames = linkIndex.getAllNoteNames();

  const options = noteNames
    .filter((n) => n.name.includes(query))
    .slice(0, 20)
    .map((n) => {
      const parts = n.path.replace(/\\/g, "/").split("/");
      const fileName = parts[parts.length - 1] ?? "";
      const label = fileName.replace(/\.(md|markdown)$/, "");
      return {
        label,
        detail: parts.slice(-2, -1).join("/"),
        apply: (view: EditorView, completion: any, from: number, to: number) => {
          // Check how many ]] already exist after the cursor
          const after = view.state.doc.sliceString(to, Math.min(to + 4, view.state.doc.length));
          let closingToConsume = 0;
          if (after.startsWith("]]")) closingToConsume = 2;
          else if (after.startsWith("]")) closingToConsume = 1;

          view.dispatch({
            changes: { from: match!.from, to: to + closingToConsume, insert: `[[${label}]]` },
            selection: { anchor: match!.from + label.length + 4 }, // after ]]
          });
        },
      };
    });

  return {
    from: match.from + 2, // position after [[
    options,
    filter: false,
  };
}

export const wikilinkAutocomplete: Extension = autocompletion({
  override: [wikilinkCompletions],
  activateOnTyping: true,
});
