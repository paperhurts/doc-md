/**
 * Wikilink autocomplete: typing [[ shows fuzzy note name suggestions.
 */

import {
  autocompletion,
  type CompletionContext,
  type CompletionResult,
} from "@codemirror/autocomplete";
import type { Extension } from "@codemirror/state";
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
        // Only insert the name + closing brackets; from is set after [[
        apply: `${label}]]`,
        detail: parts.slice(-2, -1).join("/"),
      };
    });

  return {
    from: match.from + 2, // start after the [[ so we don't duplicate it
    options,
    filter: false,
  };
}

export const wikilinkAutocomplete: Extension = autocompletion({
  override: [wikilinkCompletions],
  activateOnTyping: true,
});
