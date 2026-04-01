<script lang="ts">
  import { sidecarPing } from "./lib/services/tauri";

  let status = $state("Ready");
  let sidecarStatus = $state("Not connected");

  async function checkSidecar() {
    try {
      const response = await sidecarPing();
      sidecarStatus = `Connected — ${response}`;
    } catch (e) {
      sidecarStatus = `Error: ${e}`;
    }
  }
</script>

<main class="flex h-full flex-col">
  <header
    class="flex h-10 items-center justify-between border-b px-4"
    style="border-color: var(--border); background-color: var(--bg-secondary);"
  >
    <span class="text-sm font-semibold" style="color: var(--accent);">doc-md</span>
    <span class="text-xs" style="color: var(--text-secondary);">{status}</span>
  </header>

  <div class="flex flex-1 items-center justify-center">
    <div class="text-center">
      <h1 class="mb-4 text-3xl font-bold" style="color: var(--text-primary);">doc-md</h1>
      <p class="mb-6" style="color: var(--text-secondary);">
        A local-first markdown knowledge base
      </p>
      <div class="mb-4 rounded-lg p-4" style="background-color: var(--bg-surface);">
        <p class="mb-2 text-sm" style="color: var(--text-secondary);">
          Sidecar: {sidecarStatus}
        </p>
        <button
          class="rounded px-4 py-2 text-sm font-medium transition-colors hover:opacity-90"
          style="background-color: var(--accent); color: var(--bg-primary);"
          onclick={checkSidecar}
        >
          Test Sidecar Connection
        </button>
      </div>
    </div>
  </div>
</main>
