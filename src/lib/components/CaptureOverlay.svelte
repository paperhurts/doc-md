<script lang="ts">
  import { onMount } from "svelte";
  import { settingsStore } from "../stores/settings.svelte";
  import {
    getCaptureFrameSrc,
    cancelCapture,
    completeCaptureFromOverlay,
    showCaptureOverlay,
    emitCaptureError,
  } from "../services/screenshot";
  import { isTauri } from "../services/env";

  let frameSrc = $state<string | null>(null);
  let dragging = $state(false);
  let busy = $state(false);
  let start = $state({ x: 0, y: 0 });
  let cur = $state({ x: 0, y: 0 });

  const sel = $derived({
    x: Math.min(start.x, cur.x),
    y: Math.min(start.y, cur.y),
    width: Math.abs(cur.x - start.x),
    height: Math.abs(cur.y - start.y),
  });

  onMount(() => {
    // Own window: boot the settings store (localStorage is shared app-wide)
    settingsStore.init();
    getCaptureFrameSrc()
      .then((src) => {
        frameSrc = src;
      })
      .catch((e) => {
        console.error("[capture] no frame:", e);
        void emitCaptureError(`couldn't load the frozen frame (${e})`);
        void cancel();
      });
  });

  async function closeSelf() {
    if (!isTauri()) return;
    const { getCurrentWindow } = await import("@tauri-apps/api/window");
    await getCurrentWindow().destroy();
  }

  async function cancel() {
    if (busy) return;
    busy = true;
    try {
      await cancelCapture(); // Rust destroys the overlay + restores main
    } catch (e) {
      console.error("[capture] cancel failed:", e);
      await closeSelf();
    }
  }

  function onPointerDown(e: PointerEvent) {
    if (busy || e.button !== 0) return;
    dragging = true;
    start = { x: e.clientX, y: e.clientY };
    cur = { x: e.clientX, y: e.clientY };
  }

  function onPointerMove(e: PointerEvent) {
    if (dragging) cur = { x: e.clientX, y: e.clientY };
  }

  async function onPointerUp() {
    if (!dragging || busy) return;
    dragging = false;
    if (sel.width < 3 || sel.height < 3) return; // stray click — keep the overlay up
    busy = true;
    try {
      const ok = await completeCaptureFromOverlay(sel, window.devicePixelRatio);
      if (!ok) await emitCaptureError("no vault is open to save into");
    } catch (e) {
      console.error("[capture] finish failed:", e);
      await emitCaptureError(String(e));
    }
    await closeSelf();
  }

  function onKeydown(e: KeyboardEvent) {
    if (e.key === "Escape") {
      e.preventDefault();
      void cancel();
    }
  }
</script>

<svelte:window onkeydown={onKeydown} />

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
  class="overlay"
  onpointerdown={onPointerDown}
  onpointermove={onPointerMove}
  onpointerup={onPointerUp}
  oncontextmenu={(e) => {
    e.preventDefault();
    void cancel();
  }}
>
  {#if frameSrc}
    <img
      class="frame"
      src={frameSrc}
      alt=""
      draggable="false"
      onload={() => void showCaptureOverlay()}
      onerror={() => {
        void emitCaptureError("frozen frame failed to render");
        void cancel();
      }}
    />
  {/if}

  {#if dragging}
    <div
      class="selection"
      style="left: {sel.x}px; top: {sel.y}px; width: {sel.width}px; height: {sel.height}px;"
    ></div>
  {:else if !busy}
    <div class="dim"></div>
    <div class="hint">Drag to capture a region — Esc to cancel</div>
  {/if}
</div>

<style>
  .overlay {
    position: fixed;
    inset: 0;
    overflow: hidden;
    cursor: crosshair;
    user-select: none;
    background: #000;
  }
  .frame {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    pointer-events: none;
  }
  /* Dim everything outside the selection with a giant box-shadow */
  .selection {
    position: absolute;
    border: 1px dashed #fff;
    box-shadow: 0 0 0 100000px rgba(0, 0, 0, 0.45);
    pointer-events: none;
  }
  .dim {
    position: absolute;
    inset: 0;
    background: rgba(0, 0, 0, 0.35);
    pointer-events: none;
  }
  .hint {
    position: absolute;
    top: 24px;
    left: 50%;
    transform: translateX(-50%);
    padding: 6px 14px;
    border-radius: 6px;
    background: rgba(0, 0, 0, 0.75);
    color: #fff;
    font-size: 13px;
    font-family: system-ui, sans-serif;
    pointer-events: none;
  }
</style>
