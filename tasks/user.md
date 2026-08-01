# Handoff: Test #47 screenshots + #48 transcription notes

**Context if you've been AFK:** Both features from your goal are built and awaiting your test before anything is pushed. Screenshot capture is on branch `issue-47-screenshot-capture`; transcription notes are stacked on top of it on `issue-48-transcription-notes` (currently checked out — testing this branch tests both).

**Machine changes I made (for the Whisper build, all reversible):**
- Installed **CMake** via winget (whisper.cpp builds with it).
- Tried to install **LLVM** via winget — the UAC elevation prompt got canceled, so instead I did `pip install --user libclang` and set a **user-level `LIBCLANG_PATH` env var** pointing at it (bindgen needs libclang). If you'd rather have real LLVM: `winget install LLVM.LLVM` (approve the UAC prompt), then you can `pip uninstall libclang` and delete the env var.
- **Open new terminals** for these env changes to be visible — a terminal opened before today won't have them.

## How to test

1. **Start** (from a NEW terminal):
   ```
   cd C:\dev\doc-md
   git status                # should say issue-48-transcription-notes
   cargo tauri dev
   ```
   First build compiles whisper.cpp — expect several extra minutes.

### Screenshots (#47)
2. Open a note, place the cursor, press **Ctrl+Shift+S** → screen freezes → drag a region → window returns with `![](attachments/screenshot-….png)` at the cursor, image renders in Split/Preview.
3. **Esc cancels** (overlay closes, nothing saved).
4. **Tray flow:** close the window (tray), Ctrl+Shift+S from another app, drag → doc-md stays hidden; the shot lands at the bottom of today's daily note.
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
