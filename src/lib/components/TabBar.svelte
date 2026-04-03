<script lang="ts">
  import { vaultStore } from "../stores/vault.svelte";

  function activateTab(path: string) {
    vaultStore.setActiveFile(path);
  }

  function closeTab(e: MouseEvent, path: string) {
    e.stopPropagation();
    vaultStore.closeFile(path);
  }
</script>

{#if vaultStore.openFiles.length > 0}
  <div
    class="flex h-10 shrink-0 items-center overflow-x-auto"
    style="background-color: var(--bg-secondary); border-bottom: 1px solid var(--border);"
  >
    {#each vaultStore.openFiles as file (file.path)}
      <button
        class="flex items-center gap-1 whitespace-nowrap px-3 text-xs"
        style="
          border-right: 1px solid var(--border);
          color: {vaultStore.activeFilePath === file.path ? 'var(--text-primary)' : 'var(--text-secondary)'};
          background-color: {vaultStore.activeFilePath === file.path ? 'var(--bg-primary)' : 'transparent'};
        "
        onclick={() => activateTab(file.path)}
      >
        <span>{file.dirty ? "● " : ""}{file.name}</span>
        <span
          class="ml-1 rounded px-1 hover:opacity-60"
          style="color: var(--text-secondary);"
          role="button"
          tabindex="-1"
          onclick={(e) => closeTab(e, file.path)}
          onkeydown={() => {}}
        >
          ×
        </span>
      </button>
    {/each}
  </div>
{/if}
