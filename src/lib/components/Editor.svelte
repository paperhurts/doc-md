<script lang="ts">
  import { EditorView } from "@codemirror/view";
  import { EditorState } from "@codemirror/state";
  import { createEditorExtensions } from "../editor/setup";

  let {
    content = "",
    onchange,
    onsave,
  }: {
    content: string;
    onchange?: (content: string) => void;
    onsave?: () => void;
  } = $props();

  let container: HTMLDivElement;
  let view: EditorView | undefined;
  let currentContent = content;

  function handleUpdate(newContent: string) {
    currentContent = newContent;
    onchange?.(newContent);
  }

  function handleKeydown(e: KeyboardEvent) {
    if ((e.ctrlKey || e.metaKey) && e.key === "s") {
      e.preventDefault();
      onsave?.();
    }
  }

  $effect(() => {
    if (!container) return;

    const extensions = createEditorExtensions(handleUpdate);

    const state = EditorState.create({
      doc: content,
      extensions,
    });

    view = new EditorView({
      state,
      parent: container,
    });

    return () => {
      view?.destroy();
      view = undefined;
    };
  });

  // Update editor content when the file changes externally
  $effect(() => {
    if (view && content !== currentContent) {
      const transaction = view.state.update({
        changes: {
          from: 0,
          to: view.state.doc.length,
          insert: content,
        },
      });
      view.dispatch(transaction);
      currentContent = content;
    }
  });
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
  class="h-full overflow-hidden"
  bind:this={container}
  onkeydown={handleKeydown}
></div>

<style>
  div :global(.cm-editor) {
    height: 100%;
  }
  div :global(.cm-scroller) {
    overflow: auto;
  }
  div :global(.cm-wikilink-syntax) {
    color: var(--accent);
  }
</style>
