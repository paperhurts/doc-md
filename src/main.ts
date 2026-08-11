import { mount } from "svelte";
import App from "./App.svelte";
import StickyNote from "./lib/components/StickyNote.svelte";
import CaptureOverlay from "./lib/components/CaptureOverlay.svelte";

// Secondary windows load the same bundle with a query param:
// ?sticky=<note path> for sticky notes, ?capture=1 for the screenshot overlay
const params = new URLSearchParams(window.location.search);
const stickyPath = params.get("sticky");
const captureMode = params.get("capture");

const target = document.getElementById("app")!;
const app = captureMode
  ? mount(CaptureOverlay, { target })
  : stickyPath
    ? mount(StickyNote, { target, props: { path: stickyPath } })
    : mount(App, { target });

export default app;
