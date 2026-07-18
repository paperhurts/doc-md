<script lang="ts">
  import { dialogStore } from "../stores/dialogs.svelte";

  const req = $derived(dialogStore.current);
  let value = $state("");
  let inputEl = $state<HTMLInputElement | null>(null);

  // Reset the input each time a new request becomes active
  $effect(() => {
    if (req) {
      value = req.initial ?? "";
      if (req.kind === "prompt") {
        setTimeout(() => inputEl?.focus(), 30);
      }
    }
  });

  function ok() {
    dialogStore.submit(value.trim());
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === "Enter") {
      e.preventDefault();
      ok();
    }
    if (e.key === "Escape") {
      e.preventDefault();
      dialogStore.cancel();
    }
  }
</script>

{#if req}
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    class="fixed inset-0 z-[60] flex items-start justify-center pt-32"
    style="background: var(--modal-backdrop);"
    onclick={() => dialogStore.cancel()}
    onkeydown={handleKeydown}
  >
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div
      class="w-full max-w-sm p-4 shadow-2xl"
      style="background-color: var(--bg-secondary); border: 1px solid var(--border-strong); border-radius: var(--radius-lg);"
      role="dialog"
      aria-modal="true"
      onclick={(e) => e.stopPropagation()}
    >
      <p class="mb-3 text-sm" style="color: var(--text-primary);">{req.title}</p>

      {#if req.kind === "prompt"}
        <input
          bind:this={inputEl}
          bind:value
          onkeydown={handleKeydown}
          type="text"
          placeholder={req.placeholder}
          class="mb-3 w-full rounded px-3 py-2 text-sm outline-none"
          style="background-color: var(--bg-surface); color: var(--text-primary); border: 1px solid var(--accent);"
        />
      {/if}

      <div class="flex justify-end gap-2">
        {#if req.kind !== "alert"}
          <button
            class="rounded px-3 py-1 text-xs"
            style="color: var(--text-secondary); border: 1px solid var(--border);"
            onclick={() => dialogStore.cancel()}
          >
            Cancel
          </button>
        {/if}
        <button
          class="rounded px-3 py-1 text-xs font-semibold"
          style="color: var(--bg-primary); background-color: var(--accent);"
          onclick={ok}
        >
          OK
        </button>
      </div>
    </div>
  </div>
{/if}
