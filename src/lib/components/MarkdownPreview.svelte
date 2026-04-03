<script lang="ts">
  import { renderMarkdown } from "../editor/markdown";
  import { vaultStore } from "../stores/vault.svelte";
  import "katex/dist/katex.min.css";

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
    font-family: var(--font-body);
    font-size: var(--font-size, 14px);
    line-height: 1.7;
  }

  .preview :global(h1) {
    font-family: var(--font-heading);
    font-size: 2em;
    font-weight: 700;
    margin: 0.8em 0 0.4em;
    color: var(--heading-1);
    border-bottom: 1px solid var(--border);
    padding-bottom: 0.3em;
  }
  .preview :global(h2) {
    font-family: var(--font-heading);
    font-size: 1.5em;
    font-weight: 700;
    margin: 0.8em 0 0.4em;
    color: var(--heading-2);
    border-bottom: 1px solid var(--border);
    padding-bottom: 0.2em;
  }
  .preview :global(h3) {
    font-family: var(--font-heading);
    font-size: 1.25em;
    font-weight: 600;
    margin: 0.6em 0 0.3em;
    color: var(--heading-3);
  }
  .preview :global(h4),
  .preview :global(h5),
  .preview :global(h6) {
    font-family: var(--font-heading);
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
    color: var(--tag-color);
    background: var(--tag-bg);
    padding: 0 4px;
    border-radius: 3px;
    font-size: 0.9em;
  }

  .preview :global(code) {
    background: var(--bg-surface);
    padding: 2px 6px;
    border-radius: var(--radius);
    font-family: var(--font-mono);
    font-size: 0.88em;
    color: var(--accent);
  }
  .preview :global(pre) {
    background: var(--bg-surface);
    padding: 16px;
    border-radius: var(--radius-lg);
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
    background: var(--accent-subtle);
    border-radius: 0 var(--radius) var(--radius) 0;
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
    color: var(--strong);
  }
  .preview :global(em) {
    color: var(--em);
  }
  .preview :global(.math-block) {
    margin: 1em 0;
    text-align: center;
    overflow-x: auto;
  }
  .preview :global(.math-error) {
    color: #f38ba8;
  }
</style>
