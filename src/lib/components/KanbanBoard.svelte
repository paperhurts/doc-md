<script lang="ts">
  import {
    parseKanban,
    serializeKanban,
    cardsOf,
    addCard,
    updateCard,
    deleteCard,
    moveCard,
    addColumn,
    renameColumn,
    deleteColumn,
    moveColumn,
    type KanbanBoard,
  } from "../services/kanban";

  let {
    content = "",
    onchange,
  }: {
    content: string;
    onchange?: (content: string) => void;
  } = $props();

  const board = $derived(parseKanban(content));

  // Inline editing state
  let editingCardId = $state<string | null>(null);
  let editingColIdx = $state<number | null>(null);
  let editText = $state("");
  let newCardCol = $state<number | null>(null);
  let newCardText = $state("");
  let addingColumn = $state(false);
  let newColumnTitle = $state("");

  // Drag state
  let dragging = $state<{ colIdx: number; cardId: string } | null>(null);
  let dropTarget = $state<{ colIdx: number; cardIdx: number } | null>(null);

  function commit(next: KanbanBoard) {
    onchange?.(serializeKanban(next));
  }

  function startEditCard(colIdx: number, cardId: string, text: string) {
    editingCardId = cardId;
    editingColIdx = colIdx;
    editText = text;
  }

  function saveCardEdit() {
    if (editingCardId !== null && editingColIdx !== null) {
      const text = editText.trim();
      if (text) {
        commit(updateCard(board, editingColIdx, editingCardId, { text }));
      } else {
        commit(deleteCard(board, editingColIdx, editingCardId));
      }
    }
    editingCardId = null;
    editingColIdx = null;
  }

  function submitNewCard(colIdx: number) {
    const text = newCardText.trim();
    if (text) commit(addCard(board, colIdx, text));
    newCardText = "";
    newCardCol = null;
  }

  function submitNewColumn() {
    const title = newColumnTitle.trim();
    if (title) commit(addColumn(board, title));
    newColumnTitle = "";
    addingColumn = false;
  }

  function handleRenameColumn(colIdx: number, title: string) {
    const t = title.trim();
    if (t && t !== board.columns[colIdx].title) {
      commit(renameColumn(board, colIdx, t));
    }
  }

  function handleDeleteColumn(colIdx: number) {
    const col = board.columns[colIdx];
    const n = cardsOf(col).length;
    if (n > 0 && !confirm(`Delete column "${col.title}" and its ${n} card(s)?`)) return;
    commit(deleteColumn(board, colIdx));
  }

  function handleDrop(colIdx: number, cardIdx: number) {
    if (dragging) {
      commit(moveCard(board, dragging.colIdx, dragging.cardId, colIdx, cardIdx));
    }
    dragging = null;
    dropTarget = null;
  }

  function dropIndexForColumn(colIdx: number): number {
    return cardsOf(board.columns[colIdx]).length;
  }
</script>

<div
  class="flex h-full gap-3 overflow-x-auto p-4"
  style="background-color: var(--bg-primary);"
  data-testid="kanban-board"
