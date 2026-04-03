<script lang="ts">
  import { FORMAT_BUTTONS, type SelectionInfo, type FormatAction } from "../editor/toolbar";

  let {
    selectionInfo,
    onformat,
  }: {
    selectionInfo: SelectionInfo | null;
    onformat: ((action: FormatAction) => void) | undefined;
  } = $props();

  let toolbarEl: HTMLDivElement | undefined;
  let toolbarWidth = $state(0);

  const TOOLBAR_H = 40;
  const GAP = 8;

  const show = $derived(selectionInfo?.show ?? false);

  const position = $derived.by(() => {
    if (!selectionInfo?.show) return { left: 0, top: 0 };
    const rawLeft = selectionInfo.x - toolbarWidth / 2;
    const left = Math.max(8, Math.min(rawLeft, (typeof window !== "undefined" ? window.innerWidth : 1200) - toolbarWidth - 8));
    const top = selectionInfo.y - TOOLBAR_H - GAP;
    return { left, top };
  });

  // Track toolbar width for centering
  $effect(() => {
    if (toolbarEl) {
      toolbarWidth = toolbarEl.offsetWidth;
    }
  });

  // Group buttons by group number for separators
  const groups = $derived.by(() => {
    const map = new Map<number, typeof FORMAT_BUTTONS>();
    for (const btn of FORMAT_BUTTONS) {
      const arr = map.get(btn.group) ?? [];
      arr.push(btn);
      map.set(btn.group, arr);
    }
    return [...map.values()];
  });

  function handleClick(action: FormatAction, e: MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    onformat?.(action);
  }
</script>

{#if show}
  <div
    bind:this={toolbarEl}
    class="formatting-toolbar"
    style="left: {position.left}px; top: {position.top}px;"
    role="toolbar"
    aria-label="Formatting toolbar"
  >
    {#each groups as group, gi}
      {#if gi > 0}
        <span class="separator"></span>
      {/if}
      {#each group as btn}
        <button
          class="toolbar-btn"
          class:italic={btn.action === "italic"}
          class:strike={btn.action === "strikethrough"}
          class:bold={btn.action === "bold"}
          class:mono={btn.action === "code" || btn.action === "wikilink"}
          title="{btn.action}{btn.shortcut ? ` (${btn.shortcut})` : ''}"
          onmousedown={(e) => handleClick(btn.action, e)}
        >
          {btn.label}
        </button>
      {/each}
    {/each}
  </div>
{/if}

<style>
  .formatting-toolbar {
    position: fixed;
    z-index: 45;
    display: flex;
    align-items: center;
    gap: 2px;
    padding: 4px 6px;
    background: var(--bg-surface);
    border: 1px solid var(--border-strong);
    border-radius: var(--radius);
    box-shadow: var(--shadow-lg);
    font-family: var(--font-ui);
    animation: toolbar-in 0.1s ease-out;
  }

  @keyframes toolbar-in {
    from {
      opacity: 0;
      transform: translateY(4px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  .toolbar-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    min-width: 28px;
    height: 28px;
    padding: 0 6px;
    border: none;
    border-radius: var(--radius);
    background: transparent;
    color: var(--text-secondary);
    font-size: 13px;
    cursor: pointer;
    transition: background 0.1s, color 0.1s;
  }

  .toolbar-btn:hover {
    background: var(--accent-subtle);
    color: var(--text-primary);
  }

  .toolbar-btn.bold {
    font-weight: 700;
  }

  .toolbar-btn.italic {
    font-style: italic;
  }

  .toolbar-btn.strike {
    text-decoration: line-through;
  }

  .toolbar-btn.mono {
    font-family: var(--font-mono);
    font-size: 12px;
  }

  .separator {
    width: 1px;
    height: 16px;
    margin: 0 3px;
    background: var(--border);
  }
</style>
