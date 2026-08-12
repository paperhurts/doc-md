<script lang="ts">
  import { settingsStore } from "../stores/settings.svelte";

  let visible = $state(false);
  let timer: ReturnType<typeof setTimeout> | undefined;
  let first = true;

  const pct = $derived(Math.round(settingsStore.settings.uiZoom * 100));

  $effect(() => {
    void settingsStore.settings.uiZoom; // track changes
    if (first) {
      // Startup restore shouldn't flash the badge.
      first = false;
      return;
    }
    visible = true;
    clearTimeout(timer);
    timer = setTimeout(() => (visible = false), 1200);
    return () => clearTimeout(timer);
  });
</script>

{#if visible}
  <div
    class="pointer-events-none fixed bottom-4 right-4 z-[70] rounded px-3 py-1.5 text-sm font-semibold shadow-lg"
    style="background-color: var(--bg-secondary); color: var(--text-primary); border: 1px solid var(--border);"
  >
    {pct}%
  </div>
{/if}
