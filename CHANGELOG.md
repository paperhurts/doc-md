# Changelog

## v0.3.0 — 2026-08-12

### Features
- **Screenshot capture** (#47) — press Ctrl+Shift+S anywhere (even with doc-md in the tray, OneNote-style): the screen freezes, drag a region, and the shot lands in `attachments/` with a link inserted at the cursor — or appended to today's daily note when no note is open. Hotkey rebindable in Settings with conflict detection.
- **Transcription notes** (#48) — a note with `transcription: true` frontmatter (or Ctrl+K → "Transcribe in this note") gets a recorder bar: listens to your mic (`[me]`) and/or system audio (`[audio]`) and appends timestamped transcript lines, transcribed **locally** by Whisper — audio never leaves your machine. In-app model download with progress; live partial line while speech is in flight.
- **Transcript follow mode** (#59) — the editor follows new transcript lines terminal-style: scroll up to read back and it stops tracking; **⤓ Scroll to end** in the bar catches back up.
- **UI zoom** (#56) — browser-style whole-app zoom: Ctrl+MouseWheel, Ctrl+= / Ctrl+- / Ctrl+0, or a Settings → Display slider (50–200%). Persisted; native WebView2 zoom so text stays crisp; sticky and capture windows deliberately stay at 100%.
- **New app icon** (#54) — "MD" monogram whose D-stem is a cyan down-arrow; vector master in `src-tauri/app-icon.svg`.
- **Per-sticky themes** — sticky notes keep the theme that was active when popped out; switch themes between pop-outs for a color-coded desktop (now documented as a feature; restart persistence tracked in #58).
- Live-preview upgrades (#49–#51 rounds): images render inline, empty `- [ ]` tasks get checkboxes, prose font with shaded code blocks and hidden fences, frontmatter as dimmed metadata, whole-note render when the editor is unfocused. Subfolder "New note" context-menu action.

### Fixes
- **View-mode switch silently lost unsaved edits** (#49) — the editor rebuilt itself from file-open-time content on every MD/Split/Preview switch; fixed with a regression test.
- External changes (watcher refreshes, transcript lines) now apply as a minimal span diff: cursor, scroll, and dirty state survive; the save/watcher echo loop is gone.
- Screenshot capture into a vault without an `attachments/` folder no longer fails path validation (also closed a Windows vault-escape hole); capture failures surface as in-app alerts; overlay shows only after the frozen frame is painted.
- FS watcher ignores `.git`/`node_modules`/`target`/dot-dirs — the repo-as-vault no longer floods the app with refreshes.
- Switching to a different transcription note mid-session now stops the session instead of silently recording into the newly opened note.

### Infrastructure
- Whisper toolchain in CI/release (CMake + libclang); `transcription` is a default-on cargo feature with mobile/feature-off stubs.
- Linux builds gained xcap/pipewire link deps (`libpipewire-0.3-dev`, `libgbm-dev`, `libegl1-mesa-dev`, `libwayland-dev`).
- Test suite: 132 Vitest + 29 cargo tests.

## v0.2.0 — 2026-07-18

### Features
- **Preview-edit view mode** (#36) — three view modes per note: MD source, Split, and Preview — an Obsidian-style live-preview editing surface (markdown syntax hidden, formatted text rendered inline, active line reveals its source). Cycle with Ctrl+Shift+E.
- **Clipboard image paste** (#39) — paste an image to save it as `attachments/pasted-<timestamp>.png` in the vault with a markdown link inserted at the cursor; images render in the preview via the Tauri asset protocol.
- **Kanban boards** (#40) — notes with `kanban: true` frontmatter open as a drag & drop board (`## headings` = columns, `- [ ]` items = cards). Lossless markdown round-trip keeps boards diffable and sync-friendly. "New kanban board" in the command palette.
- **System tray & close-to-tray** (#37) — closing the main window hides it to the tray (setting-gated, default on). Tray menu: Show doc-md, Toggle sticky notes, Quit.
- **Desktop sticky notes** (#38) — pop any note out as a small always-on-top sticky window (📌 Stick). Global show/hide toggle; sticky set and window positions persist across restarts.
- **In-app dialogs** (#41) — native prompt/alert/confirm replaced with themed in-app modals (no more "localhost says" browser chrome).

### Infrastructure
- Test suite (#35): Vitest (65 frontend tests) + cargo tests (7); `npm test`.
- Browser mock mode: the full app runs in a plain browser against an in-memory demo vault — used for automated screenshot verification.
- Security hardening: asset protocol scoped to the open vault at runtime; image src resolution rejects path traversal and unsafe URL schemes; binary writes are path-validated in Rust.
- CI now runs the frontend test suite.
- Release scaffolding (#42): installer bundling (MSI/NSIS, DMG, deb/rpm/AppImage), full icon set, tag-triggered release workflow drafting GitHub Releases — see RELEASING.md.

### Design
- All new data (boards, attachments, notes) is plain files in the vault — groundwork for team sharing via git sync (#21); see `docs/COLLABORATION.md`.

## v0.1.0 — 2026-04-03

Initial release: vault management, CodeMirror 6 markdown editor with wikilinks/tags/KaTeX, live preview, full-text search, backlinks, D3 graph view, tabs, daily notes, templates, command palette, 5 themes, settings panel, floating formatting toolbar, FS watcher.
