# Session scratchpad

## Current: v0.3.0 release workflow running

- #54/#56/#59 merged (PRs #60/#61/#62), #63 = version bump. Tag v0.3.0 pushed 2026-08-12 ~15:20 EDT.
- Release run 31632127527 — FIRST tag build with whisper.cpp + xcap on Linux/macOS legs.
  Windows leg de-risked by a successful local `npm run tauri build` (MSI + NSIS produced).
- When it finishes: review the DRAFT release on GitHub (artifacts + notes), Publish, close #55.
  Downloads page self-updates after publish — do NOT redeploy it.
- If a leg fails: likely missing system dep on the runner; fix in release.yml, delete+re-push tag.

Backlog next: #57 per-theme font scale, #58 sticky theme persistence, #43 signing (on hold), #46 a11y, #21 sync.
