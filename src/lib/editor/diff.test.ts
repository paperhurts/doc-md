import { describe, it, expect } from "vitest";
import { minimalChange, isPureAppend } from "./diff";

function apply(text: string, c: { from: number; to: number; insert: string }): string {
  return text.slice(0, c.from) + c.insert + text.slice(c.to);
}

describe("minimalChange", () => {
  it("returns null for identical text", () => {
    expect(minimalChange("abc", "abc")).toBeNull();
    expect(minimalChange("", "")).toBeNull();
  });

  it("append is a tail-only change (keeps earlier positions stable)", () => {
    const c = minimalChange("# T\n\nline\n", "# T\n\nline\n- new entry\n")!;
    expect(c.from).toBe(10);
    expect(c.to).toBe(10);
    expect(c.insert).toBe("- new entry\n");
  });

  it("roundtrips arbitrary edits", () => {
    const cases: [string, string][] = [
      ["hello world", "hello brave world"],
      ["hello world", "world"],
      ["abc", "xyz"],
      ["", "content"],
      ["content", ""],
      ["aaa", "aaaa"], // repeated chars: overlapping prefix/suffix must not double-count
      ["aaaa", "aaa"],
      ["line1\nline2\nline3", "line1\nLINE2\nline3"],
    ];
    for (const [oldText, newText] of cases) {
      const c = minimalChange(oldText, newText)!;
      expect(apply(oldText, c)).toBe(newText);
      expect(c.from).toBeLessThanOrEqual(c.to);
      expect(c.to).toBeLessThanOrEqual(oldText.length);
    }
  });

  it("middle change does not touch prefix or suffix", () => {
    const c = minimalChange("keep MIDDLE keep", "keep other keep")!;
    expect(c.from).toBe(5);
    expect(c.insert).toBe("other");
    expect(apply("keep MIDDLE keep", c)).toBe("keep other keep");
  });
});

describe("isPureAppend", () => {
  const doc = "## Transcript\n- [00:00:01] [audio] hello\n";

  it("recognizes a transcript-line append", () => {
    const c = minimalChange(doc, doc + "- [00:00:05] [me] hi\n")!;
    expect(isPureAppend(c, doc.length)).toBe(true);
  });

  it("rejects an insert in the middle", () => {
    const c = minimalChange(doc, doc.replace("hello", "hello there"))!;
    expect(isPureAppend(c, doc.length)).toBe(false);
  });

  it("rejects a replacement (tab-switch shape)", () => {
    const c = minimalChange(doc, "# A completely different note\n")!;
    expect(isPureAppend(c, doc.length)).toBe(false);
  });

  it("rejects a deletion at the end", () => {
    const c = minimalChange(doc, doc.slice(0, -10))!;
    expect(isPureAppend(c, doc.length)).toBe(false);
  });

  it("rejects an empty insert", () => {
    expect(isPureAppend({ from: 5, to: 5, insert: "" }, 5)).toBe(false);
  });
});
