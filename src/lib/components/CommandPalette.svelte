<script lang="ts">
  import { vaultStore } from "../stores/vault.svelte";

  let {
    open = false,
    onclose,
    onsearch,
    ongraph,
  }: {
    open: boolean;
    onclose: () => void;
    onsearch: () => void;
    ongraph: () => void;
  } = $props();

  let query = $state("");
  let selectedIndex = $state(0);
  let inputEl: HTMLInputElement;
  let mode = $state<"commands" | "files" | "templates">("commands");
  let templates = $state<{ name: string; path: string }[]>([]);

  interface Command {
    label: string;
    shortcut?: string;
    action: () => void;
  }

  const commands: Command[] = [
    { label: "Open file...", action: () => { mode = "files"; query = ""; selectedIndex = 0; } },
    { label: "New note", action: () => { onclose(); const name = prompt("Note name:"); if (name) vaultStore.createNote(name); } },
    { label: "New from template...", action: () => loadTemplates() },
    { label: "Daily note", shortcut: "Ctrl+D", action: () => { onclose(); vaultStore.openDailyNote(); } },
    { label: "Search notes", shortcut: "Ctrl+Shift+F", action: () => onsearch() },
    { label: "Graph view", shortcut: "Ctrl+Shift+G", action: () => ongraph() },
    { label: "Toggle preview", action: () => { onclose(); /* handled by EditorPane internally */ } },
  ];

  async function loadTemplates() {
    templates = await vaultStore.getTemplates();
    if (templates.length === 0) {
      alert("No templates found. Create .md files in a _templates/ folder in your vault.");
      return;
    }
    mode = "templates";
    query = "";
    selectedIndex = 0;
  }

  const filteredCommands = $derived.by(() => {
    if (mode === "files") {
      const q = query.toLowerCase();
      return vaultStore.noteNames
        .filter((n) => n.name.includes(q))
        .slice(0, 20)
        .map((n) => ({
          label: n.name,
          detail: n.path.replace(/\\/g, "/").split("/").slice(-2, -1).join("/"),
          action: () => {
            onclose();
            const parts = n.path.replace(/\\/g, "/").split("/");
            vaultStore.openFile(n.path, parts[parts.length - 1] ?? n.name);
          },
        }));
    }
    if (mode === "templates") {
      const q = query.toLowerCase();
      return templates
        .filter((t) => t.name.toLowerCase().includes(q))
        .map((t) => ({
          label: t.name,
          action: () => {
            onclose();
            const name = prompt("Note name:");
            if (name) vaultStore.createFromTemplate(t.path, name);
          },
        }));
    }
    const q = query.toLowerCase();
    return commands.filter((c) => c.label.toLowerCase().includes(q));
  });

  $effect(() => {
    if (open && inputEl) {
      mode = "commands";
      query = "";
      selectedIndex = 0;
      setTimeout(() => inputEl?.focus(), 50);
    }
  });

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === "Escape") {
      if (mode !== "commands") {
        mode = "commands";
        query = "";
        selectedIndex = 0;
      } else {
        onclose();
      }
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      selectedIndex = Math.min(selectedIndex + 1, filteredCommands.length - 1);
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      selectedIndex = Math.max(selectedIndex - 1, 0);
    }
    if (e.key === "Enter" && filteredCommands.length > 0) {
      e.preventDefault();
      filteredCommands[selectedIndex].action();
    }
  }

  // Reset selection when query changes
  $effect(() => {
    const _ = query;
    selectedIndex = 0;
  });
</script>

{#if open}
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    class="fixed inset-0 z-50 flex items-start justify-center pt-20"
    style="background: rgba(0,0,0,0.5);"
    onclick={onclose}
    onkeydown={handleKeydown}
  >
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div
      class="w-full max-w-lg rounded-lg shadow-2xl"
      style="background-color: var(--bg-secondary); border: 1px solid var(--border);"
      onclick={(e) => e.stopPropagation()}
    >
      <div class="p-3" style="border-bottom: 1px solid var(--border);">
        <div class="flex items-center gap-2">
          {#if mode !== "commands"}
            <button
              class="rounded px-2 py-1 text-xs"
              style="color: var(--text-secondary); border: 1px solid var(--border);"
              onclick={() => { mode = "commands"; query = ""; }}
            >
              Back
            </button>
          {/if}
          <input
            bind:this={inputEl}
            bind:value={query}
            onkeydown={handleKeydown}
            type="text"
            placeholder={mode === "files" ? "Search files..." : mode === "templates" ? "Choose template..." : "Type a command..."}
            class="w-full rounded px-3 py-2 text-sm outline-none"
            style="background-color: var(--bg-surface); color: var(--text-primary); border: 1px solid var(--border);"
          />
        </div>
      </div>

      <div class="max-h-72 overflow-y-auto p-1">
        {#each filteredCommands as item, i (item.label)}
          <button
            class="flex w-full items-center justify-between rounded px-3 py-2 text-left text-sm"
            style="color: var(--text-primary); background-color: {i === selectedIndex ? 'var(--bg-surface)' : 'transparent'};"
            onmouseenter={() => (selectedIndex = i)}
            onclick={() => item.action()}
          >
            <span>{item.label}</span>
            <span class="text-xs" style="color: var(--text-secondary);">
              {#if 'shortcut' in item && item.shortcut}
                {item.shortcut}
              {:else if 'detail' in item && item.detail}
                {item.detail}
              {/if}
            </span>
          </button>
        {/each}
        {#if filteredCommands.length === 0}
          <p class="px-3 py-4 text-center text-sm" style="color: var(--text-secondary);">
            No matches
          </p>
        {/if}
      </div>
    </div>
  </div>
{/if}
