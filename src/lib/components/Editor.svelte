<script lang="ts">
  import { EditorView } from "@codemirror/view";
  import { EditorState, Compartment } from "@codemirror/state";
  import { createEditorExtensions } from "../editor/setup";
  import { livePreviewExtensions } from "../editor/livepreview";
  import { applyFormat, type SelectionInfo, type FormatAction } from "../editor/toolbar";
  import { minimalChange } from "../editor/diff";

  let {
    content = "",
    livePreview = false,
    onchange,
    onsave,
    onnavigate,
    onselectionchange,
    onformatready,
    oninsertready,
    onpasteimage,
  }: {
    content: string;
    livePreview?: boolean;
    onchange?: (content: string) => void;
    onsave?: () => void;
    onnavigate?: (noteName: string) => void;
    onselectionchange?: (info: SelectionInfo) => void;
    onformatready?: (handler: (action: FormatAction) => void) => void;
    /** Insert text at the cursor; returns false when no live view exists. */
    oninsertready?: (handler: (text: string) => boolean) => void;
    onpasteimage?: (blob: File) => Promise<string | null>;
  } = $props();

  const modeCompartment = new Compartment();

  let container: HTMLDivElement;
  let view: EditorView | undefined;
  let currentContent = $state(content);
  let initialContent = content;
  // True while WE dispatch an external sync into the view — those updates
  // must not re-enter onchange (which would mark the file dirty and schedule
  // a save, feeding the FS-watcher a loop of our own echoes).
  let syncingExternal = false;

  function handleUpdate(newContent: string) {
    currentContent = newContent;
    if (!syncingExternal) onchange?.(newContent);
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

    // Expose insert-at-cursor for external content (e.g. screenshots)
    oninsertready?.((text: string) => {
      if (!view) return false;
      const { from, to } = view.state.selection.main;
      view.dispatch({
        changes: { from, to, insert: text },
        selection: { anchor: from + text.length },
      });
      return true;
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

  // Update editor content when the prop changes externally (switching files,
  // transcript appends, FS-watcher refreshes). Dispatch only the changed span
  // so CM maps the cursor through it and the scroll position survives —
  // full-document replacement yanked the user to the top of the file.
  $effect(() => {
    if (view && content !== currentContent) {
      const change = minimalChange(view.state.doc.toString(), content);
      if (change) {
        syncingExternal = true;
        try {
          view.dispatch({ changes: change });
        } finally {
          syncingExternal = false;
        }
      }
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
