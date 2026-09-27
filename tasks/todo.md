# Session scratchpad

## 2026-09-27: Mobile planning (iOS first, replace Google Keep)

Done this session (planning only, no code):
- [x] Decisions captured (iPhone first, Tauri iOS, TestFlight via CI, GitHub-API sync, Keep import)
- [x] Tauri iOS facts verified against the v2 docs (signing env vars, per-platform config, Info.ios.plist, entitlements)
- [x] docs/MOBILE.md design spec
- [x] Issues: epic #71; #72 #73 #21 #74 #75 #76 (MVP); #77 #78 #79 (post-MVP)
- [x] PLAN.md Phase 13 + dependency graph; PROJECT_STATUS.md updated

Waiting on Sid:
- Review the plan (docs PR)
- Open questions:
  - home grid shows every note, or only inbox/ + keep/? (#73)
  - notes repo name (default `paperhurts/notes`, private)
  - is any Mac available, even an old one? (faster iOS dev loop)
- M1 Apple setup (#72 checklist): App Store Connect app record for com.paperhurts.docmd, Admin API key, GitHub secrets APPLE_API_ISSUER / APPLE_API_KEY_ID / APPLE_API_KEY_P8 / APPLE_DEVELOPMENT_TEAM

Next session:
- Start M1 (#72) Rust/frontend gating + CI workflows
- Start M2 (#73) in mock mode at the same time
