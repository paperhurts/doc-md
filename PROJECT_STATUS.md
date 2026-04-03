# Project Status

**Last updated**: 2026-04-03

## Current State
Phases 1-6 are complete or nearly complete. Architecture refactored to eliminate Python sidecar. All logic runs in frontend JS for mobile compatibility.

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
| 9. Polish | **PARTIAL** | Light theme, settings panel, keybindings |
| 10. Plugin System | **NOT STARTED** | — |

## What's been built
- **File management**: Open vault, file tree with icons, create/rename/delete notes, FS watcher for live external changes
- **Editor**: CodeMirror 6 with markdown highlighting, `[[wikilink]]` and `#tag` syntax, auto-save, KaTeX math (`$inline$` and `$$block$$`)
- **Preview**: Live markdown preview with wikilinks, tags, task lists, code blocks, tables, math
- **Wiki links**: `[[autocomplete` suggestions, Ctrl+Click navigation in editor, click in preview, backlinks panel with context
- **Search**: MiniSearch full-text search (Ctrl+Shift+F) with highlighted snippets
- **Tags**: Tag parsing from body + frontmatter, tags panel with counts, click to filter notes
- **Graph**: D3 force-directed graph, zoom/pan/drag, click to navigate, folder-based coloring, current note highlighting
- **Tabs**: Multi-file tabs with dirty indicator
- **Daily notes**: Ctrl+D opens today's note (daily/YYYY-MM-DD.md), auto-creates with template
- **Templates**: `_templates/` folder, template variables ({{date}}, {{title}}, {{time}}), new from template
- **Command palette**: Ctrl+K, fuzzy search commands/files/templates, keyboard navigation

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

## Open Issues
- #21 — Cloud sync via Git/GitHub (future feature)
