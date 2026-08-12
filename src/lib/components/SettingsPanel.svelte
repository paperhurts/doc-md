<script lang="ts">
  import { settingsStore, SHORTCUTS } from "../stores/settings.svelte";
  import { themeStore } from "../stores/theme.svelte";
  import { setCaptureShortcut, getCaptureShortcutError } from "../services/screenshot";
  import {
    getTranscriptionModels,
    TRANSCRIPTION_MODELS,
    type ModelInfo,
  } from "../services/transcription";
  import { isTauri } from "../services/env";

  let { open = false, onclose }: { open: boolean; onclose: () => void } = $props();

  let hotkeyInput = $state("");
  let hotkeyError = $state<string | null>(null);
  let hotkeySaved = $state(false);
  let modelInfo = $state<ModelInfo[]>([]);

  // Refresh hotkey state each time the panel opens; surface any startup
  // registration failure (e.g. another app owns the combo)
  $effect(() => {
    if (open) {
      hotkeyInput = settingsStore.settings.captureHotkey;
      hotkeyError = null;
      hotkeySaved = false;
      if (isTauri()) {
        getCaptureShortcutError().then((e) => {
          if (e) hotkeyError = e;
        });
      }
      getTranscriptionModels()
        .then((m) => (modelInfo = m))
        .catch(() => (modelInfo = [])); // engine unavailable — hide badges
    }
  });

  function isDownloaded(id: string): boolean {
    return modelInfo.find((m) => m.id === id)?.downloaded ?? false;
  }

  async function applyHotkey() {
    const next = hotkeyInput.trim();
    if (!next || next === settingsStore.settings.captureHotkey) return;
    hotkeyError = null;
    hotkeySaved = false;
    try {
      await setCaptureShortcut(next, settingsStore.settings.captureHotkey);
      settingsStore.update({ captureHotkey: next });
      hotkeySaved = true;
    } catch (e) {
      hotkeyError = String(e);
    }
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === "Escape") onclose();
  }
</script>

