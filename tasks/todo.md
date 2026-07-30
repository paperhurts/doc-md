# Current Session TODO — 2026-07-30

Goal: OneNote-style capture features. Plan approved (~/.claude/plans/immutable-shimmying-dongarra.md).

- #47 Screenshot capture (branch issue-47-screenshot-capture) — CODE COMPLETE, awaiting user test (tasks/user.md)
  - [x] Rust: Cargo deps, screenshot.rs, lib.rs wiring, capabilities
  - [x] Frontend: images.ts prefix, screenshot.ts service + mocks, ?capture=1 routing, CaptureOverlay
  - [x] Editor insert bridge (editorBridge store, Editor/EditorPane props)
  - [x] vaultStore.appendToNote / appendToDailyNote (ensureDailyNote refactor)
  - [x] Settings (captureHotkey) + SettingsPanel section + palette command + App listener
  - [x] Tests: 77 vitest / 12 cargo green; mock flow verified in real browser
  - [x] Docs: README, PROJECT_STATUS, TECHNICAL_CONTEXT, tasks/user.md
  - [ ] User test → push branch → PR → merge → close #47
- #48 Transcription notes — NEXT (2A frontend/mock pipeline first, then 2B Rust audio+whisper; plan file has full detail)
