<script lang="ts">
  import { untrack } from "svelte";
  import { EditorView } from "@codemirror/view";
  import { EditorState, Compartment } from "@codemirror/state";
  import { createEditorExtensions } from "../editor/setup";
  import { livePreviewExtensions } from "../editor/livepreview";
  import { applyFormat, type SelectionInfo, type FormatAction } from "../editor/toolbar";
  import { minimalChange, isPureAppend } from "../editor/diff";
  import { transcriptFollow } from "../stores/transcriptFollow.svelte";

  let {
    content = "",
    livePreview = false,
    resolveImage,
    onchange,
    onsave,
    onnavigate,
    onselectionchange,
    onformatready,
    oninsertready,
    onscrollready,
    onpasteimage,
  }: {
    content: string;
    livePreview?: boolean;
    /** Resolve a markdown image src for live-preview rendering (null = leave raw). */
    resolveImage?: (src: string) => string | null;
    onchange?: (content: string) => void;
    onsave?: () => void;
    onnavigate?: (noteName: string) => void;
    onselectionchange?: (info: SelectionInfo) => void;
    onformatready?: (handler: (action: FormatAction) => void) => void;
    /** Insert text at the cursor; returns false when no live view exists. */
    oninsertready?: (handler: (text: string) => boolean) => void;
    /** Scroll to the end of the document; returns false when no live view exists. */
    onscrollready?: (handler: () => boolean) => void;
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

  /** Scroll a container hard to its bottom — now, and again next frame once
   * CodeMirror's post-dispatch measure pass has settled the real heights.
   * Only ever scrolls DOWN, so the upward-scroll break detector ignores it. */
  function pinToBottom(scroller: HTMLElement) {
    scroller.scrollTop = scroller.scrollHeight;
    requestAnimationFrame(() => {
      scroller.scrollTop = scroller.scrollHeight;
    });
  }

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

  // Create the editor exactly once when the container is available. Everything
  // except `container` is read inside untrack: if this effect tracked any
  // other prop (livePreview, callbacks), a prop change would DESTROY and
  // RECREATE the view from initialContent — silently reverting all edits made
  // since the file was opened. Mode switches go through the reconfigure
  // effect below instead.
  $effect(() => {
    if (!container) return;
    return untrack(() => {
      const extensions = [
        ...createEditorExtensions(handleUpdate, onnavigate, onselectionchange, onpasteimage),
        modeCompartment.of(livePreview ? livePreviewExtensions({ resolveImage }) : []),
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

      // Expose scroll-to-end (transcription follow mode's resume button)
      onscrollready?.(() => {
        if (!view) return false;
        pinToBottom(view.scrollDOM);
        return true;
      });

      // Follow-mode break: an UPWARD scroll during an active transcription
      // session means the user scrolled back to read — stop tracking. Only
      // direction is checked (not distance-from-bottom) because our own pins
      // and CM's height-estimate corrections can leave the position slightly
      // shy of the true bottom, which must not count as a user break.
      const scroller = view.scrollDOM;
      let lastScrollTop = scroller.scrollTop;
      const handleScroll = () => {
        const top = scroller.scrollTop;
        if (transcriptFollow.shouldFollow && top < lastScrollTop - 8) {
          transcriptFollow.breakFollow();
        }
        lastScrollTop = top;
      };
      scroller.addEventListener("scroll", handleScroll);

      return () => {
        scroller.removeEventListener("scroll", handleScroll);
        view?.destroy();
        view = undefined;
      };
    });
  });

  // Reconfigure live preview mode without recreating the editor
  $effect(() => {
    const enabled = livePreview;
    if (view) {
      view.dispatch({
        effects: modeCompartment.reconfigure(enabled ? livePreviewExtensions({ resolveImage }) : []),
      });
    }
  });

  // Update editor content when the prop changes externally (switching files,
  // transcript appends, FS-watcher refreshes). Dispatch only the changed span
  // so CM maps the cursor through it and the scroll position survives —
  // full-document replacement yanked the user to the top of the file.
  $effect(() => {
    if (view && content !== currentContent) {
      const oldDoc = view.state.doc.toString();
      const change = minimalChange(oldDoc, content);
      if (change) {
        // Transcription follow mode: keep the bottom in view when a session
        // is appending lines. Untracked so a follow-state flip doesn't re-run
        // this effect; pure-append shape excludes tab switches and edits
        // elsewhere in the document.
        const follow =
          untrack(() => transcriptFollow.shouldFollow) && isPureAppend(change, oldDoc.length);
        syncingExternal = true;
        try {
          view.dispatch({ changes: change });
        } finally {
          syncingExternal = false;
        }
        // Pin AFTER the dispatch: CM's scrollIntoView aims at estimated line
        // positions and can land short of the true bottom; a direct
        // scrollTop = scrollHeight pin is exact.
        if (follow) pinToBottom(view.scrollDOM);
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
