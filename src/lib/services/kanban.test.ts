import { describe, it, expect } from "vitest";
import {
  parseKanban,
  serializeKanban,
  isKanbanContent,
  cardsOf,
  addCard,
  updateCard,
  deleteCard,
  moveCard,
  addColumn,
  renameColumn,
  deleteColumn,
  moveColumn,
  KANBAN_TEMPLATE,
} from "./kanban";
import { applyTemplate, getTemplateVars } from "./templates";

const BOARD = `---
kanban: true
---

# My Board

Some intro prose.

## To Do

- [ ] First task
- [ ] Second task

## Doing

- [ ] Active task

## Done

- [x] Finished task
`;

describe("kanban detection", () => {
  it("detects kanban frontmatter", () => {
    expect(isKanbanContent(BOARD)).toBe(true);
  });

  it("rejects notes without kanban frontmatter", () => {
    expect(isKanbanContent("# Plain note\n")).toBe(false);
    expect(isKanbanContent("---\ntags: [a]\n---\n# Note")).toBe(false);
    expect(isKanbanContent("kanban: true")).toBe(false); // no frontmatter block
  });
});

describe("kanban parse/serialize", () => {
  it("round-trips losslessly", () => {
    expect(serializeKanban(parseKanban(BOARD))).toBe(BOARD);
  });

  it("round-trips content with prose inside columns", () => {
    const doc = `## Col

note under column

- [ ] card
trailing prose
`;
    expect(serializeKanban(parseKanban(doc))).toBe(doc);
  });

  it("parses columns and cards", () => {
    const board = parseKanban(BOARD);
    expect(board.columns.map((c) => c.title)).toEqual(["To Do", "Doing", "Done"]);
    expect(cardsOf(board.columns[0]).map((c) => c.text)).toEqual(["First task", "Second task"]);
    expect(cardsOf(board.columns[2])[0].done).toBe(true);
  });

  it("keeps preamble verbatim", () => {
    const board = parseKanban(BOARD);
    expect(board.preamble.join("\n")).toContain("kanban: true");
    expect(board.preamble.join("\n")).toContain("# My Board");
  });

  it("template produces a valid empty board", () => {
    const content = applyTemplate(KANBAN_TEMPLATE, getTemplateVars("Sprint 1"));
    expect(isKanbanContent(content)).toBe(true);
    const board = parseKanban(content);
    expect(board.columns.map((c) => c.title)).toEqual(["To Do", "Doing", "Done"]);
    expect(content).toContain("# Sprint 1");
  });
});

describe("kanban mutations", () => {
  it("adds a card at the end of a column's cards", () => {
    const board = addCard(parseKanban(BOARD), 0, "Third task");
    expect(cardsOf(board.columns[0]).map((c) => c.text)).toEqual([
      "First task",
      "Second task",
      "Third task",
    ]);
    // serialized form puts it right after the other cards
    expect(serializeKanban(board)).toContain("- [ ] Second task\n- [ ] Third task");
  });

  it("adds a card to an empty column after leading blank", () => {
    const board = addCard(parseKanban("## Empty\n\n## Next\n"), 0, "New");
    expect(serializeKanban(board)).toBe("## Empty\n\n- [ ] New\n## Next\n");
  });

  it("ignores blank card text", () => {
    const board = parseKanban(BOARD);
    expect(addCard(board, 0, "   ")).toBe(board);
  });

  it("toggles done state", () => {
    let board = parseKanban(BOARD);
    const card = cardsOf(board.columns[0])[0];
    board = updateCard(board, 0, card.id, { done: true });
    expect(serializeKanban(board)).toContain("- [x] First task");
  });

  it("edits card text", () => {
    let board = parseKanban(BOARD);
    const card = cardsOf(board.columns[0])[0];
    board = updateCard(board, 0, card.id, { text: "Renamed" });
    expect(cardsOf(board.columns[0])[0].text).toBe("Renamed");
  });

  it("deletes a card", () => {
    let board = parseKanban(BOARD);
    const card = cardsOf(board.columns[0])[0];
    board = deleteCard(board, 0, card.id);
    expect(cardsOf(board.columns[0]).map((c) => c.text)).toEqual(["Second task"]);
  });

  it("moves a card between columns", () => {
    let board = parseKanban(BOARD);
    const card = cardsOf(board.columns[0])[0];
    board = moveCard(board, 0, card.id, 1, 0);
    expect(cardsOf(board.columns[0]).map((c) => c.text)).toEqual(["Second task"]);
    expect(cardsOf(board.columns[1]).map((c) => c.text)).toEqual(["First task", "Active task"]);
  });

  it("moves a card within a column", () => {
    let board = parseKanban(BOARD);
    const card = cardsOf(board.columns[0])[0];
    board = moveCard(board, 0, card.id, 0, 1);
    expect(cardsOf(board.columns[0]).map((c) => c.text)).toEqual(["Second task", "First task"]);
  });

  it("move keeps the file round-trippable", () => {
    let board = parseKanban(BOARD);
    const card = cardsOf(board.columns[0])[1];
    board = moveCard(board, 0, card.id, 2, 0);
    const reparsed = parseKanban(serializeKanban(board));
    expect(cardsOf(reparsed.columns[2]).map((c) => c.text)).toEqual([
      "Second task",
      "Finished task",
    ]);
  });

  it("adds, renames, deletes and reorders columns", () => {
    let board = parseKanban(BOARD);
    board = addColumn(board, "Blocked");
    expect(board.columns.map((c) => c.title)).toEqual(["To Do", "Doing", "Done", "Blocked"]);
    board = renameColumn(board, 3, "On Hold");
    expect(board.columns[3].title).toBe("On Hold");
    board = moveColumn(board, 3, 1);
    expect(board.columns.map((c) => c.title)).toEqual(["To Do", "On Hold", "Doing", "Done"]);
    board = deleteColumn(board, 1);
    expect(board.columns.map((c) => c.title)).toEqual(["To Do", "Doing", "Done"]);
    // still serializes to valid markdown
    const reparsed = parseKanban(serializeKanban(board));
    expect(reparsed.columns.map((c) => c.title)).toEqual(["To Do", "Doing", "Done"]);
  });

  it("mutations do not modify the original board", () => {
    const board = parseKanban(BOARD);
    const before = serializeKanban(board);
    addCard(board, 0, "X");
    const card = cardsOf(board.columns[0])[0];
    updateCard(board, 0, card.id, { done: true });
    deleteCard(board, 0, card.id);
    moveCard(board, 0, card.id, 1, 0);
    expect(serializeKanban(board)).toBe(before);
  });
});
