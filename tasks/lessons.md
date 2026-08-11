# Lessons Learned

Persistent learnings from corrections. Review at session start.

---

## 2026-04-02: Update README on refactors
- When refactoring, fixing bugs, or changing architecture, update the README/docs
- User added rule to CLAUDE.md: "if you refactor, fix bugs, change architecture, update readme file"
- Don't wait for the user to ask — docs should stay in sync with code changes

## 2026-04-03: Always update docs after merging
- After merging a PR that completes a phase or adds features, immediately update PLAN.md, PROJECT_STATUS.md, and README.md
- Don't wait for the user to remind you — it's part of the merge workflow

## 2026-07-18: Never use native prompt()/alert()/confirm() in the webview
- WebView2 renders them with the page origin as the title ("localhost:5420 says") — looks broken/unbranded; user caught it on the New-note flow
- Use dialogStore (src/lib/stores/dialogs.svelte.ts) + DialogHost instead; it's async: `await dialogStore.prompt(...)/confirm(...)/alert(...)`
- When adding any new UI flow, grep for prompt(/alert(/confirm( before calling it done

## 2026-07-18: Don't git-checkout under a running Vite dev server
- Switching branches while the user's `cargo tauri dev` served the tree split Vite's HMR module graph: the dialog store loaded as two instances (one importer had a `?t=` timestamped URL), so the palette set state on one instance while DialogHost rendered the other — clicks silently did nothing
- Symptom pattern: feature works on a fresh server but not in the long-running one, no console errors
- Rule: if the user has a dev server running, either ask before branch churn or tell them a dev-server restart is required afterward — a webview Ctrl+R is NOT enough (the server graph itself is stale)

## 2026-07-18: Background Bash on Windows can orphan child processes
- TaskStop on a `npm run dev` shell killed the shell but the child node/vite kept port 5420, breaking the user's later `cargo tauri dev`
- After stopping a background dev server, verify the port is actually free (Get-NetTCPConnection) and kill the child if needed

## 2026-04-03: Docs are part of done — no exceptions

Before marking ANY task complete, ask: "If someone cloned this repo 
right now, would the docs accurately describe what they'd find?"

If no → update docs first, THEN mark done. No exceptions for "small" 
fixes, "just" bug fixes, or "obvious" changes. Small lies in docs 
compound into big confusion.
## 2026-08-10 — A plausible environment explanation is not a diagnosis
Round-0 report "preview doesn't work / doesn't swap documents" was written off as the user testing the stale installed v0.2.0. Round 4 proved the bug real and severe: the Editor-creation $effect tracked `livePreview`, so every view-mode switch rebuilt CodeMirror from the content at file-open time — silent data loss on the next keystroke. Pattern: when a bug report has a convenient environmental explanation, STILL walk the code path before closing it. Corollary for Svelte 5: any $effect that creates a long-lived resource must `untrack()` everything except its trigger, or a prop change destroys and recreates the resource; test by toggling every prop after an edit.

## 2026-08-09 — Mock-mode green does not clear the desktop app
User test of #47 failed on bugs that were invisible in browser mock mode: Vite dep re-optimization reloading the app mid-flow, overlay window timing (IPC latency), FS watcher noise from repo-as-vault. Pattern: mock mode validates logic, NOT windowing/IPC/dev-server behavior. Before handing off desktop features: (1) pre-bundle every lazily-imported Tauri module in optimizeDeps, (2) reason about window show/hide timing against slow IPC, (3) assume the user's vault is hostile (their code repo). Also: I cannot drive the native window remotely — desktop flows need the user's hands; write the handoff steps to be diagnosable from their prose.
