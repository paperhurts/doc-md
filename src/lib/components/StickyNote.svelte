<script lang="ts">
  import { untrack } from "svelte";
  import Editor from "./Editor.svelte";
  import { readFile, writeFile } from "../services/tauri";
  import { isTauri } from "../services/env";
  import { stickyStore, labelForPath } from "../stores/stickies.svelte";
  import { removeSticky } from "../services/stickyWindows";
  import { themeStore } from "../stores/theme.svelte";
  import { settingsStore } from "../stores/settings.svelte";

  let { path }: { path: string } = $props();

  let content = $state<string | null>(null);
  let error = $state<string | null>(null);
  let saveTimeout: ReturnType<typeof setTimeout> | undefined;
  let initialized = false;

  const label = labelForPath(path);

  $effect(() => {
    if (initialized) return;
    initialized = true;
    untrack(() => {
      themeStore.init();
      settingsStore.init();
      stickyStore.init();
      void load();
      void trackGeometry();
    });
  });

  async function load() {
    try {
      content = await readFile(path);
    } catch (e) {
      error = `Could not open note: ${e}`;
    }
  }

  function handleChange(newContent: string) {
    content = newContent;
    clearTimeout(saveTimeout);
    saveTimeout = setTimeout(() => {
      writeFile(path, newContent).catch((e) => console.error("[sticky] save failed:", e));
    }, settingsStore.settings.autoSaveDelay);
  }

  async function trackGeometry() {
    if (!isTauri()) return;
    const { getCurrentWindow } = await import("@tauri-apps/api/window");
    const win = getCurrentWindow();
    let geoTimeout: ReturnType<typeof setTimeout> | undefined;
    const persist = async () => {
      try {
        const pos = await win.outerPosition();
        const size = await win.innerSize();
        stickyStore.updateGeometry(path, {
          x: pos.x,
          y: pos.y,
          width: size.width,
          height: size.height,
        });
      } catch {
        // Window is closing — nothing to persist
      }
    };
    await win.onMoved(() => {
      clearTimeout(geoTimeout);
      geoTimeout = setTimeout(persist, 400);
    });
    await win.onResized(() => {
      clearTimeout(geoTimeout);
      geoTimeout = setTimeout(persist, 400);
    });
  }

  async function hideSticky() {
    if (!isTauri()) return;
    const { getCurrentWindow } = await import("@tauri-apps/api/window");
    await getCurrentWindow().hide();
  }

  async function unstick() {
    await removeSticky(path);
  }
</script>

<div
  class="flex h-full flex-col overflow-hidden"
  style="background-color: var(--bg-primary); border: 1px solid var(--accent); border-radius: 6px;"
>
  <div
    data-tauri-drag-region
    class="flex h-8 shrink-0 cursor-grab items-center justify-between px-2"
    style="background-color: var(--accent-subtle); border-bottom: 1px solid var(--border);"
  >
    <span
      data-tauri-drag-region
      class="truncate text-xs font-semibold"
      style="color: var(--accent); pointer-events: none;"
    >
      📌 {label}
    </span>
    <div class="flex items-center gap-1">
      <button
        class="rounded px-1.5 text-xs hover:opacity-80"
        style="color: var(--text-secondary);"
        onclick={hideSticky}
        title="Hide sticky (toggle back from tray)"
      >
        —
      </button>
      <button
        class="rounded px-1.5 text-xs hover:opacity-80"
        style="color: var(--text-secondary);"
        onclick={unstick}
        title="Un-stick (close permanently)"
      >
        ✕
      </button>
    </div>
  </div>

  <div class="min-h-0 flex-1">
    {#if error}
      <p class="p-3 text-xs" style="color: var(--text-secondary);">{error}</p>
    {:else if content !== null}
      <Editor {content} livePreview={true} onchange={handleChange} />
    {:else}
      <p class="p-3 text-xs" style="color: var(--text-secondary);">Loading…</p>
    {/if}
  </div>
</div>
