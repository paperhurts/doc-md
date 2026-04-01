<script lang="ts">
  import FileExplorer from "./lib/components/FileExplorer.svelte";
  import TabBar from "./lib/components/TabBar.svelte";
  import EditorPane from "./lib/components/EditorPane.svelte";
  import BacklinksPanel from "./lib/components/BacklinksPanel.svelte";
  import SearchModal from "./lib/components/SearchModal.svelte";
  import { vaultStore } from "./lib/stores/vault.svelte";

  let searchOpen = $state(false);

  $effect(() => {
    vaultStore.init();
  });

  function handleKeydown(e: KeyboardEvent) {
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === "F") {
      e.preventDefault();
      searchOpen = !searchOpen;
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
    <span class="text-xs" style="color: var(--text-secondary);">
      {vaultStore.vault?.name ?? "No vault open"}
    </span>
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
