# Handoff: Test #47 screenshots + #48 transcription notes

## ROUND 4 (2026-08-10) — read this first

Your report: "preview view broken — split works but preview doesn't; images only display in split." Your screenshots nailed it. Also: your Ctrl+Shift+S screenshot from this morning **worked** — it's sitting in `attachments/` with its link inserted in this file, so the round-3 fix held.

**No restart needed this time** — everything below is frontend-only, and the dev server hot-reloads it. If the app is already running, it's already fixed.

What Preview mode is, first: it's an *editable* live preview (like Obsidian) — click a line and its markdown source appears so you can edit it; move away and it renders. It is not the read-only rendered pane from Split. That said, four real bugs made it look completely broken:

1. **Images never rendered in Preview** — the live-preview renderer simply had no code for images. Now `![](…)` shows the actual picture (click the line to get the source back for editing).
2. **The daily-note template's empty task showed as raw `[ ]`** with no bullet and no checkbox. Now it's a clickable checkbox.
3. **It looked like source code** — monospace font, raw ``` fences everywhere. Preview now uses the same prose font as Split's rendered pane, and code blocks get a shaded background with the ``` fence lines hidden (click into the block to see them).
4. **THE BIG ONE — switching MD/Split/Preview silently threw away unsaved edits.** The editor rebuilt itself from the content the file had when you *first opened it*, and your next keystroke wrote that stale text back over the file. If you ever felt like text you typed just vanished — this was it, and it's probably a chunk of what made rounds 0–2 feel haunted. Fixed, with a regression test that fails on the old code.

Retest: open a note with a screenshot in it → Preview → image should display. Click the image's line → source appears. Type somewhere, flip MD → Preview → MD → your text must survive. And the still-open round-3 items: tray-flow capture (step 4) and screenshots in your OTHER vaults (.sid_archive, other repo).

**Afternoon follow-ups (your 3 items):**
- **"# still shows on the top heading"** — that was the active-line reveal: the cursor lands on line 1 when a note opens, and the cursor's line always shows its raw source so you can edit it (that's the one intended difference from Split). But it shouldn't apply when you're not even editing — now the whole note renders whenever the editor is unfocused, and the `#` only appears when you click onto that line. If you see raw syntax anywhere else while the cursor is elsewhere, that's a bug — tell me.
- **Formatting toolbar** — correct, the test script never mentioned it: select any text in any mode and a floating toolbar appears (Bold/Italic/Strike/Code/Heading/Link/Wikilink/Bullet/Checkbox/Quote). README now says so too.
- **Transcription in any note** — it was frontmatter-only; now there's Ctrl+K → **"Transcribe in this note"**, which adds `transcription: true` to whatever note you're in and the recorder bar appears. Delete those frontmatter lines to get rid of the bar. Try it on a random note.
- Bonus fix found while testing the above: frontmatter blocks used to render in Preview as a giant bold heading (markdown parses `---\nkey: value\n---` as a heading + rules). They now show as small dimmed metadata lines.

---

## ROUND 3 (2026-08-09 midday)

> **Evening update:** your "Cannot resolve parent directory" alert is fixed — the first screenshot into a vault with no `attachments/` folder yet was failing path validation. **Restart `cargo tauri dev` once more** (Rust changed), then screenshots should finally land in ANY vault. This was also the silent killer in `.sid_archive` and your other repo earlier.

Round-2 feedback diagnosed and fixed in `e730f6c`. **Quit the app and restart `cargo tauri dev`** (Rust changed again).

1. **"Booted out of docs every few seconds"** — this was NOT the dev server this time. The editor replaced its *entire document* whenever content changed from outside (a watcher refresh, a transcript line, even a tab switch), throwing your cursor away — and each replacement re-marked the file dirty, so the app kept re-saving and re-triggering its own watcher in a loop. Now it applies only the changed span: cursor and scroll stay where you put them. This same fix is why **transcripts no longer scroll to the top** — I verified live appends leave the cursor untouched while lines stream in below.
2. **Screenshots doing nothing anywhere** — the frozen screen image was so slow to transfer on a big monitor that my 15-second safety timer killed the overlay before it appeared. It now loads near-instantly from a temp file. Also, **any capture failure now pops an in-app alert** — so if round 3 misbehaves, you'll get an actual error message: tell me its exact text.
3. If Ctrl+Shift+S *still* does nothing: try Ctrl+K → "Capture screenshot". If the palette works but the hotkey doesn't, another app owns Ctrl+Shift+S — check Settings → Screenshot for a red error line and tell me what it says.
4. **`[me]` vs `[audio]` confusion with background noise** — known limitation (your speakers bleed into your mic); logged on #48, no fix planned this round.

