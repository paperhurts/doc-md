# Handoff: Test #47 — Screenshot capture (branch `issue-47-screenshot-capture`)

**Context if you've been AFK:** You asked for OneNote-style screenshots that land directly in doc-md. That's built and awaiting your test before I push. (The second ask — transcription notes — is planned as #48, not started.)

## What changed
Press **Ctrl+Shift+S** from anywhere (even with doc-md hidden in the tray): the screen freezes, you drag a rectangle, and the shot is saved into your vault's `attachments/` folder. The markdown link is inserted at your cursor if a note is open, otherwise appended to today's daily note. Hotkey is rebindable in Settings → Screenshot.

## How to test

1. **Start the app** (dev servers from earlier sessions should be closed first):
   ```
   cd C:\dev\doc-md
   git status            # confirm you're on issue-47-screenshot-capture
   cargo tauri dev
   ```
   Note: first Rust build pulls new crates (xcap, global-shortcut) — a couple extra minutes.

2. **Basic capture into a note:** Open any note, put the cursor somewhere, press **Ctrl+Shift+S**. Expect: app window vanishes, screen freezes with a "Drag to capture a region" hint, drag a box, release. Expect: window comes back, `![](attachments/screenshot-….png)` is at your cursor, and the image renders in Split/Preview view.

3. **Escape cancels:** Ctrl+Shift+S, then press Esc. Expect: overlay closes, window returns, nothing inserted, no file created.

4. **Tray capture → daily note:** Close the window (goes to tray). From any app, Ctrl+Shift+S and drag a region. Expect: **doc-md stays hidden.** Reopen from the tray — today's daily note (auto-created if needed) has the screenshot appended at the bottom.

5. **DPI check (important if your display scale isn't 100%):** capture a region with recognizable content (e.g. a specific window's title bar) and confirm the saved image is exactly what you selected — not shifted or scaled. My DPI math is tested in unit tests but real-monitor verification needs eyes.

6. **Hotkey rebind:** Settings (Ctrl+,) → Screenshot → change to e.g. `Alt+Shift+S`, Apply. Old combo should stop working, new one should work. Try a combo another app owns (or something invalid like `Ctrl`) — expect an inline error, old binding still active.

7. **Palette:** Ctrl+K → "Capture screenshot" should trigger the same flow.

## Known limitations (deliberate v1 scope)
- Single monitor: captures the monitor under the mouse cursor.
- No annotation tools, no clipboard copy — the shot goes straight to the vault.
- Win+Shift+S can't be the hotkey (Windows reserves it).

## When you're happy
Say the word and I'll push the branch + open the PR. If anything misbehaves, tell me what step and what you saw.

---

Still on hold by user choice: #43 code signing — workflow wiring merged and dormant; `docs/SIGNING.md` has the one-time Azure setup (paperhurts-scoped). The Azure identity-verification step is the long pole — start it first.
