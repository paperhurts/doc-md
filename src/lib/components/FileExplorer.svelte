<script lang="ts">
  import type { VaultEntry } from "../types";
  import { vaultStore } from "../stores/vault.svelte";
  import FileTreeNode from "./FileTreeNode.svelte";
  import TagsPanel from "./TagsPanel.svelte";
  import { open } from "@tauri-apps/plugin-dialog";

  async function openVault() {
    try {
      const selected = await open({ directory: true, multiple: false });
      if (selected) {
        await vaultStore.openVault(selected as string);
      }
    } catch {
      // User cancelled or not in Tauri
    }
  }
</script>

<aside
  class="flex h-full flex-col overflow-hidden"
  style="width: 260px; background-color: var(--bg-secondary); border-right: 1px solid var(--border);"
>
  <div
    class="flex items-center justify-between px-3 py-2"
    style="border-bottom: 1px solid var(--border);"
  >
    <span class="truncate text-xs font-semibold uppercase tracking-wider" style="color: var(--text-secondary);">
      {vaultStore.vault?.name ?? "No Vault"}
    </span>
    <button
      class="rounded p-1 text-xs hover:opacity-80"
      style="color: var(--accent);"
      onclick={openVault}
      title="Open vault folder"
    >
      {vaultStore.vault ? "Switch" : "Open"}
    </button>
  </div>

  <div class="flex-1 overflow-y-auto px-1 py-1">
    {#if vaultStore.tree.length === 0}
      <div class="px-3 py-8 text-center">
        <p class="mb-2 text-sm" style="color: var(--text-secondary);">No vault open</p>
        <button
          class="rounded px-3 py-1 text-sm"
          style="background-color: var(--accent); color: var(--bg-primary);"
          onclick={openVault}
        >
          Open Vault
        </button>
      </div>
    {:else}
      {#each vaultStore.tree as entry (entry.path)}
        <FileTreeNode {entry} depth={0} />
      {/each}
    {/if}
  </div>

  <TagsPanel />
</aside>
