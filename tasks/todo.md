# Session scratchpad

## Next session: app icon (#54) → release v0.3.0 (#55)

State on entry:
- PR #52 (combined #47+#48+fix rounds) merged to main; issues #47–#51 closed by the merge
- Local repo should be on `main`, pulled (done at end of last session — verify with `git status`)
- User restarted PC — dev server not running; `cargo tauri dev` needs a fresh start

Icon workflow (#54):
1. Look at the 5 candidates in `tasks/.user-logo-options/` (gitignored, NEVER commit)
2. Ask user which one (or iterate); need a 1024x1024 master
3. `cargo tauri icon <master.png>` regenerates `src-tauri/icons/`
4. Dev-run to check window/taskbar/tray at small sizes
5. New branch per CLAUDE.md: `issue-54-app-icon`

Then release (#55): CHANGELOG entry, tag per RELEASING.md, watch the first
whisper.cpp release builds (Linux/macOS legs), unsigned (#43 still on hold).
