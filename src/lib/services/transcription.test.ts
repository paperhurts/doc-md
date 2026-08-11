import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  TRANSCRIPTION_TEMPLATE,
  TRANSCRIPTION_MODELS,
  isTranscriptionContent,
  enableTranscription,
  formatTranscriptLine,
  startTranscription,
  stopTranscription,
  getTranscriptionModels,
  downloadTranscriptionModel,
  _resetTranscriptionMock,
  type TranscriptLineEvent,
  type ModelProgressEvent,
} from "./transcription";
import { resetMock, listenMock } from "./mock";
import { settingsStore } from "../stores/settings.svelte";
import { applyTemplate, getTemplateVars } from "./templates";

describe("transcription note type", () => {
  it("template produces a detectable transcription note", () => {
    const content = applyTemplate(TRANSCRIPTION_TEMPLATE, getTemplateVars("Standup"));
    expect(isTranscriptionContent(content)).toBe(true);
    expect(content).toContain("# Standup");
    expect(content).toContain("## Transcript");
  });

  it("detects frontmatter variants and rejects non-transcription notes", () => {
    expect(isTranscriptionContent("---\ntranscription: true\n---\n")).toBe(true);
    expect(isTranscriptionContent("---\ntags: [a]\ntranscription: true\n---\n")).toBe(true);
    expect(isTranscriptionContent("---\ntranscription: false\n---\n")).toBe(false);
    expect(isTranscriptionContent("---\nkanban: true\n---\n")).toBe(false);
    expect(isTranscriptionContent("# Plain note\ntranscription: true")).toBe(false);
    expect(isTranscriptionContent("")).toBe(false);
  });
});

describe("enableTranscription", () => {
  it("prepends frontmatter to a plain note", () => {
    const out = enableTranscription("# My note\n\nbody");
    expect(isTranscriptionContent(out)).toBe(true);
    expect(out).toContain("# My note\n\nbody");
  });

  it("adds the flag to existing frontmatter, preserving other keys", () => {
    const out = enableTranscription("---\ntags: [a]\n---\n\n# Note");
    expect(isTranscriptionContent(out)).toBe(true);
    expect(out).toContain("tags: [a]");
    expect(out).toContain("# Note");
  });

  it("flips an explicit transcription: false instead of duplicating the key", () => {
    const out = enableTranscription("---\ntranscription: false\n---\n\nbody");
    expect(isTranscriptionContent(out)).toBe(true);
    expect(out.match(/transcription/g)).toHaveLength(1);
  });

  it("is a no-op for a note that already has the flag", () => {
    const content = "---\ntranscription: true\n---\n\nbody";
    expect(enableTranscription(content)).toBe(content);
  });
});

describe("formatTranscriptLine", () => {
  it("formats zero, sub-hour, and multi-hour timestamps", () => {
    expect(formatTranscriptLine("mic", 0, "hello")).toBe("- **[00:00:00] [me]** hello");
    expect(formatTranscriptLine("system", 61_500, " padded ")).toBe(
      "- **[00:01:01] [audio]** padded",
    );
    expect(formatTranscriptLine("mic", 3_723_000, "long meeting")).toBe(
      "- **[01:02:03] [me]** long meeting",
    );
  });
});

describe("mock transcription engine", () => {
  beforeEach(() => {
    resetMock();
    _resetTranscriptionMock();
    settingsStore.settings.transcriptionModel = "base.en";
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("lists the model catalog with nothing downloaded initially", async () => {
    const models = await getTranscriptionModels();
    expect(models.map((m) => m.id)).toEqual(TRANSCRIPTION_MODELS.map((m) => m.id));
    expect(models.every((m) => !m.downloaded)).toBe(true);
  });

  it("refuses to start when the selected model is missing", async () => {
    await expect(startTranscription(true, true)).rejects.toThrow(/not downloaded/);
  });

  it("downloads a model with progress events, then done", async () => {
    const events: ModelProgressEvent[] = [];
    listenMock("transcription-model-progress", (p) => events.push(p as ModelProgressEvent));

    await downloadTranscriptionModel("base.en");
    await vi.advanceTimersByTimeAsync(2000);

    expect(events.length).toBeGreaterThanOrEqual(2);
    const last = events[events.length - 1];
    expect(last.done).toBe(true);
    expect(last.downloaded).toBe(last.total);
    const models = await getTranscriptionModels();
    expect(models.find((m) => m.id === "base.en")!.downloaded).toBe(true);
  });

  it("streams partial-then-final lines with alternating sources, and stop halts it", async () => {
    await downloadTranscriptionModel("base.en");
    await vi.advanceTimersByTimeAsync(2000);

    const lines: TranscriptLineEvent[] = [];
    listenMock("transcription-line", (l) => lines.push(l as TranscriptLineEvent));

    await startTranscription(true, true);
    await vi.advanceTimersByTimeAsync(1200 * 8); // 4 lines: partial + final each

    const finals = lines.filter((l) => l.kind === "final");
    const partials = lines.filter((l) => l.kind === "partial");
    expect(finals.length).toBe(4);
    expect(partials.length).toBe(4);
    expect(new Set(finals.map((l) => l.source))).toEqual(new Set(["mic", "system"]));

    await stopTranscription();
    const count = lines.length;
    await vi.advanceTimersByTimeAsync(5000);
    expect(lines.length).toBe(count);
  });

  it("only emits from enabled sources", async () => {
    await downloadTranscriptionModel("base.en");
    await vi.advanceTimersByTimeAsync(2000);

    const lines: TranscriptLineEvent[] = [];
    listenMock("transcription-line", (l) => lines.push(l as TranscriptLineEvent));

    await startTranscription(false, true); // system audio only
    await vi.advanceTimersByTimeAsync(1200 * 8);
    await stopTranscription();

    expect(lines.length).toBeGreaterThan(0);
    expect(lines.every((l) => l.source === "system")).toBe(true);
  });

  it("rejects starting with no sources enabled", async () => {
    await downloadTranscriptionModel("base.en");
    await vi.advanceTimersByTimeAsync(2000);
    await expect(startTranscription(false, false)).rejects.toThrow(/No audio source/);
  });
});

describe("settings defaults", () => {
  it("includes transcription keys (backward-compatible merge)", () => {
    localStorage.setItem("doc-md-settings", JSON.stringify({ fontSize: 15 }));
    settingsStore.init();
    expect(settingsStore.settings.transcriptionModel).toBe("base.en");
    expect(settingsStore.settings.transcriptionMic).toBe(true);
    expect(settingsStore.settings.transcriptionSystem).toBe(true);
    expect(settingsStore.settings.captureHotkey).toBe("Ctrl+Shift+S");
    expect(settingsStore.settings.fontSize).toBe(15);
    localStorage.removeItem("doc-md-settings");
  });
});
