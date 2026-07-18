# Changelog

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
