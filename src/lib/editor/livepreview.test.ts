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

function widgets(doc: string, cursor?: number, resolveImage?: (src: string) => string | null) {
  const state = makeState(doc, cursor);
  return computeLivePreviewDecorations(state, 0, doc.length, { resolveImage }).filter(
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

  it("hides inline code marks", () => {
    const doc = "uses `code` span\nnext";
    expect(hiddenText(doc).filter((h) => h === "`")).toHaveLength(2);
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

  it("renders an empty task item (no trailing text) as a checkbox", () => {
    // The daily template emits "- [ ]" with nothing after it. The parser
    // produces no TaskMarker for it, so the naive peek-at-"[" bullet hiding
    // left an orphaned raw "[ ]" with no bullet and no checkbox.
    const doc = "- [ ]\nnext";
    const ws = widgets(doc, doc.length);
    expect(ws.length).toBe(1);
    const covered = doc.slice(ws[0].from, ws[0].to);
    expect(covered).toContain("[ ]");
  });

  it("replaces images with an image widget using the resolved src", () => {
    const doc = "![shot](attachments/pic.png)\nnext";
    const ws = widgets(doc, doc.length, (src) => `mock://${src}`);
    expect(ws.length).toBe(1);
    expect(doc.slice(ws[0].from, ws[0].to)).toBe("![shot](attachments/pic.png)");
    expect((ws[0].value.spec.widget as { src?: string }).src).toBe("mock://attachments/pic.png");
  });

  it("leaves image source visible when the src cannot be resolved", () => {
    const doc = "![shot](../outside.png)\nnext";
    expect(widgets(doc, doc.length, () => null).length).toBe(0);
  });

  it("leaves image source visible when no resolver is provided", () => {
    const doc = "![shot](attachments/pic.png)\nnext";
    expect(widgets(doc, doc.length).length).toBe(0);
  });

  it("reveals image source on the active line", () => {
    const doc = "![shot](attachments/pic.png)\nnext";
    expect(widgets(doc, 2, (src) => `mock://${src}`).length).toBe(0);
  });

  it("hides fenced code marks on inactive lines and styles the block", () => {
    const doc = "```js\nlet x = 1\n```\nend";
    const state = makeState(doc); // cursor on "end"
    const decos = computeLivePreviewDecorations(state, 0, doc.length);
    const hidden = decos
      .filter((r) => !(r.value.spec as { widget?: unknown }).widget && r.value.spec.class === undefined)
      .map((r) => doc.slice(r.from, r.to));
    expect(hidden).toContain("```js");
    expect(hidden).toContain("```");
    expect(decos.filter((r) => r.value.spec.class === "cm-lp-code").length).toBe(3);
  });

  it("reveals fence marks while the cursor is inside the code block", () => {
    const doc = "```js\nlet x = 1\n```\nend";
    // Cursor on the fence line itself
    expect(hiddenText(doc, 1).filter((h) => h.startsWith("```"))).toHaveLength(1);
    // Cursor on the code line: both fences stay hidden (only active line reveals)
    expect(hiddenText(doc, doc.indexOf("let")).filter((h) => h.startsWith("```"))).toHaveLength(2);
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
