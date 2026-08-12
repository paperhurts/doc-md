import { describe, it, expect, afterEach } from "vitest";
import { clampZoom, zoomKeyAction, applyUiZoom, MIN_ZOOM, MAX_ZOOM } from "./zoom";

type KeyLike = Parameters<typeof zoomKeyAction>[0];

function key(partial: Partial<KeyLike>): KeyLike {
  return { key: "", code: "", ctrlKey: false, metaKey: false, altKey: false, ...partial };
}

describe("clampZoom", () => {
  it("clamps to bounds", () => {
    expect(clampZoom(0.4)).toBe(MIN_ZOOM);
    expect(clampZoom(2.1)).toBe(MAX_ZOOM);
    expect(clampZoom(9)).toBe(MAX_ZOOM);
  });

  it("rounds float drift to one decimal", () => {
    expect(clampZoom(1.2000000000000002)).toBe(1.2);
    expect(clampZoom(0.7999999999999999)).toBe(0.8);
  });

  it("falls back to 1 on non-finite input", () => {
    expect(clampZoom(NaN)).toBe(1);
    expect(clampZoom(Infinity)).toBe(1);
    expect(clampZoom(-Infinity)).toBe(1);
  });

  it("passes through in-range values", () => {
    expect(clampZoom(1)).toBe(1);
    expect(clampZoom(1.5)).toBe(1.5);
  });
});

describe("zoomKeyAction", () => {
  it("maps zoom-in keys", () => {
    expect(zoomKeyAction(key({ ctrlKey: true, key: "=" }))).toBe("in");
    expect(zoomKeyAction(key({ ctrlKey: true, key: "+" }))).toBe("in"); // Ctrl+Shift+=
    expect(zoomKeyAction(key({ ctrlKey: true, code: "NumpadAdd", key: "+" }))).toBe("in");
    expect(zoomKeyAction(key({ metaKey: true, key: "=" }))).toBe("in");
  });

  it("maps zoom-out keys", () => {
    expect(zoomKeyAction(key({ ctrlKey: true, key: "-" }))).toBe("out");
    expect(zoomKeyAction(key({ ctrlKey: true, key: "_" }))).toBe("out");
    expect(zoomKeyAction(key({ ctrlKey: true, code: "NumpadSubtract", key: "-" }))).toBe("out");
  });

  it("maps reset keys", () => {
    expect(zoomKeyAction(key({ ctrlKey: true, key: "0" }))).toBe("reset");
    expect(zoomKeyAction(key({ ctrlKey: true, code: "Numpad0", key: "0" }))).toBe("reset");
  });

  it("ignores non-zoom combos", () => {
    expect(zoomKeyAction(key({ key: "=" }))).toBeNull(); // no modifier
    expect(zoomKeyAction(key({ ctrlKey: true, altKey: true, key: "=" }))).toBeNull(); // AltGr guard
    expect(zoomKeyAction(key({ ctrlKey: true, key: "k" }))).toBeNull();
  });
});

describe("applyUiZoom (browser fallback)", () => {
  afterEach(() => {
    document.documentElement.style.removeProperty("--ui-zoom");
  });

  it("sets the --ui-zoom CSS var outside Tauri", async () => {
    await applyUiZoom(1.5);
    expect(document.documentElement.style.getPropertyValue("--ui-zoom")).toBe("1.5");
  });

  it("clamps out-of-range input", async () => {
    await applyUiZoom(3);
    expect(document.documentElement.style.getPropertyValue("--ui-zoom")).toBe("2");
  });
});
