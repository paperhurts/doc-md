/**
 * Minimal single-span text diff for syncing external content into a live
 * CodeMirror view. Replacing only the changed span (instead of the whole
 * document) lets CM map the cursor through the change and keeps the scroll
 * position — so transcript appends and watcher refreshes no longer yank the
 * user to the top of the file.
 */
export interface SpanChange {
  from: number;
  to: number;
  insert: string;
}

/** The smallest single {from,to,insert} turning `oldText` into `newText`,
 * or null when they are identical. */
export function minimalChange(oldText: string, newText: string): SpanChange | null {
  if (oldText === newText) return null;

  let start = 0;
  const minLen = Math.min(oldText.length, newText.length);
  while (start < minLen && oldText[start] === newText[start]) start++;

  let endOld = oldText.length;
  let endNew = newText.length;
  while (endOld > start && endNew > start && oldText[endOld - 1] === newText[endNew - 1]) {
    endOld--;
    endNew--;
  }

  return { from: start, to: endOld, insert: newText.slice(start, endNew) };
}
