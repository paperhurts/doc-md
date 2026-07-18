<script lang="ts">
  import { EditorView } from "@codemirror/view";
  import { EditorState, Compartment } from "@codemirror/state";
  import { createEditorExtensions } from "../editor/setup";
  import { livePreviewExtensions } from "../editor/livepreview";
  import { applyFormat, type SelectionInfo, type FormatAction } from "../editor/toolbar";

  let {
    content = "",
    livePreview = false,
    onchange,
    onsave,
    onnavigate,
    onselectionchange,
    onformatready,
    onpasteimage,
  }: {
    content: string;
    livePreview?: boolean;
    onchange?: (content: string) => void;
    onsave?: () => void;
    onnavigate?: (noteName: string) => void;
    onselectionchange?: (info: SelectionInfo) => void;
    onformatready?: (handler: (action: FormatAction) => void) => void;
    onpasteimage?: (blob: File) => Promise<string | null>;
  } = $props();

  const modeCompartment = new Compartment();

  let container: HTMLDivElement;
  let view: EditorView | undefined;
  let currentContent = $state(content);
  let initialContent = content;

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

  // Create the editor once when the container is available
  $effect(() => {
    if (!container) return;

    const extensions = [
      ...createEditorExtensions(handleUpdate, onnavigate, onselectionchange, onpasteimage),
      modeCompartment.of(livePreview ? livePreviewExtensions() : []),
    ];

    const state = EditorState.create({
      doc: initialContent,
      extensions,
    });

    view = new EditorView({
      state,
      parent: container,
    });

    // Expose format handler so parent can dispatch commands without accessing view
    onformatready?.((action: FormatAction) => {
      if (view) applyFormat(view, action);
    });

    return () => {
      view?.destroy();
      view = undefined;
    };
  });

  // Reconfigure live preview mode without recreating the editor
  $effect(() => {
    const enabled = livePreview;
    if (view) {
      view.dispatch({
        effects: modeCompartment.reconfigure(enabled ? livePreviewExtensions() : []),
      });
    }
  });

  // Update editor content when the prop changes externally (e.g. switching files)
  $effect(() => {
    if (view && content !== currentContent) {
      view.dispatch({
        changes: {
          from: 0,
          to: view.state.doc.length,
          insert: content,
        },
      });
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
