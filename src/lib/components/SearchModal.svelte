<script lang="ts">
  import { vaultStore } from "../stores/vault.svelte";
  import { searchIndex } from "../services/search";
  import type { SearchResult } from "../types";

  let { open = false, onclose }: { open: boolean; onclose: () => void } = $props();

  let query = $state("");
  let results = $state<SearchResult[]>([]);
  let searching = $state(false);
  let searchError = $state<string | null>(null);
  let debounceTimer: ReturnType<typeof setTimeout> | undefined;
  let inputEl: HTMLInputElement;

  $effect(() => {
    if (open && inputEl) {
      query = "";
      results = [];
      setTimeout(() => inputEl?.focus(), 50);
    }
  });

  function handleInput() {
    clearTimeout(debounceTimer);
    if (!query.trim()) {
      results = [];
      return;
    }
    debounceTimer = setTimeout(doSearch, 200);
  }

  async function doSearch() {
    if (!vaultStore.vault || !query.trim()) return;
    searching = true;
    searchError = null;
    try {
      results = searchIndex.search(query);
    } catch (e) {
      results = [];
      searchError = "Search failed. The search index may not be available.";
      console.error("[search] error:", e);
    }
    searching = false;
  }

  function openResult(result: SearchResult) {
    const parts = result.path.replace(/\\/g, "/").split("/");
    const name = parts[parts.length - 1] ?? result.title;
    vaultStore.openFile(result.path, name);
    onclose();
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === "Escape") {
      onclose();
    }
  }
</script>

{#if open}
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    class="fixed inset-0 z-50 flex items-start justify-center pt-24"
    style="background: rgba(0,0,0,0.5);"
    onclick={onclose}
    onkeydown={handleKeydown}
  >
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div
      class="w-full max-w-xl rounded-lg shadow-2xl"
      style="background-color: var(--bg-secondary); border: 1px solid var(--border);"
      onclick={(e) => e.stopPropagation()}
    >
      <div class="p-3" style="border-bottom: 1px solid var(--border);">
        <input
          bind:this={inputEl}
          bind:value={query}
          oninput={handleInput}
          onkeydown={handleKeydown}
          type="text"
          placeholder="Search notes..."
          class="w-full rounded px-3 py-2 text-sm outline-none"
          style="background-color: var(--bg-surface); color: var(--text-primary); border: 1px solid var(--border);"
        />
      </div>

      <div class="max-h-80 overflow-y-auto p-2">
        {#if searching}
          <p class="px-3 py-4 text-center text-sm" style="color: var(--text-secondary);">
            Searching...
          </p>
        {:else if searchError}
          <p class="px-3 py-4 text-center text-sm" style="color: #f38ba8;">
            {searchError}
          </p>
        {:else if query && results.length === 0}
          <p class="px-3 py-4 text-center text-sm" style="color: var(--text-secondary);">
            No results found
          </p>
        {:else}
          {#each results as result (result.path)}
            <button
              class="mb-1 w-full rounded p-3 text-left transition-colors hover:opacity-90"
              style="background-color: var(--bg-surface);"
              onclick={() => openResult(result)}
            >
              <div class="text-sm font-medium" style="color: var(--text-primary);">
                {result.title}
              </div>
              {#if result.snippet}
                <div
                  class="mt-1 text-xs leading-relaxed"
                  style="color: var(--text-secondary);"
                >
                  {@html result.snippet}
                </div>
              {/if}
              <div class="mt-1 text-xs" style="color: var(--text-secondary); opacity: 0.6;">
                {result.path.split("/").slice(-2).join("/")}
              </div>
            </button>
          {/each}
        {/if}
      </div>
    </div>
  </div>
{/if}

<style>
  :global(mark) {
    background-color: rgba(137, 180, 250, 0.3);
    color: var(--text-primary);
    border-radius: 2px;
    padding: 0 2px;
  }
</style>
