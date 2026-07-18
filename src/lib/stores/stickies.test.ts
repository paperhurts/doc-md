import { describe, it, expect, beforeEach } from "vitest";
import { stickyStore, stickyLabel, labelForPath } from "./stickies.svelte";

const NOTE = "C:\\demo-vault\\Welcome.md";
const OTHER = "C:\\demo-vault\\Ideas.md";

describe("sticky store", () => {
  beforeEach(() => {
    localStorage.clear();
    stickyStore.notes = [];
    stickyStore.visible = true;
  });

  it("derives stable window labels", () => {
    expect(stickyLabel(NOTE)).toBe(stickyLabel(NOTE));
    expect(stickyLabel(NOTE)).not.toBe(stickyLabel(OTHER));
    expect(stickyLabel(NOTE)).toMatch(/^sticky-[0-9a-f]+$/);
  });

  it("derives display labels from paths", () => {
    expect(labelForPath(NOTE)).toBe("Welcome");
    expect(labelForPath("/unix/path/Note Name.markdown")).toBe("Note Name");
  });

  it("adds a sticky and persists it", () => {
    stickyStore.add(NOTE);
    expect(stickyStore.isSticky(NOTE)).toBe(true);
    const raw = JSON.parse(localStorage.getItem("doc-md-stickies")!);
    expect(raw.notes).toHaveLength(1);
    expect(raw.notes[0].path).toBe(NOTE);
    expect(raw.notes[0].label).toBe("Welcome");
  });

  it("add is idempotent", () => {
    stickyStore.add(NOTE);
    stickyStore.add(NOTE);
    expect(stickyStore.notes).toHaveLength(1);
  });

  it("removes a sticky", () => {
    stickyStore.add(NOTE);
    stickyStore.add(OTHER);
    stickyStore.remove(NOTE);
    expect(stickyStore.isSticky(NOTE)).toBe(false);
    expect(stickyStore.isSticky(OTHER)).toBe(true);
  });

  it("updates geometry for a sticky", () => {
    stickyStore.add(NOTE);
    stickyStore.updateGeometry(NOTE, { x: 10, y: 20, width: 300, height: 250 });
    expect(stickyStore.get(NOTE)).toMatchObject({ x: 10, y: 20, width: 300, height: 250 });
    // ignored for unknown paths
    stickyStore.updateGeometry("C:\\nope.md", { x: 1 });
    expect(stickyStore.get("C:\\nope.md")).toBeUndefined();
  });

  it("toggles global visibility and persists it", () => {
    expect(stickyStore.toggleVisible()).toBe(false);
    expect(JSON.parse(localStorage.getItem("doc-md-stickies")!).visible).toBe(false);
    expect(stickyStore.toggleVisible()).toBe(true);
  });

  it("init restores persisted state", () => {
    localStorage.setItem(
      "doc-md-stickies",
      JSON.stringify({ notes: [{ path: NOTE, label: "Welcome", x: 5 }], visible: false }),
    );
    stickyStore.init();
    expect(stickyStore.notes).toHaveLength(1);
    expect(stickyStore.notes[0].x).toBe(5);
    expect(stickyStore.visible).toBe(false);
  });

  it("init survives corrupted storage", () => {
    localStorage.setItem("doc-md-stickies", "{not json");
    stickyStore.init();
    expect(stickyStore.notes).toEqual([]);
    expect(stickyStore.visible).toBe(true);
  });
});
