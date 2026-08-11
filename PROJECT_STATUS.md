# Project Status

**Last updated**: 2026-08-11
**Release**: v0.2.0 (user-tested and approved; see CHANGELOG.md)

## Current State
Phases 1-9 complete; Phase 10 (Plugin System) not started. v0.2.0 shipped the July 2026 wave (user-tested 2026-07-18):
- Preview-edit view mode (#36) — CM6 live preview, 3 view modes, Ctrl+Shift+E
- Clipboard image paste (#39) — attachments/ + asset-protocol rendering (security-hardened)
- Kanban boards (#40) — markdown-backed, drag & drop, share-ready (docs/COLLABORATION.md)
- System tray + close-to-tray (#37)
- Desktop sticky notes (#38) — always-on-top pop-out windows, persisted

Test infrastructure added (#35): Vitest (59 TS tests) + cargo tests (7), browser mock mode for the Tauri layer, screenshot verification into git-ignored .verify/ (all 6 shots evaluated PASS).

## Phase Completion

| Phase | Status | Remaining |
|-------|--------|-----------|
| 1. Scaffolding | **COMPLETE** | — |
| 2. File Management | **COMPLETE** | — |
| 3. Markdown Editor | **COMPLETE** | Synchronized scroll (stretch) |
| 4. Wiki Links | **COMPLETE** | — |
| 5. Search & Tags | **COMPLETE** | — |
| 6. Graph View | **COMPLETE** | Local vs global toggle (stretch) |
| 7. Daily Notes | **COMPLETE** | — |
| 8. Command Palette | **COMPLETE** | — |
| 9. Polish | **COMPLETE** | — |
| 10. Plugin System | **NOT STARTED** | — |

## What's been built
- **File management**: Open vault, file tree with icons, create/rename/delete notes, FS watcher for live external changes
- **Editor**: CodeMirror 6 with markdown highlighting, `[[wikilink]]` and `#tag` syntax, auto-save, KaTeX math (`$inline$` and `$$block$$`)
- **Preview**: Live markdown preview with wikilinks, tags, task lists, code blocks, tables, math
- **Wiki links**: `[[autocomplete` suggestions, Ctrl+Click navigation in editor, click in preview, backlinks panel with context
- **Search**: MiniSearch full-text search (Ctrl+Shift+F) with highlighted snippets
- **Tags**: Tag parsing from body + frontmatter, tags panel with counts, click to filter notes
- **Graph**: D3 force-directed graph, zoom/pan/drag, click to navigate, current note highlighting with connected nodes
- **Tabs**: Multi-file tabs with dirty indicator
- **Daily notes**: Ctrl+D opens today's note (daily/YYYY-MM-DD.md), auto-creates with template
- **Templates**: `_templates/` folder, template variables ({{date}}, {{title}}, {{time}}), new from template
- **Command palette**: Ctrl+K, fuzzy search commands/files/templates, keyboard navigation
- **Themes**: 5 selectable themes (Midnight, Dark TM, Editorial, Cyberpunk, Studio), persisted to localStorage
- **Settings**: Ctrl+, settings panel — font sizes, tab size, auto-save delay, folder config, keyboard reference
- **Formatting toolbar**: Floating toolbar on text selection — bold, italic, strike, code, heading, link, wikilink, bullet, checkbox, blockquote + keyboard shortcuts

## Architecture
- **Tauri 2** (Rust) — file I/O, FS watcher, window management
- **Svelte 5** (TypeScript) — UI, all indexing/search/parsing (MiniSearch)
- **No backend process** — all logic in frontend JS
- **Target platforms**: Windows, macOS, iOS, Android

## Recent Work (2026-04-03)
- Code review: 11 issues fixed (PRs #15, #16)
- Architecture refactor: eliminated Python sidecar (PR #18)
- Phase 2 completed: FS watcher (#19), rename/delete UI + file icons (#22)
- Phase 3-6 gaps filled: KaTeX, [[autocomplete, Ctrl+Click nav, tag filter, graph highlights (#24)
- Phase 7-8 complete: daily notes, templates, command palette (#26, #27)
- CI workflow added with GitHub Actions, main branch protected
- Fixed: duplicate backlinks crash, layout overflow on large files
- Phase 9 themes: 5-theme system (Midnight, Dark TM, Editorial, Cyberpunk, Studio)
- Graph view: theme-aware colors, active note highlighting fixed
- Header alignment: all panels on same 40px baseline
- User documentation added to README
- Settings panel: font sizes, tab size, auto-save delay, folder config, shortcuts ref
- Graph highlight: fixed Windows UNC path mismatch
- Floating formatting toolbar with 10 actions + keyboard shortcuts

## Recent Work (2026-07-17)
- #35 test infra: Vitest + jsdom, in-memory mock backend (app fully usable in a plain browser), .verify/ screenshot pipeline
- #36 preview-edit: livepreview.ts decorations (syntax hiding, clickable checkboxes, active-line reveal); MD/Split/Preview modes persisted in settings
- #39 image paste: write_binary_file Rust command, savePastedImage service, preview img resolution; hardened after security review (vault-scoped asset protocol, traversal + scheme guards)
- #40 kanban: kanban.ts lossless parser/serializer + KanbanBoard.svelte with HTML5 drag & drop; "New kanban board" palette command
- #37 tray: Rust tray icon (Show / Toggle sticky notes / Quit), closeToTray setting intercepts window close in frontend
- #38 stickies: sticky-* WebviewWindows running same bundle with ?sticky=<path>, stickies.svelte.ts store persisted in localStorage, geometry tracking
- Ctrl+E collision fixed: view-mode cycle moved to Ctrl+Shift+E (Ctrl+E = inline code)
- #41 (2026-07-18): native prompt/alert/confirm replaced with in-app dialog service (dialogs.svelte.ts + DialogHost) — user reported "localhost:5420 says" popup
- v0.2.0 pushed to main (CI green), issues #35–#41 closed
- #42 release scaffolding: bundle config + icons + tag-triggered release.yml (RELEASING.md documents the process); local Windows build verified; v0.2.0 published on GitHub with 7 artifacts

## Recent Work (2026-07-18, downloads/signing session)
- Recovered cleanly from a Windows/BIOS failure — no work lost
- #45 downloads page: site/index.html (accessible, client-side latest-release fetch, per-OS install walkthroughs, 4 screenshots) + pages.yml Pages deploy. User-tested and approved; merged to main; **live at https://paperhurts.github.io/doc-md/** (deploy run green, live URL verified). Future releases appear on the page automatically — no redeploy needed. #45 closed
- #43 signing scaffolding: release.yml signs Windows (Azure Artifact Signing) and macOS (Developer ID + notarization) automatically once credentials exist; docs/SIGNING.md walks through the one-time setup (Azure resources scoped to paperhurts org-wide, not per-project — one $9.99/mo account signs everything). User is holding off on the Azure setup for now — issue stays open, no new release planned until then

## Recent Work (2026-07-30, capture features session)
- Plan approved for OneNote-parity capture: #47 screenshots + #48 audio transcription (plan file: ~/.claude/plans/immutable-shimmying-dongarra.md)
- #47 screenshot capture built on `issue-47-screenshot-capture` (NOT yet merged — awaiting user test, see tasks/user.md):
  - Rust `screenshot.rs`: tauri-plugin-global-shortcut (Ctrl+Shift+S default, rebindable, conflict-safe) + xcap monitor grab + frozen-frame overlay window (`?capture=1`), crop returned as PNG base64
  - Frontend: CaptureOverlay.svelte (drag region, Esc cancels), routing = insert at cursor via new editorBridge, else append to auto-created daily note (window stays hidden)
  - New primitives for #48: `vaultStore.appendToNote/appendToDailyNote`, editor insert-at-cursor bridge
  - Settings → Screenshot section (hotkey rebind + conflict surfacing); palette "Capture screenshot"
  - Tests: 77 vitest (18 new) + 12 cargo (5 new) green; mock-mode flow browser-verified
- #48 Phase 2A built on `issue-48-transcription-notes` (stacked on issue-47 branch — merge #47 first):
  - transcription.ts: note type (`transcription: true`), transcript line formatting, engine command wrappers + full mock engine (canned script, fake downloads)
  - TranscriptionBar.svelte: Listen/Stop, mic+system toggles, live partial line, model download with progress; finals append via appendToNote
  - Palette "New transcription note"; Settings → Transcription (model picker w/ downloaded badges)
  - 87 vitest green (10 new); full flow browser-verified in mock mode
  - Phase 2B (2026-08-01): Rust engine built — src-tauri/src/transcription/ (audio.rs cpal WASAPI-loopback + mic w/ device-switch rebuild, chunker.rs energy-VAD windowing [pure, tested], whisper.rs-in-mod.rs shared WhisperContext + per-source sessions, download.rs .part-atomic model download, models.rs catalog); feature `transcription` default-ON, stubs for mobile/feature-off; CI/release get cmake+libclang steps; 21 cargo tests + 87 vitest green; --no-default-features build verified
  - Toolchain notes: whisper-rs needs CMake + libclang. This machine: CMake via winget; LLVM winget install failed on UAC → libclang via `pip install libclang` + user-level LIBCLANG_PATH env var (set). WHISPER_DONT_GENERATE_BINDINGS does NOT work on Windows (Linux-generated bindings)
  - NOT yet done: real-audio end-to-end test (needs user, see tasks/user.md), whisper accuracy/latency tuning, PRs

## Recent Work (2026-08-09 → 2026-08-11, capture test rounds)
Four rounds of user desktop testing of #47/#48, all fixes on `issue-48-transcription-notes` (stacked on `issue-47-screenshot-capture`). **User confirmed all tests pass 2026-08-11**; branches pushed, PRs opened (#47 base main, #48 stacked).
- Round 1: Vite mid-session dep re-optimization reloads (optimizeDeps.include), overlay shown before frame painted (show-after-paint + watchdog), subfolder "New note" context-menu action, watcher filtering of .git/node_modules/target + dot-dirs
- Round 2: editor whole-doc external sync destroyed cursor/scroll + dirty-echo save loop (minimalChange diff + syncingExternal guard, `diff.ts`); watchdog killed slow base64 frame transfer → frame now a temp PNG via asset protocol; capture failures now surface as in-app alerts
- Round 3: `canonicalize_or_parent` only tolerated one missing path level → first screenshot into a vault without `attachments/` failed; rewrite walks to nearest existing ancestor + rejects `..`/`.` in missing tails (closed a Windows vault-escape hole)
- Round 4 (#49 root-caused — it was NOT the stale installed build): Editor-creation $effect tracked `livePreview` → every view-mode switch rebuilt CM from file-open-time content = silent edit loss (untrack fix + component regression test). Live preview: images render (ImageWidget + resolveImage), empty `- [ ]` tasks get checkboxes, prose font, hidden fences + shaded code blocks, focus-aware reveal (unfocused = fully rendered), frontmatter as dimmed metadata. New palette command "Transcribe in this note" (enableTranscription adds frontmatter to any note). README view-mode/toolbar docs fixed
- Tests: 107 vitest + 29 cargo green. `/attachments/` + `/daily/` gitignored (repo doubles as user vault)

## Open Issues
- #21 — Cloud sync via Git/GitHub (future feature; data model prepared, see docs/COLLABORATION.md)
- #43 — Code signing + notarization for release builds (workflow wired; awaiting Azure/Apple credentials, see docs/SIGNING.md)
- #46 — Accessibility audit of the app (screen reader support)
- #47 — Screenshot capture (user-tested PASS; PR open, base main)
- #48 — Transcription notes (user-tested PASS; PR open, stacked on #47's branch)
- #49 — Preview/tab-switch report: root-caused and fixed in round 4 (rides the #47/#48 PRs; close on merge)
