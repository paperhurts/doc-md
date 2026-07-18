import { describe, it, expect } from "vitest";
import { EditorState, EditorSelection } from "@codemirror/state";
import { markdown, markdownLanguage } from "@codemirror/lang-markdown";
import { ensureSyntaxTree } from "@codemirror/language";
import { computeLivePreviewDecorations } from "./livepreview";

function makeState(doc: string, cursor = doc.length): EditorState {
  const state = EditorState.create({
    doc,
    selection: EditorSelection.cursor(Math.min(cursor, doc.length)),
    extensions: [markdown({ base: markdownLanguage })],
  });
  // Force a full parse so decorations see the whole tree
  ensureSyntaxTree(state, doc.length, 5000);
  return state;
}

/** Hidden (replaced, no widget) ranges as substrings of the doc. */
function hiddenText(doc: string, cursor?: number): string[] {
  const state = makeState(doc, cursor);
  return computeLivePreviewDecorations(state, 0, doc.length)
    .filter((r) => !(r.value.spec as { widget?: unknown }).widget && r.value.spec.class === undefined)
    .map((r) => doc.slice(r.from, r.to));
}

function widgets(doc: string, cursor?: number) {
  const state = makeState(doc, cursor);
  return computeLivePreviewDecorations(state, 0, doc.length).filter(
    (r) => (r.value.spec as { widget?: unknown }).widget,
  );
}

describe("live preview decorations", () => {
  it("hides heading marks including trailing space", () => {
    // Cursor at end = line 2, so line 1 is inactive
    const doc = "# Title\ntext";
    expect(hiddenText(doc)).toContain("# ");
  });

  it("hides bold and italic marks", () => {
    const doc = "some **bold** and *em* here\nnext";
    const hidden = hiddenText(doc);
    expect(hidden.filter((h) => h === "**")).toHaveLength(2);
    expect(hidden.filter((h) => h === "*")).toHaveLength(2);
  });

  it("hides inline code marks but not fenced code marks", () => {
    const doc = "uses `code` span\n\n```js\nlet x = 1\n```\nend";
    const hidden = hiddenText(doc);
    expect(hidden.filter((h) => h === "`")).toHaveLength(2);
    expect(hidden.filter((h) => h === "```")).toHaveLength(0);
  });

  it("hides strikethrough marks", () => {
    const doc = "a ~~gone~~ b\nnext";
    expect(hiddenText(doc).filter((h) => h === "~~")).toHaveLength(2);
  });

  it("hides link brackets and URL, keeps text", () => {
    const doc = "see [site](https://x.com) ok\nnext";
    const hidden = hiddenText(doc).join("");
    expect(hidden).toContain("https://x.com");
    expect(hidden).not.toContain("site");
  });

  it("hides wikilink brackets", () => {
    const doc = "go to [[Other Note]] now\nnext";
    const hidden = hiddenText(doc);
    expect(hidden).toContain("[[");
    expect(hidden).toContain("]]");
  });

  it("shows alias only for aliased wikilinks", () => {
    const doc = "go to [[Target|Alias]] now\nnext";
    const hidden = hiddenText(doc).join("");
    expect(hidden).toContain("Target");
    expect(hidden).not.toContain("Alias");
  });

  it("renders task markers as checkbox widgets", () => {
    const doc = "- [ ] todo\n- [x] done\nnext";
    const ws = widgets(doc, doc.length);
    // 2 checkboxes (bullet marks for task items are hidden, not widgets)
    expect(ws.length).toBe(2);
  });

  it("renders plain bullets as bullet widgets", () => {
    const doc = "- item one\n- item two\nnext";
    expect(widgets(doc).length).toBe(2);
  });

  it("reveals syntax on the active line", () => {
    const doc = "# Title\ntext";
    // Cursor on line 1 -> nothing hidden there
    expect(hiddenText(doc, 2)).not.toContain("# ");
  });

  it("keeps other lines formatted while one line is active", () => {
    const doc = "# One\n\n**bold** line\n";
    // Cursor on the bold line: heading still hidden, bold marks revealed
    const hidden = hiddenText(doc, doc.indexOf("bold"));
    expect(hidden).toContain("# ");
    expect(hidden.filter((h) => h === "**")).toHaveLength(0);
  });

  it("hides blockquote marks and adds quote line class", () => {
    const doc = "> quoted text\nnext";
    const state = makeState(doc);
    const decos = computeLivePreviewDecorations(state, 0, doc.length);
    expect(decos.some((r) => r.value.spec.class === "cm-lp-quote")).toBe(true);
    expect(hiddenText(doc)).toContain("> ");
  });

  it("replaces horizontal rules with a widget", () => {
    const doc = "a\n\n---\n\nb";
    expect(widgets(doc, 0).length).toBe(1);
  });

  it("returns sorted, non-crashing ranges for a complex document", () => {
    const doc = [
      "# Big",
      "",
      "**bold** *em* `code` ~~strike~~ [l](http://a.b) [[W]]",
      "",
      "- [ ] task",
      "- bullet",
      "",
      "> quote",
      "",
      "---",
    ].join("\n");
    const decos = computeLivePreviewDecorations(makeState(doc), 0, doc.length);
    expect(decos.length).toBeGreaterThan(10);
    for (let i = 1; i < decos.length; i++) {
      expect(decos[i].from).toBeGreaterThanOrEqual(decos[i - 1].from);
    }
  });
});
