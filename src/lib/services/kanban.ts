/**
 * Markdown-backed kanban boards.
 *
 * A board is a normal note with `kanban: true` in its frontmatter:
 * `## headings` are columns, `- [ ]` / `- [x]` items are cards. Everything
 * else (frontmatter, prose, blank lines) is preserved verbatim, so boards
 * stay diffable, editable as text, and shareable through file sync
 * (see docs/COLLABORATION.md and issue #21).
 */

export interface KanbanCard {
  kind: "card";
  id: string;
  text: string;
  done: boolean;
}

/** A non-card line inside a column section, preserved verbatim. */
export interface KanbanRaw {
  kind: "raw";
  line: string;
}

export type KanbanItem = KanbanCard | KanbanRaw;

export interface KanbanColumn {
  id: string;
  title: string;
  items: KanbanItem[];
}

export interface KanbanBoard {
  /** Lines before the first `## ` heading (frontmatter, title, prose). */
  preamble: string[];
  columns: KanbanColumn[];
}

const CARD_RE = /^- \[( |x|X)\] (.*)$/;
const COLUMN_RE = /^## (.*)$/;

/** True when the note's frontmatter contains `kanban: true`. */
export function isKanbanContent(content: string): boolean {
  if (!content.startsWith("---")) return false;
  const end = content.indexOf("\n---", 3);
  if (end === -1) return false;
  const frontmatter = content.slice(3, end);
  return /^\s*kanban\s*:\s*true\s*$/m.test(frontmatter);
}

let nextId = 0;
function freshId(prefix: string): string {
  return `${prefix}-${nextId++}`;
}

export function parseKanban(content: string): KanbanBoard {
  const lines = content.split("\n");
  const board: KanbanBoard = { preamble: [], columns: [] };
  let column: KanbanColumn | null = null;

  for (const line of lines) {
    const colMatch = COLUMN_RE.exec(line);
    if (colMatch) {
      column = { id: freshId("col"), title: colMatch[1].trim(), items: [] };
      board.columns.push(column);
      continue;
    }
    if (!column) {
      board.preamble.push(line);
      continue;
    }
    const cardMatch = CARD_RE.exec(line);
    if (cardMatch) {
      column.items.push({
        kind: "card",
        id: freshId("card"),
        text: cardMatch[2],
        done: cardMatch[1].toLowerCase() === "x",
      });
    } else {
      column.items.push({ kind: "raw", line });
    }
  }
  return board;
}

export function serializeKanban(board: KanbanBoard): string {
  const out: string[] = [...board.preamble];
  for (const col of board.columns) {
    out.push(`## ${col.title}`);
    for (const item of col.items) {
      out.push(item.kind === "card" ? `- [${item.done ? "x" : " "}] ${item.text}` : item.line);
    }
  }
  return out.join("\n");
}

export function cardsOf(col: KanbanColumn): KanbanCard[] {
  return col.items.filter((i): i is KanbanCard => i.kind === "card");
}

/** Items index where a card at cards-position `cardIdx` should be inserted. */
function itemsIndexForCardPosition(col: KanbanColumn, cardIdx: number): number {
  let seen = 0;
  for (let i = 0; i < col.items.length; i++) {
    if (col.items[i].kind === "card") {
      if (seen === cardIdx) return i;
      seen++;
    }
  }
  // Past the last card: insert after the last card, or after leading blank
  // raw lines when the column has no cards yet
  for (let i = col.items.length - 1; i >= 0; i--) {
    if (col.items[i].kind === "card") return i + 1;
  }
  let i = 0;
  while (i < col.items.length && (col.items[i] as KanbanRaw).line.trim() === "") i++;
  return i;
}

// All mutations return a new board (columns/items copied on the paths they touch).

function cloneBoard(board: KanbanBoard): KanbanBoard {
  return {
    preamble: [...board.preamble],
    columns: board.columns.map((c) => ({ ...c, items: [...c.items] })),
  };
}