{#if open}
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    class="fixed inset-0 z-50 flex items-center justify-center"
    style="background: var(--modal-backdrop);"
    onclick={onclose}
    onkeydown={handleKeydown}
  >
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div
      class="w-full max-w-lg max-h-[80vh] overflow-y-auto shadow-2xl"
      style="background-color: var(--bg-secondary); border: 1px solid var(--border); border-radius: var(--radius-lg);"
      onclick={(e) => e.stopPropagation()}
    >
      <!-- Header -->
      <div class="flex items-center justify-between px-5 py-4" style="border-bottom: 1px solid var(--border);">
        <h2 class="text-sm font-semibold" style="color: var(--text-primary);">Settings</h2>
        <button
          class="rounded px-2 py-0.5 text-xs"
          style="color: var(--text-secondary); border: 1px solid var(--border);"
          onclick={onclose}
        >
          Close
        </button>
      </div>

      <div class="p-5 space-y-6">
        <!-- Theme -->
        <section>
          <h3 class="mb-2 text-xs font-semibold uppercase tracking-wider" style="color: var(--text-secondary);">Theme</h3>
          <div class="flex flex-wrap gap-2">
            {#each themeStore.themes as theme (theme.id)}
              <button
                class="rounded px-3 py-1.5 text-xs"
                style="
                  background-color: {themeStore.current === theme.id ? 'var(--accent-subtle)' : 'var(--bg-surface)'};
                  color: {themeStore.current === theme.id ? 'var(--accent)' : 'var(--text-primary)'};
                  border: 1px solid {themeStore.current === theme.id ? 'var(--accent)' : 'var(--border)'};
                  border-radius: var(--radius);
                "
                onclick={() => themeStore.setTheme(theme.id)}
              >
                {theme.name}
              </button>
            {/each}
          </div>
        </section>

        <!-- Display -->
        <section>
          <h3 class="mb-3 text-xs font-semibold uppercase tracking-wider" style="color: var(--text-secondary);">Display</h3>
          <div class="space-y-3">
            <div class="flex items-center justify-between">
              <label class="text-sm" style="color: var(--text-primary);">UI zoom (Ctrl+Scroll)</label>
              <div class="flex items-center gap-2">
                <input
                  type="range"
                  min="50"
                  max="200"
                  step="10"
                  value={Math.round(settingsStore.settings.uiZoom * 100)}
                  oninput={(e) => settingsStore.update({ uiZoom: Number(e.currentTarget.value) / 100 })}
                  class="w-24"
                />
                <span class="w-10 text-right text-xs" style="color: var(--text-secondary);">{Math.round(settingsStore.settings.uiZoom * 100)}%</span>
              </div>
            </div>
          </div>
        </section>

        <!-- Editor -->
        <section>
          <h3 class="mb-3 text-xs font-semibold uppercase tracking-wider" style="color: var(--text-secondary);">Editor</h3>
          <div class="space-y-3">
            <div class="flex items-center justify-between">
              <label class="text-sm" style="color: var(--text-primary);">Editor font size</label>
              <div class="flex items-center gap-2">
                <input
                  type="range"
                  min="10"
                  max="24"
                  value={settingsStore.settings.editorFontSize}
                  oninput={(e) => settingsStore.update({ editorFontSize: Number(e.currentTarget.value) })}
                  class="w-24"
                />
                <span class="w-8 text-right text-xs" style="color: var(--text-secondary);">{settingsStore.settings.editorFontSize}px</span>
              </div>
            </div>

            <div class="flex items-center justify-between">
              <label class="text-sm" style="color: var(--text-primary);">Preview font size</label>
              <div class="flex items-center gap-2">
                <input
                  type="range"
                  min="12"
                  max="24"
                  value={settingsStore.settings.fontSize}
                  oninput={(e) => settingsStore.update({ fontSize: Number(e.currentTarget.value) })}
                  class="w-24"
                />
                <span class="w-8 text-right text-xs" style="color: var(--text-secondary);">{settingsStore.settings.fontSize}px</span>
              </div>
            </div>

            <div class="flex items-center justify-between">
              <label class="text-sm" style="color: var(--text-primary);">Tab size</label>
              <div class="flex items-center gap-2">
                {#each [2, 4] as size}
                  <button
                    class="rounded px-3 py-1 text-xs"
                    style="
                      background-color: {settingsStore.settings.tabSize === size ? 'var(--accent-subtle)' : 'var(--bg-surface)'};
                      color: {settingsStore.settings.tabSize === size ? 'var(--accent)' : 'var(--text-primary)'};
                      border: 1px solid {settingsStore.settings.tabSize === size ? 'var(--accent)' : 'var(--border)'};
                      border-radius: var(--radius);
                    "
                    onclick={() => settingsStore.update({ tabSize: size })}
                  >
                    {size} spaces
                  </button>
                {/each}
              </div>
            </div>

            <div class="flex items-center justify-between">
              <label class="text-sm" style="color: var(--text-primary);">Auto-save delay</label>
              <div class="flex items-center gap-2">
                <input
                  type="range"
                  min="500"
                  max="5000"
                  step="500"
                  value={settingsStore.settings.autoSaveDelay}
                  oninput={(e) => settingsStore.update({ autoSaveDelay: Number(e.currentTarget.value) })}
                  class="w-24"
                />
                <span class="w-10 text-right text-xs" style="color: var(--text-secondary);">{settingsStore.settings.autoSaveDelay / 1000}s</span>
              </div>
            </div>

            <div class="flex items-center justify-between">
              <label class="text-sm" style="color: var(--text-primary);">Line numbers</label>
              <button
                class="rounded px-3 py-1 text-xs"
                style="
                  background-color: {settingsStore.settings.showLineNumbers ? 'var(--accent-subtle)' : 'var(--bg-surface)'};
                  color: {settingsStore.settings.showLineNumbers ? 'var(--accent)' : 'var(--text-secondary)'};
                  border: 1px solid var(--border);
                  border-radius: var(--radius);
                "
                onclick={() => settingsStore.update({ showLineNumbers: !settingsStore.settings.showLineNumbers })}
              >
                {settingsStore.settings.showLineNumbers ? "On" : "Off"}
              </button>
            </div>

            <div class="flex items-center justify-between">
              <label class="text-sm" style="color: var(--text-primary);">Close to tray</label>
              <button
                class="rounded px-3 py-1 text-xs"
                style="
                  background-color: {settingsStore.settings.closeToTray ? 'var(--accent-subtle)' : 'var(--bg-surface)'};
                  color: {settingsStore.settings.closeToTray ? 'var(--accent)' : 'var(--text-secondary)'};
                  border: 1px solid var(--border);
                  border-radius: var(--radius);
                "
                onclick={() => settingsStore.update({ closeToTray: !settingsStore.settings.closeToTray })}
              >
                {settingsStore.settings.closeToTray ? "On" : "Off"}
              </button>
            </div>

            <div class="flex items-center justify-between">
              <label class="text-sm" style="color: var(--text-primary);">Preview by default</label>
              <button
                class="rounded px-3 py-1 text-xs"
                style="
                  background-color: {settingsStore.settings.showPreviewByDefault ? 'var(--accent-subtle)' : 'var(--bg-surface)'};
                  color: {settingsStore.settings.showPreviewByDefault ? 'var(--accent)' : 'var(--text-secondary)'};
                  border: 1px solid var(--border);
                  border-radius: var(--radius);
                "
                onclick={() => settingsStore.update({ showPreviewByDefault: !settingsStore.settings.showPreviewByDefault })}
              >
                {settingsStore.settings.showPreviewByDefault ? "On" : "Off"}
              </button>
            </div>
          </div>
        </section>

        <!-- Folders -->
        <section>
          <h3 class="mb-3 text-xs font-semibold uppercase tracking-wider" style="color: var(--text-secondary);">Folders</h3>
          <div class="space-y-3">
            <div class="flex items-center justify-between">
              <label class="text-sm" style="color: var(--text-primary);">Daily notes folder</label>
              <input
                type="text"
                value={settingsStore.settings.dailyNoteFolder}
                onchange={(e) => settingsStore.update({ dailyNoteFolder: e.currentTarget.value })}
                class="rounded px-2 py-1 text-xs outline-none w-28"
                style="background-color: var(--bg-surface); color: var(--text-primary); border: 1px solid var(--border); border-radius: var(--radius);"
              />
            </div>
            <div class="flex items-center justify-between">
              <label class="text-sm" style="color: var(--text-primary);">Template folder</label>
              <input
                type="text"
                value={settingsStore.settings.templateFolder}
                onchange={(e) => settingsStore.update({ templateFolder: e.currentTarget.value })}
                class="rounded px-2 py-1 text-xs outline-none w-28"
                style="background-color: var(--bg-surface); color: var(--text-primary); border: 1px solid var(--border); border-radius: var(--radius);"
              />
            </div>
          </div>
        </section>

        <!-- Screenshot -->
        <section>
          <h3 class="mb-3 text-xs font-semibold uppercase tracking-wider" style="color: var(--text-secondary);">Screenshot</h3>
          <div class="space-y-2">
            <div class="flex items-center justify-between">
              <label class="text-sm" style="color: var(--text-primary);">Capture hotkey (global)</label>
              <div class="flex items-center gap-2">
                <input
                  type="text"
                  bind:value={hotkeyInput}
                  placeholder="Ctrl+Shift+S"
                  class="rounded px-2 py-1 text-xs outline-none w-28"
                  style="background-color: var(--bg-surface); color: var(--text-primary); border: 1px solid var(--border); border-radius: var(--radius); font-family: var(--font-mono);"
                />
                <button
                  class="rounded px-3 py-1 text-xs"
                  style="color: var(--text-primary); border: 1px solid var(--border); border-radius: var(--radius);"
                  onclick={applyHotkey}
                >
                  Apply
                </button>
              </div>
            </div>
            {#if hotkeyError}
              <p class="text-xs" style="color: var(--error, #e5534b);">
                Hotkey unavailable: {hotkeyError}. Try another combination (e.g. Alt+Shift+S).
              </p>
            {:else if hotkeySaved}
              <p class="text-xs" style="color: var(--accent);">Hotkey updated.</p>
            {:else}
              <p class="text-xs" style="color: var(--text-secondary);">
                Works system-wide, even with doc-md in the tray. Windows reserves Win+Shift+S.
              </p>
            {/if}
          </div>
        </section>

        <!-- Transcription -->
        <section>
          <h3 class="mb-3 text-xs font-semibold uppercase tracking-wider" style="color: var(--text-secondary);">Transcription</h3>
          <div class="space-y-2">
            <div class="flex items-center justify-between">
              <label class="text-sm" style="color: var(--text-primary);">Whisper model</label>
              <div class="flex items-center gap-2">
                {#each TRANSCRIPTION_MODELS as model (model.id)}
                  <button
                    class="rounded px-3 py-1 text-xs"
                    style="
                      background-color: {settingsStore.settings.transcriptionModel === model.id ? 'var(--accent-subtle)' : 'var(--bg-surface)'};
                      color: {settingsStore.settings.transcriptionModel === model.id ? 'var(--accent)' : 'var(--text-primary)'};
                      border: 1px solid {settingsStore.settings.transcriptionModel === model.id ? 'var(--accent)' : 'var(--border)'};
                      border-radius: var(--radius);
                    "
                    title="{model.label} — {model.sizeMb} MB{isDownloaded(model.id) ? ', downloaded' : ''}"
                    onclick={() => settingsStore.update({ transcriptionModel: model.id })}
                  >
                    {model.id}{isDownloaded(model.id) ? " ✓" : ""}
                  </button>
                {/each}
              </div>
            </div>
            <p class="text-xs" style="color: var(--text-secondary);">
              Runs locally — audio never leaves this machine. Models download on first use
              from a transcription note (tiny 75 MB / base 142 MB / small 466 MB).
            </p>
          </div>
        </section>

        <!-- Keyboard Shortcuts -->
        <section>
          <h3 class="mb-3 text-xs font-semibold uppercase tracking-wider" style="color: var(--text-secondary);">Keyboard Shortcuts</h3>
          <div class="space-y-1">
            {#each SHORTCUTS as shortcut}
              <div class="flex items-center justify-between py-1">
                <span class="text-sm" style="color: var(--text-primary);">{shortcut.action}</span>
                <kbd
                  class="rounded px-2 py-0.5 text-xs"
                  style="background-color: var(--bg-surface); color: var(--text-secondary); border: 1px solid var(--border); border-radius: var(--radius); font-family: var(--font-mono);"
                >
                  {shortcut.key}
                </kbd>
              </div>
            {/each}
          </div>
        </section>

        <!-- Reset -->
        <div class="flex justify-end pt-2" style="border-top: 1px solid var(--border);">
          <button
            class="rounded px-3 py-1.5 text-xs"
            style="color: var(--text-secondary); border: 1px solid var(--border); border-radius: var(--radius);"
            onclick={() => settingsStore.reset()}
          >
            Reset to defaults
          </button>
        </div>
      </div>
    </div>
  </div>
{/if}
