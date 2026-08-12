import { describe, it, expect, beforeEach } from "vitest";
import { settingsStore } from "./settings.svelte";

const STORAGE_KEY = "doc-md-settings";

describe("settings store — uiZoom", () => {
  beforeEach(() => {
    localStorage.clear();
    settingsStore.reset();
  });

  it("defaults to 100%", () => {
    expect(settingsStore.settings.uiZoom).toBe(1);
  });

  it("persists updates to localStorage", () => {
    settingsStore.update({ uiZoom: 1.3 });
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY)!);
    expect(raw.uiZoom).toBe(1.3);
  });

  it("back-fills uiZoom on a pre-upgrade settings blob", () => {
    // Simulate a user whose stored settings predate the zoom feature.
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ fontSize: 16 }));
    settingsStore.init();
    expect(settingsStore.settings.uiZoom).toBe(1);
    expect(settingsStore.settings.fontSize).toBe(16);
  });

  it("round-trips a stored zoom through init()", () => {
    settingsStore.update({ uiZoom: 1.5 });
    settingsStore.settings = { ...settingsStore.settings, uiZoom: 1 }; // fake a fresh window
    settingsStore.init();
    expect(settingsStore.settings.uiZoom).toBe(1.5);
  });

  it("reset() returns zoom to 100% and clears storage", () => {
    settingsStore.update({ uiZoom: 1.8 });
    settingsStore.reset();
    expect(settingsStore.settings.uiZoom).toBe(1);
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });
});
