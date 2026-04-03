<script lang="ts">
  import { vaultStore } from "../stores/vault.svelte";
  import { linkIndex } from "../services/indexer";

  let tags = $state<[string, number][]>([]);
  let expanded = $state(false);
  let tagsError = $state<string | null>(null);
  let selectedTag = $state<string | null>(null);
  let tagFiles = $state<{ path: string; name: string }[]>([]);

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

  function selectTag(tag: string) {
    if (selectedTag === tag) {
      selectedTag = null;
      tagFiles = [];
      return;
    }
    selectedTag = tag;
    const paths = linkIndex.allTags.get(tag) ?? [];
    tagFiles = paths.map((p) => {
      const parts = p.replace(/\\/g, "/").split("/");
      const fileName = parts[parts.length - 1] ?? "";
      return { path: p, name: fileName.replace(/\.(md|markdown)$/, "") };
    });
  }

  // Re-run when noteNames changes (signals index was rebuilt or file was saved)
  $effect(() => {
    const _ = vaultStore.noteNames.length;
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
    <div class="flex flex-wrap gap-1 px-3 pb-2">
      {#if tagsError}
        <p class="py-2 text-xs" style="color: #f38ba8;">{tagsError}</p>
      {:else}
        {#each tags as [tag, count] (tag)}
          <button
            class="inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs"
            style="background: {selectedTag === tag ? 'var(--accent-subtle)' : 'var(--tag-bg)'}; color: var(--tag-color); cursor: pointer; border-radius: var(--radius);"
            onclick={() => selectTag(tag)}
          >
            #{tag}
            <span style="opacity: 0.6;">{count}</span>
          </button>
        {/each}
        {#if tags.length === 0}
          <p class="py-2 text-xs" style="color: var(--text-secondary);">No tags found</p>
        {/if}
      {/if}
    </div>

    {#if selectedTag && tagFiles.length > 0}
      <div class="px-3 pb-3">
        <p class="mb-1 text-xs" style="color: var(--text-secondary);">
          Notes tagged #{selectedTag}:
        </p>
        {#each tagFiles as file (file.path)}
          <button
            class="block w-full rounded px-2 py-1 text-left text-xs hover:opacity-80"
            style="color: var(--accent);"
            onclick={() => vaultStore.openFile(file.path, file.name + ".md")}
          >
            {file.name}
          </button>
        {/each}
      </div>
    {/if}
  {/if}
</div>
