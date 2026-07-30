<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import { vaultStore } from "../stores/vault.svelte";
  import { settingsStore } from "../stores/settings.svelte";
  import { listenEvent, type Unlisten } from "../services/events";
  import {
    startTranscription,
    stopTranscription,
    getTranscriptionModels,
    downloadTranscriptionModel,
    formatTranscriptLine,
    TRANSCRIPTION_MODELS,
    type TranscriptLineEvent,
    type TranscriptionStatusEvent,
    type ModelProgressEvent,
    type ModelInfo,
  } from "../services/transcription";

  let { path }: { path: string } = $props();

  let status = $state<"idle" | "listening" | "error">("idle");
  let errorMsg = $state<string | null>(null);
  let micOn = $state(true);
  let systemOn = $state(true);
  let partials = $state<{ mic: string | null; system: string | null }>({
    mic: null,
    system: null,
  });
  let models = $state<ModelInfo[]>([]);
  let downloadPct = $state<number | null>(null);
  let elapsedS = $state(0);
  let startedByMe = false;
  let elapsedTimer: ReturnType<typeof setInterval> | undefined;
  const unlistens: Unlisten[] = [];

  const selectedModelId = $derived(settingsStore.settings.transcriptionModel);
  const selectedModel = $derived(
    models.find((m) => m.id === selectedModelId) ??
      TRANSCRIPTION_MODELS.map((m) => ({ ...m, downloaded: false })).find(
        (m) => m.id === selectedModelId,
      ),
  );
  const needsDownload = $derived(selectedModel ? !selectedModel.downloaded : false);

  async function refreshModels() {
    try {
      models = await getTranscriptionModels();
      errorMsg = null;
    } catch (e) {
      // Rust engine missing (2B not built / stub build) — surface once
      status = "error";
      errorMsg = String(e);
    }
  }

  onMount(() => {
    micOn = settingsStore.settings.transcriptionMic;
    systemOn = settingsStore.settings.transcriptionSystem;
    void refreshModels();

    void listenEvent<TranscriptLineEvent>("transcription-line", (line) => {
      if (!startedByMe) return;
      if (line.kind === "partial") {
        partials[line.source] = line.text;
      } else {
        partials[line.source] = null;
        void vaultStore.appendToNote(path, "\n" + formatTranscriptLine(line.source, line.tMs, line.text));
      }
    }).then((u) => unlistens.push(u));

    void listenEvent<TranscriptionStatusEvent>("transcription-status", (s) => {
      if (!startedByMe) return;
      if (s.state === "error") {
        status = "error";
        errorMsg = s.message ?? "Transcription error";
      }
    }).then((u) => unlistens.push(u));

    void listenEvent<ModelProgressEvent>("transcription-model-progress", (p) => {
      if (p.error) {
        downloadPct = null;
        errorMsg = `Download failed: ${p.error}`;
        return;
      }
      if (p.done) {
        downloadPct = null;
        void refreshModels();
        return;
      }
      downloadPct = p.total > 0 ? Math.round((p.downloaded / p.total) * 100) : 0;
    }).then((u) => unlistens.push(u));
  });

  onDestroy(() => {
    for (const u of unlistens) u();
    if (startedByMe) void stop();
  });

  async function start() {
    errorMsg = null;
    try {
      await startTranscription(micOn, systemOn);
      startedByMe = true;
      status = "listening";
      elapsedS = 0;
      elapsedTimer = setInterval(() => elapsedS++, 1000);
      settingsStore.update({ transcriptionMic: micOn, transcriptionSystem: systemOn });
    } catch (e) {
      status = "error";
      errorMsg = String(e);
    }
  }

  async function stop() {
    clearInterval(elapsedTimer);
    startedByMe = false;
    status = "idle";
    partials = { mic: null, system: null };
    try {
      await stopTranscription();
    } catch (e) {
      console.error("[transcription] stop failed:", e);
    }
  }

  function download() {
    errorMsg = null;
    downloadPct = 0;
    try {
      void downloadTranscriptionModel(selectedModelId);
    } catch (e) {
      downloadPct = null;
      errorMsg = String(e);
    }
  }

  const elapsed = $derived(
    `${String(Math.floor(elapsedS / 60)).padStart(2, "0")}:${String(elapsedS % 60).padStart(2, "0")}`,
  );
</script>

<div
  class="flex flex-wrap items-center gap-3 px-3 py-2 text-xs"
  style="background-color: var(--bg-secondary); border-bottom: 1px solid var(--border);"
>
  <span
    class="inline-block h-2 w-2 rounded-full"
    style="background-color: {status === 'listening'
      ? '#4ade80'
      : status === 'error'
        ? '#e5534b'
        : 'var(--text-secondary)'};"
    title={status}
  ></span>

  {#if status === "listening"}
    <button
      class="rounded px-3 py-1"
      style="color: #e5534b; border: 1px solid var(--border); border-radius: var(--radius);"
      onclick={stop}
    >
      ■ Stop
    </button>
    <span style="color: var(--text-secondary); font-family: var(--font-mono);">{elapsed}</span>
  {:else if needsDownload}
    <button
      class="rounded px-3 py-1"
      style="color: var(--accent); border: 1px solid var(--accent); border-radius: var(--radius);"
      onclick={download}
      disabled={downloadPct !== null}
    >
      {#if downloadPct !== null}
        Downloading… {downloadPct}%
      {:else}
        ⬇ Download {selectedModel?.id} ({selectedModel?.sizeMb} MB)
      {/if}
    </button>
  {:else}
    <button
      class="rounded px-3 py-1"
      style="color: var(--accent); border: 1px solid var(--accent); border-radius: var(--radius);"
      onclick={start}
    >
      ● Listen
    </button>
  {/if}

  <label class="flex items-center gap-1" style="color: var(--text-primary);">
    <input type="checkbox" bind:checked={micOn} disabled={status === "listening"} />
    Mic [me]
  </label>
  <label class="flex items-center gap-1" style="color: var(--text-primary);">
    <input type="checkbox" bind:checked={systemOn} disabled={status === "listening"} />
    System audio [audio]
  </label>

  {#if errorMsg}
    <span style="color: #e5534b;">{errorMsg}</span>
  {/if}

  {#if status === "listening" && (partials.mic || partials.system)}
    <div class="basis-full" style="color: var(--text-secondary); font-style: italic;">
      {#if partials.system}<div>[audio] {partials.system}</div>{/if}
      {#if partials.mic}<div>[me] {partials.mic}</div>{/if}
    </div>
  {/if}
</div>
