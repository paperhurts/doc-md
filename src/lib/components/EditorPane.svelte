<script lang="ts">
  import { vaultStore } from "../stores/vault.svelte";

  const file = $derived(vaultStore.activeFile);
  let saveTimeout: ReturnType<typeof setTimeout> | undefined;

  function handleInput(e: Event) {
    const target = e.target as HTMLTextAreaElement;
    if (file) {
      vaultStore.updateContent(file.path, target.value);
      // Auto-save after 1s of inactivity
      clearTimeout(saveTimeout);
      saveTimeout = setTimeout(() => {
        if (file) vaultStore.saveFile(file.path);
      }, 1000);
    }
  }

  function handleKeydown(e: KeyboardEvent) {
    if ((e.ctrlKey || e.metaKey) && e.key === "s") {
      e.preventDefault();
      if (file) vaultStore.saveFile(file.path);
    }
  }
</script>

<div class="flex h-full flex-col" style="background-color: var(--bg-primary);">
  {#if file}
    <textarea
      class="flex-1 resize-none border-none p-4 font-mono text-sm outline-none"
      style="background-color: var(--bg-primary); color: var(--text-primary); tab-size: 2;"
      value={file.content}
      oninput={handleInput}
      onkeydown={handleKeydown}
      spellcheck="false"
    ></textarea>
  {:else}
    <div class="flex flex-1 items-center justify-center">
      <p class="text-sm" style="color: var(--text-secondary);">
        Open a file from the sidebar
      </p>
    </div>
  {/if}
</div>
