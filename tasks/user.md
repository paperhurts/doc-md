# Handoff: Test #54 new app icon + #56 UI zoom

**Context if you've been AFK:** Two things landed today, both unpushed, stacked on one branch so a single dev run tests both:
- **#54 app icon** — your Illustrator-refined MD-with-down-arrow SVG (`src-tauri/app-icon.svg`); all platform icons regenerated from it. I zoom-inspected the render: the corner speck you circled is gone, edges are clean.
- **#56 UI zoom** — browser-style whole-app zoom because theme fonts (Cyberpunk etc.) run small on your monitor. Ctrl+MouseWheel, Ctrl+= / Ctrl+- / Ctrl+0, a Settings → Display slider, and a brief % badge bottom-right. Persists across restarts. Uses native WebView2 zoom, so text stays crisp; sticky notes and the screenshot overlay deliberately stay at 100% (zooming the overlay would corrupt crop math).

Already verified by me: 122 vitest green (15 new), production build compiles, and the full zoom flow (keys, wheel, badge, persistence, AltGr guard) works in browser mock mode. What mock mode can't prove — native zoom in the real webview, CM6 cursor accuracy while zoomed, capture isolation — is yours below.

## ⚠️ RESTART REQUIRED FIRST
Your dev server from ~11:12 AM is still running. I switched branches (main → issue-54 → issue-56) and edited files underneath it, so its module graph is stale (the "works on fresh server, silently broken on old one" failure mode from July). Also, the new icon and a Tauri capability change only load at build time. **Quit the app AND stop `cargo tauri dev`, then:**

```
cd C:\dev\doc-md
git status        # should say issue-56-ui-zoom
cargo tauri dev
```

## How to test

### Icon (#54)
1. Check the MD-arrow icon in: title bar/taskbar, system tray (smallest render — should still read "MD"), and Alt+Tab.
2. The installed v0.2.0 desktop shortcut keeping the OLD icon is expected until v0.3.0 ships.

### UI zoom (#56)
3. **Ctrl+=** three times → UI grows 110/120/130%, badge shows the % bottom-right and fades ~1.2 s after you stop. **Ctrl+-** steps back. **Ctrl+0** → 100%. Holding Ctrl+= keeps zooming and stops at 200%.
4. **Ctrl+MouseWheel** over the editor, file tree, and preview → zooms; the page must NOT scroll while Ctrl is held. Text should stay crisp, not blurry-scaled.
5. At 150%: click around in the editor — the caret must land exactly where you click; `[[` autocomplete popups must align; Ctrl+K palette and Settings modal must still cover the window.
6. Graph view (Ctrl+Shift+G): Ctrl+wheel over the graph zooms the **graph** (as before); close it and Ctrl+wheel zooms the UI again.
7. Ctrl+, → **Display → UI zoom** slider live-applies; the Shortcuts list shows the new Ctrl+= / Ctrl+- / Ctrl+0 rows.
8. Set 150%, quit fully (tray → Quit), relaunch → still 150%, no badge flash on startup.
9. **The important isolation check:** at 150%, (a) open a sticky note — it should render at normal 100% size; (b) Ctrl+Shift+S a region — the saved screenshot must crop EXACTLY the rectangle you dragged.
10. Switch a few themes at 150% — zoom should persist. (Cyberpunk at 130–150% was the whole point — see if it reads comfortably now.)

## When you're happy
Say the word and I'll push and open the PRs (#54 first, then #56 rebased on it), then start #55 (v0.3.0 release). If anything misbehaves, give me the step number and what you saw.

---

Still on hold by user choice: #43 code signing — workflow wiring merged and dormant; `docs/SIGNING.md` has the one-time Azure setup (paperhurts-scoped). The Azure identity-verification step is the long pole — start it first.