>
  {#each board.columns as col, colIdx (col.id)}
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div
      class="flex w-64 shrink-0 flex-col rounded-lg"
      style="background-color: var(--bg-secondary); border: 1px solid var(--border); max-height: 100%;"
      ondragover={(e) => {
        e.preventDefault();
        if (dropTarget?.colIdx !== colIdx) {
          dropTarget = { colIdx, cardIdx: dropIndexForColumn(colIdx) };
        }
      }}
      ondrop={(e) => {
        e.preventDefault();
        handleDrop(colIdx, dropTarget?.colIdx === colIdx ? dropTarget.cardIdx : dropIndexForColumn(colIdx));
      }}
    >
      <div
        class="flex items-center justify-between gap-1 px-3 py-2"
        style="border-bottom: 1px solid var(--border);"
      >
        <input
          class="min-w-0 flex-1 bg-transparent text-sm font-semibold outline-none"
          style="color: var(--text-primary);"
          value={col.title}
          onchange={(e) => handleRenameColumn(colIdx, e.currentTarget.value)}
          title="Rename column"
        />
        <span class="text-xs" style="color: var(--text-secondary);">
          {cardsOf(col).length}
        </span>
        <button
          class="rounded px-1 text-xs hover:opacity-80"
          style="color: var(--text-secondary);"
          onclick={() => commit(moveColumn(board, colIdx, colIdx - 1))}
          disabled={colIdx === 0}
          title="Move column left"
        >◀</button>
        <button
          class="rounded px-1 text-xs hover:opacity-80"
          style="color: var(--text-secondary);"
          onclick={() => commit(moveColumn(board, colIdx, colIdx + 1))}
          disabled={colIdx === board.columns.length - 1}
          title="Move column right"
        >▶</button>
        <button
          class="rounded px-1 text-xs hover:opacity-80"
          style="color: var(--text-secondary);"
          onclick={() => handleDeleteColumn(colIdx)}
          title="Delete column"
        >✕</button>
      </div>

      <div class="flex flex-col gap-2 overflow-y-auto p-2">
        {#each cardsOf(col) as card, cardIdx (card.id)}
          <!-- svelte-ignore a11y_no_static_element_interactions -->
          {#if dropTarget?.colIdx === colIdx && dropTarget.cardIdx === cardIdx && dragging}
            <div class="h-1 rounded" style="background-color: var(--accent);"></div>
          {/if}
          <div
            class="group cursor-grab rounded p-2 text-sm"
            style="background-color: var(--bg-surface); border: 1px solid var(--border); color: var(--text-primary); opacity: {dragging?.cardId === card.id ? 0.4 : 1};"
            draggable="true"
            data-testid="kanban-card"
            ondragstart={() => (dragging = { colIdx, cardId: card.id })}
            ondragend={() => { dragging = null; dropTarget = null; }}
            ondragover={(e) => {
              e.preventDefault();
              e.stopPropagation();
              dropTarget = { colIdx, cardIdx };
            }}
            ondrop={(e) => {
              e.preventDefault();
              e.stopPropagation();
              handleDrop(colIdx, cardIdx);
            }}
          >
            {#if editingCardId === card.id}
              <!-- svelte-ignore a11y_autofocus -->
              <textarea
                class="w-full resize-none bg-transparent text-sm outline-none"
                style="color: var(--text-primary);"
                rows="2"
                autofocus
                bind:value={editText}
                onblur={saveCardEdit}
                onkeydown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); saveCardEdit(); }
                  if (e.key === "Escape") { editingCardId = null; editingColIdx = null; }
                }}
              ></textarea>
            {:else}
              <div class="flex items-start gap-2">
                <input
                  type="checkbox"
                  checked={card.done}
                  style="accent-color: var(--accent); margin-top: 3px;"
                  onchange={() => commit(updateCard(board, colIdx, card.id, { done: !card.done }))}
                />
                <!-- svelte-ignore a11y_click_events_have_key_events -->
                <!-- svelte-ignore a11y_no_static_element_interactions -->
                <span
                  class="min-w-0 flex-1 break-words {card.done ? 'line-through opacity-60' : ''}"
                  ondblclick={() => startEditCard(colIdx, card.id, card.text)}
                  title="Double-click to edit"
                >{card.text}</span>
                <button
                  class="invisible rounded px-1 text-xs group-hover:visible"
                  style="color: var(--text-secondary);"
                  onclick={() => commit(deleteCard(board, colIdx, card.id))}
                  title="Delete card"
                >✕</button>
              </div>
            {/if}
          </div>
        {/each}
        {#if dropTarget?.colIdx === colIdx && dropTarget.cardIdx >= cardsOf(col).length && dragging}
          <div class="h-1 rounded" style="background-color: var(--accent);"></div>
        {/if}

        {#if newCardCol === colIdx}
          <!-- svelte-ignore a11y_autofocus -->
          <textarea
            class="w-full resize-none rounded p-2 text-sm outline-none"
            style="background-color: var(--bg-surface); border: 1px solid var(--accent); color: var(--text-primary);"
            rows="2"
            autofocus
            placeholder="Card text..."
            bind:value={newCardText}
            onblur={() => submitNewCard(colIdx)}
            onkeydown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submitNewCard(colIdx); }
              if (e.key === "Escape") { newCardCol = null; newCardText = ""; }
            }}
          ></textarea>
        {:else}
          <button
            class="rounded p-1.5 text-left text-xs hover:opacity-80"
            style="color: var(--text-secondary);"
            onclick={() => { newCardCol = colIdx; newCardText = ""; }}
          >
            + Add card
          </button>
        {/if}
      </div>
    </div>
  {/each}

  <div class="w-64 shrink-0">
    {#if addingColumn}
      <!-- svelte-ignore a11y_autofocus -->
      <input
        class="w-full rounded p-2 text-sm outline-none"
        style="background-color: var(--bg-surface); border: 1px solid var(--accent); color: var(--text-primary);"
        autofocus
        placeholder="Column title..."
        bind:value={newColumnTitle}
        onblur={submitNewColumn}
        onkeydown={(e) => {
          if (e.key === "Enter") submitNewColumn();
          if (e.key === "Escape") { addingColumn = false; newColumnTitle = ""; }
        }}
      />
    {:else}
      <button
        class="w-full rounded p-2 text-left text-sm hover:opacity-80"
        style="color: var(--text-secondary); border: 1px dashed var(--border);"
        onclick={() => (addingColumn = true)}
      >
        + Add column
      </button>
    {/if}
  </div>
</div>
