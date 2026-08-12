<script lang="ts">
  import { untrack } from "svelte";
  import FileExplorer from "./lib/components/FileExplorer.svelte";
  import TabBar from "./lib/components/TabBar.svelte";
  import EditorPane from "./lib/components/EditorPane.svelte";
  import BacklinksPanel from "./lib/components/BacklinksPanel.svelte";
  import SearchModal from "./lib/components/SearchModal.svelte";
  import GraphView from "./lib/components/GraphView.svelte";
  import CommandPalette from "./lib/components/CommandPalette.svelte";
  import SettingsPanel from "./lib/components/SettingsPanel.svelte";
  import DialogHost from "./lib/components/DialogHost.svelte";
  import ZoomIndicator from "./lib/components/ZoomIndicator.svelte";
  import { vaultStore } from "./lib/stores/vault.svelte";
  import { themeStore } from "./lib/stores/theme.svelte";
  import { settingsStore } from "./lib/stores/settings.svelte";
  import { initCloseToTray } from "./lib/services/appWindow";
  import { initStickies } from "./lib/services/stickyWindows";
  import { initScreenshots } from "./lib/services/screenshot";
  import { applyUiZoom, clampZoom, zoomKeyAction, ZOOM_STEP } from "./lib/services/zoom";

  let searchOpen = $state(false);
  let graphOpen = $state(false);
  let paletteOpen = $state(false);
  let settingsOpen = $state(false);
  let initialized = false;

  $effect(() => {
    if (!initialized) {
      initialized = true;
      untrack(() => {
        themeStore.init();
        settingsStore.init();
        vaultStore.init();
        initCloseToTray();
        initStickies();
        initScreenshots();
      });
    }
  });

  // Zoom applies only in this (main-window) code path — the sticky and
  // capture windows must stay at 100% (the overlay's crop math depends on it).
  $effect(() => {
    applyUiZoom(settingsStore.settings.uiZoom);
  });

  function zoomBy(delta: number) {
    // Inner clamp normalizes an out-of-range stored value before stepping.
    settingsStore.update({ uiZoom: clampZoom(clampZoom(settingsStore.settings.uiZoom) + delta) });
  }

  // Ctrl+wheel zoom (and trackpad pinch, which Chromium reports as ctrl+wheel).
  // Manual listener: window wheel handlers are passive by default, and we must
  // preventDefault so the page doesn't scroll while zooming.
  $effect(() => {
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey || e.altKey) return;
      if ((e.target as Element | null)?.closest?.("[data-zoom-exempt]")) return; // graph zooms itself
      e.preventDefault();
      if (e.deltaY !== 0) zoomBy(e.deltaY < 0 ? ZOOM_STEP : -ZOOM_STEP);
    };
    window.addEventListener("wheel", onWheel, { passive: false });
    return () => window.removeEventListener("wheel", onWheel);
  });

  function handleKeydown(e: KeyboardEvent) {
    const zoomAction = zoomKeyAction(e);
    if (zoomAction) {
      e.preventDefault();
      if (zoomAction === "in") zoomBy(ZOOM_STEP);
      else if (zoomAction === "out") zoomBy(-ZOOM_STEP);
      else settingsStore.update({ uiZoom: 1 });
    }
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === "F") {
      e.preventDefault();
      searchOpen = !searchOpen;
    }
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === "G") {
      e.preventDefault();
      graphOpen = !graphOpen;
    }
    if ((e.ctrlKey || e.metaKey) && e.key === "k") {
      e.preventDefault();
      paletteOpen = !paletteOpen;
    }
    if ((e.ctrlKey || e.metaKey) && e.key === "d") {
      e.preventDefault();
      vaultStore.openDailyNote();
    }
    if ((e.ctrlKey || e.metaKey) && e.key === ",") {
      e.preventDefault();
      settingsOpen = !settingsOpen;
    }
  }
</script>

<svelte:window onkeydown={handleKeydown} />

<main class="flex h-full flex-col">
  <header
    class="flex h-10 shrink-0 items-center justify-between border-b px-4"
    style="border-color: var(--border); background-color: var(--bg-secondary);"
  >
    <span class="text-sm font-semibold" style="color: var(--accent);">doc-md</span>
    <div class="flex items-center gap-3">
      <button
        class="rounded px-2 py-0.5 text-xs hover:opacity-80"
        style="color: var(--text-secondary); border: 1px solid var(--border);"
        onclick={() => (paletteOpen = true)}
        title="Command palette (Ctrl+K)"
      >
        Commands
      </button>
      <button
        class="rounded px-2 py-0.5 text-xs hover:opacity-80"
        style="color: var(--text-secondary); border: 1px solid var(--border);"
        onclick={() => (graphOpen = true)}
        title="Graph view (Ctrl+Shift+G)"
      >
        Graph
      </button>
      <button
        class="rounded px-2 py-0.5 text-xs hover:opacity-80"
        style="color: var(--text-secondary); border: 1px solid var(--border);"
        onclick={() => (searchOpen = true)}
        title="Search (Ctrl+Shift+F)"
      >
        Search
      </button>
      <span class="text-xs" style="color: var(--text-secondary);">
        {vaultStore.vault?.name ?? "No vault open"}
      </span>
    </div>
  </header>

  <div class="flex flex-1 overflow-hidden">
    <FileExplorer />
    <div class="flex flex-1 flex-col overflow-hidden">
      <TabBar />
      <EditorPane />
    </div>
    <BacklinksPanel />
  </div>
</main>

<SearchModal open={searchOpen} onclose={() => (searchOpen = false)} />
<CommandPalette open={paletteOpen} onclose={() => (paletteOpen = false)} onsearch={() => { paletteOpen = false; searchOpen = true; }} ongraph={() => { paletteOpen = false; graphOpen = true; }} onsettings={() => { paletteOpen = false; settingsOpen = true; }} />
<SettingsPanel open={settingsOpen} onclose={() => (settingsOpen = false)} />
<DialogHost />
<ZoomIndicator />

{#if graphOpen}
  <GraphView onclose={() => (graphOpen = false)} />
{/if}