export function addCard(board: KanbanBoard, colIdx: number, text: string): KanbanBoard {
  const next = cloneBoard(board);
  const col = next.columns[colIdx];
  if (!col || !text.trim()) return board;
  const card: KanbanCard = { kind: "card", id: freshId("card"), text: text.trim(), done: false };
  col.items.splice(itemsIndexForCardPosition(col, Number.MAX_SAFE_INTEGER), 0, card);
  return next;
}

export function updateCard(
  board: KanbanBoard,
  colIdx: number,
  cardId: string,
  patch: Partial<Pick<KanbanCard, "text" | "done">>,
): KanbanBoard {
  const next = cloneBoard(board);
  const col = next.columns[colIdx];
  if (!col) return board;
  const idx = col.items.findIndex((i) => i.kind === "card" && i.id === cardId);
  if (idx === -1) return board;
  col.items[idx] = { ...(col.items[idx] as KanbanCard), ...patch };
  return next;
}

export function deleteCard(board: KanbanBoard, colIdx: number, cardId: string): KanbanBoard {
  const next = cloneBoard(board);
  const col = next.columns[colIdx];
  if (!col) return board;
  const idx = col.items.findIndex((i) => i.kind === "card" && i.id === cardId);
  if (idx === -1) return board;
  col.items.splice(idx, 1);
  return next;
}

/** Move a card to `toCardIdx` (position among cards) in the target column. */
export function moveCard(
  board: KanbanBoard,
  fromColIdx: number,
  cardId: string,
  toColIdx: number,
  toCardIdx: number,
): KanbanBoard {
  const next = cloneBoard(board);
  const from = next.columns[fromColIdx];
  const to = next.columns[toColIdx];
  if (!from || !to) return board;
  const idx = from.items.findIndex((i) => i.kind === "card" && i.id === cardId);
  if (idx === -1) return board;
  const [card] = from.items.splice(idx, 1);
  to.items.splice(itemsIndexForCardPosition(to, toCardIdx), 0, card);
  return next;
}

export function addColumn(board: KanbanBoard, title: string): KanbanBoard {
  if (!title.trim()) return board;
  const next = cloneBoard(board);
  const prev = next.columns[next.columns.length - 1];
  // Keep a blank line between sections when the previous section doesn't end with one
  if (prev) {
    const last = prev.items[prev.items.length - 1];
    if (!last || last.kind === "card" || last.line.trim() !== "") {
      prev.items.push({ kind: "raw", line: "" });
    }
  }
  next.columns.push({
    id: freshId("col"),
    title: title.trim(),
    items: [{ kind: "raw", line: "" }],
  });
  return next;
}

export function renameColumn(board: KanbanBoard, colIdx: number, title: string): KanbanBoard {
  if (!board.columns[colIdx] || !title.trim()) return board;
  const next = cloneBoard(board);
  next.columns[colIdx] = { ...next.columns[colIdx], title: title.trim() };
  return next;
}

export function deleteColumn(board: KanbanBoard, colIdx: number): KanbanBoard {
  if (!board.columns[colIdx]) return board;
  const next = cloneBoard(board);
  next.columns.splice(colIdx, 1);
  return next;
}

export function moveColumn(board: KanbanBoard, fromIdx: number, toIdx: number): KanbanBoard {
  if (
    fromIdx === toIdx ||
    !board.columns[fromIdx] ||
    toIdx < 0 ||
    toIdx >= board.columns.length
  ) {
    return board;
  }
  const next = cloneBoard(board);
  const [col] = next.columns.splice(fromIdx, 1);
  next.columns.splice(toIdx, 0, col);
  return next;
}

/** Template for a fresh board note ({{title}} is filled by applyTemplate). */
export const KANBAN_TEMPLATE = `---
kanban: true
---

# {{title}}

## To Do

## Doing

## Done
`;
