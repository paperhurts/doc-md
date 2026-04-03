<script lang="ts">
  import { vaultStore } from "../stores/vault.svelte";
  import { linkIndex } from "../services/indexer";

  let tags = $state<[string, number][]>([]);
  let expanded = $state(false);
  let tagsError = $state<string | null>(null);

  async function refreshTags() {
    try {
      const tagMap = linkIndex.getAllTags();
      tags = Object.entries(tagMap).sort((a, b) => b[1] - a[1]);
      tagsError = null;
    } catch (e) {
      tags = [];
      tagsError = "Failed to load tags";
      console.error("[tags] error:", e);
    }
  }

  $effect(() => {
    if (vaultStore.vault) {
      refreshTags();
    }
  });
</script>

<div style="border-top: 1px solid var(--border);">
  <button
    class="flex w-full items-center justify-between px-3 py-2"
    onclick={() => (expanded = !expanded)}
  >
    <span class="text-xs font-semibold uppercase tracking-wider" style="color: var(--text-secondary);">
      Tags ({tags.length})
    </span>
    <span class="text-xs" style="color: var(--text-secondary);">
      {expanded ? "▼" : "▶"}
    </span>
  </button>

  {#if expanded}
    <div class="flex flex-wrap gap-1 px-3 pb-3">
      {#if tagsError}
        <p class="py-2 text-xs" style="color: #f38ba8;">{tagsError}</p>
      {:else}
        {#each tags as [tag, count] (tag)}
          <span
            class="inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs"
            style="background: rgba(203, 166, 247, 0.1); color: #cba6f7;"
          >
            #{tag}
            <span style="opacity: 0.6;">{count}</span>
          </span>
        {/each}
        {#if tags.length === 0}
          <p class="py-2 text-xs" style="color: var(--text-secondary);">No tags found</p>
        {/if}
      {/if}
    </div>
  {/if}
</div>
