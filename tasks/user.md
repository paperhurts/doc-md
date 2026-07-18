# Handoff: July 2026 Feature Wave (#35–#40)

**Where the code is**: merged to **local `main`** (nothing pushed, per Handoff Protocol).
Feature branches also still exist: `issue-35-test-infra`, `issue-36-preview-edit`,
`issue-39-image-paste`, `issue-40-kanban`, `issue-37-tray`, `issue-38-sticky-notes`.

**What was verified already**: 59 Vitest tests + 7 cargo tests green; six browser-mode
screenshots in `.verify/` (git-ignored) evaluated PASS by an independent review pass.
Tray + sticky windows need the real app (below) — they can't run in browser mock mode.

## What changed (one line each)

1. **Preview-edit mode (#36)** — MD / Split / Preview buttons above the editor; Preview is a live-preview editing surface (syntax hidden, active line reveals it). Ctrl+Shift+E cycles.
2. **Image paste (#39)** — pasting a clipboard image saves to `attachments/` and inserts `![](…)`; renders in preview.
3. **Kanban (#40)** — Ctrl+K → "New kanban board"; notes with `kanban: true` open as a drag & drop board.
4. **Close-to-tray (#37)** — closing the window hides to tray; tray menu Show / Toggle sticky notes / Quit.
5. **Sticky notes (#38)** — 📌 Stick button pops the note out as an always-on-top desktop sticky.

## How to test

```bash
# 0. Fresh build (Rust deps changed: tray-icon + protocol-asset features)
npm install
cargo tauri dev
```

### 1. View modes (2 min)
- Open any note. Toolbar above the editor now shows **MD | Split | Preview**.
- Click **Preview**: single full-width pane, `#`/`**`/`-` syntax hidden, headings big, checkboxes clickable.
- Click into a line → that line shows raw markdown; click elsewhere → formats again.
- Press **Ctrl+Shift+E** a few times → cycles the three modes. (Plain Ctrl+E is still inline-code.)

### 2. Image paste (1 min)
- Take any screenshot to clipboard (Win+Shift+S).
- In a note (any mode), Ctrl+V → expect `![](attachments/pasted-….png)` inserted, file appears in the tree, image renders in Split preview.

### 3. Kanban (3 min)
- Ctrl+K → "New kanban board" → name it. Board opens with To Do / Doing / Done.
- Add cards (+ Add card), drag one between columns, double-click to edit, toggle its checkbox.
- Click **MD** → confirm the markdown updated (cards as `- [ ]` lines). Click **Board** to return.
- Edit the markdown by hand (add `- [ ] manual card`), switch back to Board → card appears.

### 4. Tray (1 min)
- Close the main window (X) → app stays running, icon in system tray.
- Left-click tray icon → window returns. Tray right-click → Quit exits for real.
- Settings (Ctrl+,) → "Close to tray" Off → X now quits normally.

### 5. Sticky notes (2 min)
- Open a note → click **📌 Stick** (left side of the mode toolbar).
- Expect: small frameless always-on-top window with the note in live-preview mode.
- Drag it by its header; type in it → edits auto-save (main window picks them up via the file watcher).
- Tray → "Toggle sticky notes" → stickies hide; toggle again → back at same position.
- Restart the app → sticky reappears. **✕** on the sticky removes it permanently.

## If something's broken
- `npm test` and `cd src-tauri; cargo test --lib` should both be green — if not, that's a regression, tell Claude.
- Browser-mode sanity check: `npm run dev` → http://localhost:5420 runs the whole UI against a demo vault.

## After you confirm testing passed
Say the word and I'll push the branches / open PRs (nothing has been pushed).
GitHub issues #35–#40 stay open until then.
