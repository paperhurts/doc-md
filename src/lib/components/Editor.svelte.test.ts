// @vitest-environment jsdom
import { describe, it, expect, beforeAll } from "vitest";
import { mount, unmount, flushSync, tick } from "svelte";
import Editor from "./Editor.svelte";

// CodeMirror needs layout APIs jsdom doesn't implement
beforeAll(() => {
  if (!Range.prototype.getClientRects) {
    Range.prototype.getClientRects = () => ({ length: 0, item: () => null }) as unknown as DOMRectList;
    Range.prototype.getBoundingClientRect = () =>
      ({ x: 0, y: 0, top: 0, left: 0, right: 0, bottom: 0, width: 0, height: 0 }) as DOMRect;
  }
  if (!("ResizeObserver" in globalThis)) {
    (globalThis as Record<string, unknown>).ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
  }
});

function editorText(target: HTMLElement): string {
  return (target.querySelector(".cm-content") as HTMLElement).textContent ?? "";
}

describe("Editor view-mode switching", () => {
  it("keeps edits (content prop updates) when livePreview toggles", async () => {
    // Regression: the creation $effect used to track `livePreview`, so a mode
    // switch destroyed the view and rebuilt it from the content the file was
    // FIRST opened with — silently reverting every edit made since. The next
    // keystroke then wrote the stale text back into the store: data loss.
    const target = document.createElement("div");
    document.body.appendChild(target);
    const props = $state({ content: "hello", livePreview: false });
    const app = mount(Editor, { target, props });
    flushSync();
    await tick();
    expect(editorText(target)).toContain("hello");

    // Simulate an edit arriving via the content prop (store round-trip)
    props.content = "hello EDITED";
    flushSync();
    await tick();
    expect(editorText(target)).toContain("EDITED");

    // Mode switch must not recreate the editor from the original content
    props.livePreview = true;
    flushSync();
    await tick();
    expect(editorText(target)).toContain("EDITED");

    props.livePreview = false;
    flushSync();
    await tick();
    expect(editorText(target)).toContain("EDITED");

    await unmount(app);
    target.remove();
  });
});
