# Session todo — 2026-08-09 (user test feedback on #47/#48)

User-reported bugs (from tasks/user.md inline comments + chat):
- [x] A. Dev reload storm: dynamic `@tauri-apps/api/*` imports trigger Vite dep re-optimize → full page reload → all tabs close ("booted to folder base"), capture listener dies (no markdown inserted). Fix: optimizeDeps.include.
- [x] B. Capture overlay blacks out screen: overlay shown before frozen frame arrives over IPC. Fix: keep hidden, show after <img> paints (+ Rust watchdog so main window can't stay hidden forever).
- [x] C. Cannot create note in subfolder: createNote hardcodes vault root; no folder context-menu entry. Fix: folder param + "New note" in dir context menu + test.
- [x] D. Watcher forwards .git/node_modules/target events (repo-as-vault). Fix: filter in watcher.rs to match list_files rules + tests.
- [x] Verify: vitest + cargo test green; then handoff update in tasks/user.md.
- [x] GitHub: comment findings on #47, #49; new issues for C and A.

Constraint: user's `cargo tauri dev` may be running — do NOT switch branches, do NOT start vite.
