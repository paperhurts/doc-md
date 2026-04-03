<script lang="ts">
  import { untrack } from "svelte";
  import { listen } from "@tauri-apps/api/event";
  import FileExplorer from "./lib/components/FileExplorer.svelte";
  import TabBar from "./lib/components/TabBar.svelte";
  import EditorPane from "./lib/components/EditorPane.svelte";
  import BacklinksPanel from "./lib/components/BacklinksPanel.svelte";
  import SearchModal from "./lib/components/SearchModal.svelte";
  import GraphView from "./lib/components/GraphView.svelte";
  import { vaultStore } from "./lib/stores/vault.svelte";

  let searchOpen = $state(false);
  let graphOpen = $state(false);
  let sidecarError = $state<string | null>(null);
  let initialized = false;

  $effect(() => {
    if (!initialized) {
      initialized = true;
      untrack(() => { vaultStore.init(); });
    }
  });

  $effect(() => {
    const unlisten = listen<string>("sidecar-error", (event) => {
      sidecarError = event.payload;
    });
    return () => { unlisten.then(fn => fn()); };
  });

  function handleKeydown(e: KeyboardEvent) {
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === "F") {
      e.preventDefault();
      searchOpen = !searchOpen;
    }
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === "G") {
      e.preventDefault();
      graphOpen = !graphOpen;
    }
  }
</script>

<svelte:window onkeydown={handleKeydown} />

<main class="flex h-full flex-col">
  <header
    class="flex h-10 items-center justify-between border-b px-4"
    style="border-color: var(--border); background-color: var(--bg-secondary);"
  >
    <span class="text-sm font-semibold" style="color: var(--accent);">doc-md</span>
    <div class="flex items-center gap-3">
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

  {#if sidecarError}
    <div
      class="flex items-center justify-between px-4 py-2 text-xs"
      style="background-color: #f38ba8; color: #1e1e2e;"
    >
      <span>Sidecar failed to start: {sidecarError}. Search, backlinks, and graph are unavailable.</span>
      <button
        class="ml-4 rounded px-2 py-0.5"
        style="background-color: rgba(0,0,0,0.15);"
        onclick={() => sidecarError = null}
      >
        Dismiss
      </button>
    </div>
  {/if}

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

{#if graphOpen}
  <GraphView onclose={() => (graphOpen = false)} />
{/if}
