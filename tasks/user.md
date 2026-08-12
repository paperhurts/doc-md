# Handoff: v0.3.0 releasing

Everything you tested today is merged and released to main: app icon (#54), UI zoom (#56), transcript follow (#59). Tag `v0.3.0` is pushed and the release workflow is building installers for Windows/macOS/Linux — the first release build that compiles whisper.cpp and xcap on all three platforms.

## What's left (mostly me, watching CI)
1. Release run finishes → I review the draft release → you (or I, say the word) click **Publish**.
2. After publish, https://paperhurts.github.io/doc-md/ shows v0.3.0 automatically — no redeploy.
3. Installers are still unsigned (#43 on hold) — SmartScreen will warn on first install, as with v0.2.0.

## For you, once published
- Install v0.3.0 over your v0.2.0 desktop install — your Start-menu shortcut finally gets the new MD icon and all the capture/zoom/follow features outside the dev tree.
- Your vault/notes are untouched by upgrades (they're just files in your repo).

## Local state
- Repo is on `main`, synced. If your dev server is still running it's now serving main — restart before the next dev session anyway.
- Your icon candidates (`tasks/.user-logo-options/`) and screenshots (`tasks/.user-screenshots/`) are gitignored and untouched.
