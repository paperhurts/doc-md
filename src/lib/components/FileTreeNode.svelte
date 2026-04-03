<script lang="ts">
  import type { VaultEntry } from "../types";
  import { vaultStore } from "../stores/vault.svelte";
  import FileTreeNode from "./FileTreeNode.svelte";

  let { entry, depth = 0 }: { entry: VaultEntry; depth: number } = $props();
  let expanded = $state(false);
  let contextMenu = $state<{ x: number; y: number } | null>(null);
  let renaming = $state(false);
  let renameCancelled = false;
  let renameValue = $state("");
  let renameInput: HTMLInputElement | undefined;

  const isActive = $derived(vaultStore.activeFilePath === entry.path);
  const isMarkdown = $derived(
    !entry.is_dir && (entry.name.endsWith(".md") || entry.name.endsWith(".markdown")),
  );
  const paddingLeft = $derived(`${depth * 16 + 8}px`);

  const icon = $derived.by(() => {
    if (entry.is_dir) return expanded ? "📂" : "📁";
    if (isMarkdown) return "📝";
    if (entry.name.match(/\.(png|jpg|jpeg|gif|svg|webp)$/i)) return "🖼️";
    return "📄";
  });

  function handleClick() {
    if (entry.is_dir) {
      expanded = !expanded;
    } else {
      vaultStore.openFile(entry.path, entry.name);
    }
  }

  function handleContextMenu(e: MouseEvent) {
    e.preventDefault();
    contextMenu = { x: e.clientX, y: e.clientY };

    // Close on next click anywhere
    function close() {
      contextMenu = null;
      document.removeEventListener("click", close);
    }
    setTimeout(() => document.addEventListener("click", close), 0);
  }

  function startRename() {
    contextMenu = null;
    renameValue = entry.name;
    renameCancelled = false;
    renaming = true;
    setTimeout(() => {
      renameInput?.focus();
      // Select filename without extension for convenience
      const dotIdx = renameValue.lastIndexOf(".");
      renameInput?.setSelectionRange(0, dotIdx > 0 ? dotIdx : renameValue.length);
    }, 0);
  }

  async function commitRename() {
    if (!renaming || renameCancelled) {
      renaming = false;
      return;
    }
    renaming = false;
    const newName = renameValue.trim();
    if (!newName || newName === entry.name) return;

    const parts = entry.path.replace(/\\/g, "/").split("/");
    parts[parts.length - 1] = newName;
    const newPath = parts.join("/");
    await vaultStore.renameNote(entry.path, newPath);
  }

  function handleRenameKeydown(e: KeyboardEvent) {
    if (e.key === "Enter") commitRename();
    if (e.key === "Escape") {
      renameCancelled = true;
      renaming = false;
    }
  }

  async function handleDelete() {
    contextMenu = null;
    const label = entry.is_dir ? "folder and all its contents" : "file";
    if (confirm(`Delete ${label} "${entry.name}"?`)) {
      await vaultStore.deleteNote(entry.path);
    }
  }
</script>

<div>
  {#if renaming}
    <div class="flex items-center" style="padding-left: {paddingLeft};">
      <input
        bind:this={renameInput}
        bind:value={renameValue}
        onblur={commitRename}
        onkeydown={handleRenameKeydown}
        class="w-full rounded px-1 py-0.5 text-sm outline-none"
        style="background-color: var(--bg-surface); color: var(--text-primary); border: 1px solid var(--accent);"
      />
    </div>
  {:else}
    <button
      class="flex w-full items-center gap-1 rounded px-1 py-0.5 text-left text-sm hover:opacity-90"
      style="padding-left: {paddingLeft}; color: {isActive ? 'var(--accent)' : 'var(--text-primary)'}; background-color: {isActive ? 'var(--bg-surface)' : 'transparent'};"
      onclick={handleClick}
      oncontextmenu={handleContextMenu}
    >
      <span class="flex-shrink-0" style="font-size: 12px; width: 18px; text-align: center;">
        {icon}
      </span>
      <span class="truncate">{entry.name}</span>
    </button>
  {/if}

  {#if entry.is_dir && expanded && entry.children}
    {#each entry.children as child (child.path)}
      <FileTreeNode entry={child} depth={depth + 1} />
    {/each}
  {/if}
</div>

<!-- Context menu -->
{#if contextMenu}
  <div
    class="fixed z-50 min-w-[140px] rounded-md py-1 shadow-lg"
    style="left: {contextMenu.x}px; top: {contextMenu.y}px; background-color: var(--bg-surface); border: 1px solid var(--border);"
  >
    <button
      class="w-full px-3 py-1.5 text-left text-xs hover:opacity-80"
      style="color: var(--text-primary);"
      onclick={startRename}
    >
      Rename
    </button>
    <button
      class="w-full px-3 py-1.5 text-left text-xs hover:opacity-80"
      style="color: #f38ba8;"
      onclick={handleDelete}
    >
      Delete
    </button>
  </div>
{/if}
