<script lang="ts">
  import { vaultStore } from "../stores/vault.svelte";
</script>

{#if vaultStore.activeFile}
  <aside
    class="flex flex-col overflow-hidden"
    style="width: 280px; background-color: var(--bg-secondary); border-left: 1px solid var(--border);"
  >
    <div
      class="px-3 py-2"
      style="border-bottom: 1px solid var(--border);"
    >
      <span class="text-xs font-semibold uppercase tracking-wider" style="color: var(--text-secondary);">
        Backlinks ({vaultStore.backlinks.length})
      </span>
    </div>

    <div class="flex-1 overflow-y-auto p-2">
      {#if vaultStore.backlinks.length === 0}
        <p class="px-2 py-4 text-center text-xs" style="color: var(--text-secondary);">
          No backlinks found
        </p>
      {:else}
        {#each vaultStore.backlinks as bl (bl.path)}
          <div class="mb-2 rounded p-2" style="background-color: var(--bg-surface);">
            <button
              class="mb-1 text-sm font-medium hover:underline"
              style="color: var(--accent);"
              onclick={() => vaultStore.openFile(bl.path, bl.name + ".md")}
            >
              {bl.name}
            </button>
            {#each bl.contexts as ctx}
              <p
                class="mt-1 text-xs leading-relaxed"
                style="color: var(--text-secondary); white-space: pre-wrap;"
              >
                {ctx}
              </p>
            {/each}
          </div>
        {/each}
      {/if}
    </div>
  </aside>
{/if}
