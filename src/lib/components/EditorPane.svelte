<script lang="ts">
  import { vaultStore } from "../stores/vault.svelte";
  import Editor from "./Editor.svelte";
  import MarkdownPreview from "./MarkdownPreview.svelte";

  const file = $derived(vaultStore.activeFile);

  let showPreview = $state(true);
  let saveTimeout: ReturnType<typeof setTimeout> | undefined;

  function handleChange(content: string) {
    if (file) {
      const currentPath = file.path;
      vaultStore.updateContent(currentPath, content);
      clearTimeout(saveTimeout);
      saveTimeout = setTimeout(() => {
        vaultStore.saveFile(currentPath);
      }, 1000);
    }
  }

  function handleSave() {
    if (file) vaultStore.saveFile(file.path);
  }

  function togglePreview() {
    showPreview = !showPreview;
  }
</script>

<div class="flex h-full flex-col" style="background-color: var(--bg-primary);">
  {#if file}
    <div
      class="flex items-center justify-end gap-2 px-3 py-1"
      style="background-color: var(--bg-secondary); border-bottom: 1px solid var(--border);"
    >
      <button
        class="rounded px-2 py-0.5 text-xs"
        style="color: {showPreview ? 'var(--accent)' : 'var(--text-secondary)'}; background-color: {showPreview ? 'var(--bg-surface)' : 'transparent'};"
        onclick={togglePreview}
      >
        Preview
      </button>
    </div>

    <div class="flex flex-1 overflow-hidden">
      <div class="overflow-hidden" style="width: {showPreview ? '50%' : '100%'};">
        <Editor content={file.content} onchange={handleChange} onsave={handleSave} onnavigate={(name) => vaultStore.navigateToNote(name)} />
      </div>

      {#if showPreview}
        <div
          class="overflow-hidden"
          style="width: 50%; border-left: 1px solid var(--border);"
        >
          <MarkdownPreview content={file.content} />
        </div>
      {/if}
    </div>
  {:else}
    <div class="flex flex-1 items-center justify-center">
      <div class="text-center">
        <p class="mb-1 text-lg" style="color: var(--text-secondary);">No file open</p>
        <p class="text-xs" style="color: var(--text-secondary);">
          Select a file from the sidebar, or press Ctrl+Shift+F to search
        </p>
      </div>
    </div>
  {/if}
</div>
