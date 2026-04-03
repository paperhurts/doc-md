# Project Status

**Last updated**: 2026-04-02

## Current State
Phases 1-6 are largely complete. The app is a functional markdown knowledge management tool with editing, search, backlinks, tags, and graph view. Architecture refactored to eliminate Python sidecar — all logic runs in frontend JS for mobile compatibility.

## Recent Work (2026-04-02)
- Full code review: 11 issues identified and fixed (PRs #15, #16)
- **Architecture refactor** (PR #18): Eliminated Python sidecar entirely
  - Ported parser, indexer, search to TypeScript (`src/lib/services/`)
  - Replaced Whoosh with MiniSearch for full-text search
  - Removed shell plugin, sidecar bridge, JSON-RPC protocol
  - Net reduction: 1,240 lines deleted
  - App launches significantly faster

## Phase Completion

| Phase | Status | Key gaps |
|-------|--------|----------|
| 1. Scaffolding | **COMPLETE** | — |
| 2. File Management | **MOSTLY COMPLETE** | FS watcher not wired up, rename/delete UI, drag-and-drop |
| 3. Markdown Editor | **MOSTLY COMPLETE** | Synchronized scroll, KaTeX math, vim mode |
| 4. Wiki Links | **MOSTLY COMPLETE** | Ctrl+Click editor nav, `[[` autocomplete |
| 5. Search & Tags | **MOSTLY COMPLETE** | Tag click → filter, tag autocomplete |
| 6. Graph View | **MOSTLY COMPLETE** | Highlight current note, color coding, local/global toggle |
| 7. Daily Notes | **NOT STARTED** | — |
| 8. Command Palette | **NOT STARTED** | — |
| 9. Plugin System | **NOT STARTED** | — |
| 10. Polish | **PARTIAL** | Light theme, settings panel, configurable keybindings |

## Architecture
- **Tauri 2** (Rust) — file I/O, FS watcher, window management
- **Svelte 5** (TypeScript) — UI, all indexing/search/parsing
- **No backend process** — all logic in frontend JS
- **Target platforms**: Windows, macOS, iOS, Android

## Known Issues
- FS watcher exists in `watcher.rs` but is never called (dead code)
- All code review issues (#4-#14) resolved
- Sidecar eliminated (#17) resolved
