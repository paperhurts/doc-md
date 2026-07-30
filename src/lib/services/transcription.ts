/**
 * Transcription notes: a note with `transcription: true` frontmatter gets a
 * recorder bar (TranscriptionBar.svelte) that listens to the mic and/or
 * system audio and appends timestamped transcript lines.
 *
 * The heavy lifting (audio capture, Whisper) lives in Rust and streams
 * results via events:
 *   - `transcription-line`   {source, text, tMs, kind: "partial" | "final"}
 *   - `transcription-status` {state, message?}
 *   - `transcription-model-progress` {model, downloaded, total, done?, error?}
 *
 * Outside Tauri (browser, Vitest) a mock engine emits a canned script on an
 * interval so the whole UI + append pipeline is exercisable without audio.
 */
import { invoke } from "@tauri-apps/api/core";
import { isTauri } from "./env";
import { emitMockEvent } from "./mock";
import { settingsStore } from "../stores/settings.svelte";

export type TranscriptSource = "mic" | "system";

export interface TranscriptLineEvent {
  source: TranscriptSource;
  text: string;
  /** Milliseconds since the listening session started. */
  tMs: number;
  kind: "partial" | "final";
}

export interface TranscriptionStatusEvent {
  state: "listening" | "stopped" | "error";
  message?: string;
}

export interface ModelProgressEvent {
  model: string;
  downloaded: number;
  total: number;
  done?: boolean;
  error?: string;
}

export interface ModelInfo {
  id: string;
  label: string;
  sizeMb: number;
  downloaded: boolean;
}

/** Whisper model catalog (mirrored by the Rust side in Phase 2B). */
export const TRANSCRIPTION_MODELS: { id: string; label: string; sizeMb: number }[] = [
  { id: "tiny.en", label: "Tiny (fastest)", sizeMb: 75 },
  { id: "base.en", label: "Base (recommended)", sizeMb: 142 },
  { id: "small.en", label: "Small (most accurate)", sizeMb: 466 },
];

export const TRANSCRIPTION_TEMPLATE = `---
transcription: true
---

# {{title}}

Created {{date}} {{time}}

## Transcript
`;

/** True when the note's frontmatter contains `transcription: true`. */
export function isTranscriptionContent(content: string): boolean {
  if (!content.startsWith("---")) return false;
  const end = content.indexOf("\n---", 3);
  if (end === -1) return false;
  const frontmatter = content.slice(3, end);
  return /^\s*transcription\s*:\s*true\s*$/m.test(frontmatter);
}

/** `- **[HH:MM:SS] [me]** text` — mic is "me", system audio is "audio". */
export function formatTranscriptLine(
  source: TranscriptSource,
  tMs: number,
  text: string,
): string {
  const total = Math.max(0, Math.floor(tMs / 1000));
  const pad = (n: number) => String(n).padStart(2, "0");
  const stamp = `${pad(Math.floor(total / 3600))}:${pad(Math.floor(total / 60) % 60)}:${pad(total % 60)}`;
  const label = source === "mic" ? "me" : "audio";
  return `- **[${stamp}] [${label}]** ${text.trim()}`;
}

// ---- command wrappers (mock-backed outside Tauri) -------------------------

export async function startTranscription(mic: boolean, system: boolean): Promise<void> {
  if (!isTauri()) return mockStart(mic, system);
  return await invoke("start_transcription", { mic, system });
}

export async function stopTranscription(): Promise<void> {
  if (!isTauri()) return mockStop();
  return await invoke("stop_transcription");
}

export async function getTranscriptionModels(): Promise<ModelInfo[]> {
  if (!isTauri()) return mockModels();
  return await invoke("get_transcription_models");
}

export async function downloadTranscriptionModel(model: string): Promise<void> {
  if (!isTauri()) return mockDownload(model);
  return await invoke("download_transcription_model", { model });
}

// ---- mock engine ----------------------------------------------------------

const MOCK_SCRIPT: { source: TranscriptSource; text: string }[] = [
  { source: "system", text: "Welcome back — today we are covering local-first software." },
  { source: "mic", text: "Note to self: this maps onto the doc-md sync design." },
  { source: "system", text: "The key idea is that your data lives on your machine." },
  { source: "mic", text: "Check how CRDTs would fit the kanban serializer." },
];

const mockDownloaded = new Set<string>();
let mockTimer: ReturnType<typeof setInterval> | null = null;
let mockStartedAt = 0;
let mockIndex = 0;
let mockPhase: "partial" | "final" = "partial";

function mockModels(): ModelInfo[] {
  return TRANSCRIPTION_MODELS.map((m) => ({
    ...m,
    downloaded: mockDownloaded.has(m.id),
  }));
}

function mockDownload(model: string): void {
  const info = TRANSCRIPTION_MODELS.find((m) => m.id === model);
  if (!info) throw new Error(`Unknown model: ${model}`);
  const total = info.sizeMb * 1024 * 1024;
  let sent = 0;
  const step = () => {
    sent = Math.min(total, sent + total / 4);
    if (sent < total) {
      emitMockEvent("transcription-model-progress", { model, downloaded: sent, total });
      setTimeout(step, 200);
    } else {
      mockDownloaded.add(model);
      emitMockEvent("transcription-model-progress", {
        model,
        downloaded: total,
        total,
        done: true,
      });
    }
  };
  setTimeout(step, 200);
}

function mockStart(mic: boolean, system: boolean): void {
  if (!mic && !system) throw new Error("No audio source enabled");
  const model = settingsStore.settings.transcriptionModel;
  if (!mockDownloaded.has(model)) {
    throw new Error(`Model ${model} is not downloaded`);
  }
  mockStop();
  mockStartedAt = Date.now();
  emitMockEvent("transcription-status", { state: "listening" } as TranscriptionStatusEvent);

  mockTimer = setInterval(() => {
    // Skip script lines whose source is toggled off
    let guard = 0;
    while (
      ((MOCK_SCRIPT[mockIndex % MOCK_SCRIPT.length].source === "mic" && !mic) ||
        (MOCK_SCRIPT[mockIndex % MOCK_SCRIPT.length].source === "system" && !system)) &&
      guard++ < MOCK_SCRIPT.length
    ) {
      mockIndex++;
    }
    const line = MOCK_SCRIPT[mockIndex % MOCK_SCRIPT.length];
    const tMs = Date.now() - mockStartedAt;
    if (mockPhase === "partial") {
      const words = line.text.split(" ");
      const partial = words.slice(0, Math.max(1, Math.floor(words.length * 0.6))).join(" ");
      emitMockEvent("transcription-line", {
        source: line.source,
        text: partial + "…",
        tMs,
        kind: "partial",
      } as TranscriptLineEvent);
      mockPhase = "final";
    } else {
      emitMockEvent("transcription-line", {
        source: line.source,
        text: line.text,
        tMs,
        kind: "final",
      } as TranscriptLineEvent);
      mockPhase = "partial";
      mockIndex++;
    }
  }, 1200);
}

function mockStop(): void {
  if (mockTimer) {
    clearInterval(mockTimer);
    mockTimer = null;
    emitMockEvent("transcription-status", { state: "stopped" } as TranscriptionStatusEvent);
  }
}

/** Test helper: clear all mock engine state. */
export function _resetTranscriptionMock(): void {
  if (mockTimer) clearInterval(mockTimer);
  mockTimer = null;
  mockDownloaded.clear();
  mockIndex = 0;
  mockPhase = "partial";
}
