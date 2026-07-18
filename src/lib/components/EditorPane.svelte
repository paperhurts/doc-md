<script lang="ts">
  import { vaultStore } from "../stores/vault.svelte";
  import { settingsStore, type ViewMode } from "../stores/settings.svelte";
  import Editor from "./Editor.svelte";
  import MarkdownPreview from "./MarkdownPreview.svelte";
  import FormattingToolbar from "./FormattingToolbar.svelte";
  import type { SelectionInfo, FormatAction } from "../editor/toolbar";

  const file = $derived(vaultStore.activeFile);
  let selectionInfo = $state<SelectionInfo | null>(null);
  let formatHandler = $state<((action: FormatAction) => void) | undefined>(undefined);

  const MODES: { id: ViewMode; label: string; title: string }[] = [
    { id: "source", label: "MD", title: "Markdown source only" },
    { id: "split", label: "Split", title: "Source + rendered preview" },
    { id: "preview", label: "Preview", title: "Edit formatted text (live preview)" },
  ];
  const viewMode = $derived(settingsStore.settings.viewMode);
  let saveTimeout: ReturnType<typeof setTimeout> | undefined;

  function setMode(mode: ViewMode) {
    settingsStore.update({ viewMode: mode });
  }

  function cycleMode() {
    const order: ViewMode[] = ["source", "split", "preview"];
    const next = order[(order.indexOf(viewMode) + 1) % order.length];
    setMode(next);
  }

  function handleWindowKeydown(e: KeyboardEvent) {
    if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key === "e") {
      e.preventDefault();
      cycleMode();
    }
  }

  function handleChange(content: string) {
    if (file) {
      const currentPath = file.path;
      vaultStore.updateContent(currentPath, content);
      clearTimeout(saveTimeout);
      saveTimeout = setTimeout(() => {
        vaultStore.saveFile(currentPath);
      }, settingsStore.settings.autoSaveDelay);
    }
  }

  function handleSave() {
    if (file) vaultStore.saveFile(file.path);
  }
</script>

<svelte:window onkeydown={handleWindowKeydown} />

<div class="flex min-h-0 flex-1 flex-col" style="background-color: var(--bg-primary);">
  {#if file}
    <div
      class="flex items-center justify-end gap-2 px-3 py-1"
      style="background-color: var(--bg-secondary); border-bottom: 1px solid var(--border);"
    >
      {#each MODES as mode (mode.id)}
        <button
          class="rounded px-2 py-0.5 text-xs"
          style="color: {viewMode === mode.id ? 'var(--accent)' : 'var(--text-secondary)'}; background-color: {viewMode === mode.id ? 'var(--bg-surface)' : 'transparent'};"
          onclick={() => setMode(mode.id)}
          title="{mode.title} (Ctrl+E cycles)"
        >
          {mode.label}
        </button>
      {/each}
    </div>

    <div class="flex min-h-0 flex-1 overflow-hidden">
      <div
        class="h-full overflow-hidden"
        style="width: {viewMode === 'split' ? '50%' : '100%'};"
      >
        <Editor
          content={file.content}
          livePreview={viewMode === "preview"}
          onchange={handleChange}
          onsave={handleSave}
          onnavigate={(name) => vaultStore.navigateToNote(name)}
          onselectionchange={(info) => { selectionInfo = info; }}
          onformatready={(handler) => { formatHandler = handler; }}
        />
      </div>

      {#if viewMode === "split"}
        <div
          class="h-full overflow-hidden"
          style="width: 50%; border-left: 1px solid var(--border);"
        >
          <MarkdownPreview content={file.content} />
        </div>
      {/if}
    </div>
    <FormattingToolbar {selectionInfo} onformat={formatHandler} />
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
