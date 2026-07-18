import { mount } from "svelte";
import App from "./App.svelte";
import StickyNote from "./lib/components/StickyNote.svelte";

// Sticky windows load the same bundle with ?sticky=<note path>
const stickyPath = new URLSearchParams(window.location.search).get("sticky");

const app = stickyPath
  ? mount(StickyNote, {
      target: document.getElementById("app")!,
      props: { path: stickyPath },
    })
  : mount(App, {
      target: document.getElementById("app")!,
    });

export default app;
