<script lang="ts">
  import { renderMarkdown } from "../editor/markdown";
  import { vaultStore } from "../stores/vault.svelte";

  let { content = "" }: { content: string } = $props();

  const html = $derived(renderMarkdown(content));

  function handleClick(e: MouseEvent) {
    const target = e.target as HTMLElement;
    if (target.classList.contains("wikilink")) {
      e.preventDefault();
      const noteName = target.dataset.target;
      if (noteName) {
        vaultStore.navigateToNote(noteName);
      }
    }
  }
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="preview h-full overflow-y-auto p-6" onclick={handleClick}>
  {@html html}
</div>

<style>
  .preview {
    background-color: var(--bg-primary);
    color: var(--text-primary);
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    line-height: 1.7;
  }

  .preview :global(h1) {
    font-size: 2em;
    font-weight: 700;
    margin: 0.8em 0 0.4em;
    color: #f38ba8;
    border-bottom: 1px solid var(--border);
    padding-bottom: 0.3em;
  }
  .preview :global(h2) {
    font-size: 1.5em;
    font-weight: 700;
    margin: 0.8em 0 0.4em;
    color: #fab387;
    border-bottom: 1px solid var(--border);
    padding-bottom: 0.2em;
  }
  .preview :global(h3) {
    font-size: 1.25em;
    font-weight: 600;
    margin: 0.6em 0 0.3em;
    color: #f9e2af;
  }
  .preview :global(h4),
  .preview :global(h5),
  .preview :global(h6) {
    font-weight: 600;
    margin: 0.5em 0 0.3em;
  }

  .preview :global(p) {
    margin: 0.6em 0;
  }

  .preview :global(a) {
    color: var(--accent);
    text-decoration: none;
  }
  .preview :global(a:hover) {
    text-decoration: underline;
  }
  .preview :global(.wikilink) {
    color: var(--accent);
    text-decoration-style: dotted;
    text-decoration-line: underline;
    cursor: pointer;
  }
  .preview :global(.md-tag) {
    color: #cba6f7;
    background: rgba(203, 166, 247, 0.1);
    padding: 0 4px;
    border-radius: 3px;
    font-size: 0.9em;
  }

  .preview :global(code) {
    background: var(--bg-surface);
    padding: 2px 6px;
    border-radius: 4px;
    font-family: "JetBrains Mono", "Fira Code", monospace;
    font-size: 0.88em;
    color: #a6e3a1;
  }
  .preview :global(pre) {
    background: var(--bg-surface);
    padding: 16px;
    border-radius: 8px;
    overflow-x: auto;
    margin: 0.8em 0;
  }
  .preview :global(pre code) {
    background: none;
    padding: 0;
  }

  .preview :global(blockquote) {
    border-left: 3px solid var(--accent);
    margin: 0.8em 0;
    padding: 0.4em 1em;
    color: var(--text-secondary);
    background: rgba(137, 180, 250, 0.05);
    border-radius: 0 4px 4px 0;
  }

  .preview :global(ul),
  .preview :global(ol) {
    padding-left: 1.5em;
    margin: 0.5em 0;
  }
  .preview :global(li) {
    margin: 0.2em 0;
  }
  .preview :global(.task-item) {
    list-style: none;
    margin-left: -1.5em;
  }
  .preview :global(.task-item input) {
    margin-right: 6px;
    accent-color: var(--accent);
  }

  .preview :global(hr) {
    border: none;
    border-top: 1px solid var(--border);
    margin: 1.5em 0;
  }

  .preview :global(table) {
    border-collapse: collapse;
    width: 100%;
    margin: 0.8em 0;
  }
  .preview :global(th),
  .preview :global(td) {
    border: 1px solid var(--border);
    padding: 8px 12px;
    text-align: left;
  }
  .preview :global(th) {
    background: var(--bg-surface);
    font-weight: 600;
  }

  .preview :global(img) {
    max-width: 100%;
    border-radius: 4px;
  }
  .preview :global(strong) {
    color: #f38ba8;
  }
  .preview :global(em) {
    color: #f5c2e7;
  }
</style>
