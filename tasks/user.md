# v0.3.0 is live 🎉

https://github.com/paperhurts/doc-md/releases/tag/v0.3.0 — published 2026-08-12. The downloads page (https://paperhurts.github.io/doc-md/) serves it automatically.

## If you want it installed
Grab `doc-md_0.3.0_x64-setup.exe` (or the .msi) from the downloads page and install over v0.2.0. SmartScreen will warn (unsigned, #43 on hold) — "More info → Run anyway". Your vault/notes are untouched. Your Start-menu shortcut gets the new MD icon and everything you tested today: capture, transcription + follow mode, UI zoom, sticky themes.

## Repo state
- `main` synced, all feature branches deleted, issues #54/#55/#56/#59 closed.
- Release CI got hardened over 3 attempts (details in PROJECT_STATUS.md) — future tags should build clean on the first try.
- Note for the future: Linux artifacts now need glibc ≥ 2.39 (built on Ubuntu 24.04) and macOS needs 10.15 Catalina+.

## On deck (say which, any time)
#57 per-theme font sizes (quick) · #58 sticky themes surviving restarts · #43 signing (blocked on your Azure setup) · #46 a11y audit · #21 git sync
