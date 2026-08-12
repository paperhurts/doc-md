# Session scratchpad

## Current: #54 app icon → then #55 release v0.3.0

Done this session (2026-08-12):
- User picked the MD-monogram-with-down-arrow concept (midnight + cyan)
- Authored vector master `src-tauri/app-icon.svg` (pure paths, no font deps)
- Regenerated all of `src-tauri/icons/` via `npm run tauri icon src-tauri/app-icon.svg`
- RELEASING.md icon section updated (SVG is the source of truth now)
- Branch `issue-54-app-icon`, committed, NOT pushed — awaiting user test (tasks/user.md)

Next after user approves icon:
- Push branch, PR, merge, close #54
- #55 release v0.3.0: CHANGELOG entry, bump versions (package.json, tauri.conf.json,
  Cargo.toml), tag per RELEASING.md, WATCH the release CI — first tag build with
  whisper.cpp + xcap on the Linux/macOS legs (unproven; unsigned, #43 on hold)
