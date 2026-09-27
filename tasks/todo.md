# Session scratchpad

## 2026-09-27: Mobile planning (iOS first, replace Google Keep). SESSION CLOSED

Done (planning only, no app code):
- [x] Decisions captured (iPhone first, Tauri iOS, TestFlight via CI, Mac dev loop, GitHub-API sync to `paperhurts/dm-notes`, Keep import, all notes on the home grid, no Keep colors)
- [x] Tauri iOS facts verified against the v2 docs (signing env vars, per-platform config, Info.ios.plist, entitlements)
- [x] docs/MOBILE.md design spec; PLAN.md Phase 13 + dependency graph
- [x] Issues: epic #71; #72 #73 #21 #74 #75 #76 (MVP); #77 #78 #79 (post-MVP)
- [x] PR #81 (plan) merged; PR #82 (#80 ports: HMR 5422, preview 4420) merged, #80 closed
- [x] Plan page for Sid: https://claude.ai/artifact/QsWLmuyhSXRCFqfdKdcr5B (private; mirrors docs/MOBILE.md)

Waiting on Sid:
- M1 Apple setup (#72): App Store Connect app record for com.paperhurts.docmd, Admin API key, GitHub secrets APPLE_API_ISSUER / APPLE_API_KEY_ID / APPLE_API_KEY_P8 / APPLE_DEVELOPMENT_TEAM
- Mac toolchain (#72): Xcode, `brew install cocoapods gh`, `gh auth login`, rustup iOS targets, Node, iPhone Developer Mode + Web Inspector, Safari developer features
- Create private repo `paperhurts/dm-notes`

Next session: a LOCAL Claude Code session on the Mac (Claude Desktop app or `claude remote-control` in the clone):
- Start M1 (#72) on `issue-72-ios-foundation`: gating + tauri.ios.conf.json + Info.ios.plist + ios.yml. Then Sid runs `npm run tauri ios init`, commits gen/apple, and runs `tauri ios dev` on the iPhone
- Check 5420/5422 are free on the Mac first (`lsof -i :5420 -i :5422`)
- M2 (#73) can proceed in mock mode in parallel
