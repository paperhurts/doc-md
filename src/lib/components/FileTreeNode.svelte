<script lang="ts">
  import type { VaultEntry } from "../types";
  import { vaultStore } from "../stores/vault.svelte";
  import FileTreeNode from "./FileTreeNode.svelte";

  let { entry, depth = 0 }: { entry: VaultEntry; depth: number } = $props();
  let expanded = $state(false);

  const isActive = $derived(vaultStore.activeFilePath === entry.path);
  const isMarkdown = $derived(
    !entry.is_dir && (entry.name.endsWith(".md") || entry.name.endsWith(".markdown")),
  );
  const paddingLeft = $derived(`${depth * 16 + 8}px`);

  function handleClick() {
    if (entry.is_dir) {
      expanded = !expanded;
    } else {
      vaultStore.openFile(entry.path, entry.name);
    }
  }
</script>

<div>
  <button
    class="flex w-full items-center gap-1 rounded px-1 py-0.5 text-left text-sm hover:opacity-90"
    style="padding-left: {paddingLeft}; color: {isActive ? 'var(--accent)' : 'var(--text-primary)'}; background-color: {isActive ? 'var(--bg-surface)' : 'transparent'};"
    onclick={handleClick}
  >
    <span class="flex-shrink-0 text-xs" style="color: var(--text-secondary); width: 16px;">
      {#if entry.is_dir}
        {expanded ? "▼" : "▶"}
      {:else if isMarkdown}
        ¶
      {:else}
        ·
      {/if}
    </span>
    <span class="truncate">{entry.name}</span>
  </button>

  {#if entry.is_dir && expanded && entry.children}
    {#each entry.children as child (child.path)}
      <FileTreeNode entry={child} depth={depth + 1} />
    {/each}
  {/if}
</div>