Retest: screenshots (steps 2–6), tray flow (step 4), and a quick "does editing feel normal now" pass in the doc-md repo vault.

---

**Context if you've been AFK:** Both features from your goal are built and awaiting your test before anything is pushed. Screenshot capture is on branch `issue-47-screenshot-capture`; transcription notes are stacked on top of it on `issue-48-transcription-notes` (currently checked out — testing this branch tests both).

**Machine changes I made (for the Whisper build, all reversible):**
- Installed **CMake** via winget (whisper.cpp builds with it).
- Tried to install **LLVM** via winget — the UAC elevation prompt got canceled, so instead I did `pip install --user libclang` and set a **user-level `LIBCLANG_PATH` env var** pointing at it (bindgen needs libclang). If you'd rather have real LLVM: `winget install LLVM.LLVM` (approve the UAC prompt), then you can `pip uninstall libclang` and delete the env var.
- **Open new terminals** for these env changes to be visible — a terminal opened before today won't have them.

## How to test

1. **Start** (from a NEW terminal). ⚠️ **Do NOT use the desktop shortcut or Start-menu entry** — that launches the installed v0.2.0 from July, which has none of this work. The only way to test these features is `cargo tauri dev`:
   ```
   cd C:\dev\doc-md
   git status                # should say issue-48-transcription-notes
   cargo tauri dev
   ```
   First build compiles whisper.cpp — expect several extra minutes.

### Screenshots (#47)
2. Open a note, place the cursor, press **Ctrl+Shift+S** → screen freezes → drag a region → window returns with `![](attachments/screenshot-….png)` at the cursor, image renders in Split/Preview. ![](attachments/screenshot-20260810-110734-732.png)
3. **Esc cancels** (overlay closes, nothing saved).
4. **Tray flow:** close the window (tray), Ctrl+Shift+S from another app, drag → doc-md stays hidden; the shot lands at the bottom of today's daily note. --> as far as i can tell this doesn't work, but 
5. **DPI:** if your display scale isn't 100%, verify the crop matches exactly what you selected.
6. **Rebind:** Settings → Screenshot → e.g. `Alt+Shift+S` → Apply. Conflicting/invalid combos show an inline error and keep the old binding.

### Transcription (#48)
7. Ctrl+K → **"New transcription note"** → name it. A recorder bar appears above the editor.
8. First use: click **⬇ Download base.en (142 MB)** — progress %, then a **● Listen** button.
9. Play a YouTube video, click Listen. Within ~5–15 s, `- **[HH:MM:SS] [audio]** …` lines should append under `## Transcript` (finals arrive at natural pauses in speech; the italic line in the bar is the live partial).
10. Say something out loud → a `[me]` line (Windows Settings → Privacy → Microphone must allow desktop apps).
11. Uncheck one source, Listen again — only the other source's lines appear.
12. Mid-session, switch audio output (speakers→headphones) — capture should recover within a few seconds.
13. **Stop**, edit the transcript text like any markdown — it's a plain note.

Expectations to calibrate: base.en is decent-not-perfect on accented/noisy audio (try small.en for better accuracy); lines lag real time by roughly 5–15 s because finals flush at pauses; background music can produce odd fragments (non-speech markers are filtered but not perfectly).

## When you're happy
Say the word and I'll push both branches and open PRs (#47 first, #48 stacked). If something misbehaves, tell me the step number and what you saw.

---

Still on hold by user choice: #43 code signing — workflow wiring merged and dormant; `docs/SIGNING.md` has the one-time Azure setup (paperhurts-scoped). The Azure identity-verification step is the long pole — start it first.
