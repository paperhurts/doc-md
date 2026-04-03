# Project Status

**Last updated**: 2026-04-02

## Current State
Phases 1-6 are largely complete. The app is a functional markdown knowledge management tool with editing, search, backlinks, tags, and graph view. Phases 7-9 are not started. Phase 10 is partial.

## Phase Completion

### Phase 1: Scaffolding & Core Shell — COMPLETE
- Tauri 2 + Svelte 5 + Python sidecar fully wired
- JSON-RPC over stdin/stdout working
- Ping/pong health check verified

### Phase 2: File Management & Vault — MOSTLY COMPLETE
- Open vault via native folder picker
- Persist last-opened vault path
- `list_files`, `read_file`, `write_file`, `delete_file`, `rename_file`, `create_directory` commands
- File tree view (FileExplorer + FileTreeNode)
- Create notes from sidebar
- **Remaining**: rename/delete UI in file tree, drag-and-drop, file icons, FS watcher not wired up (code exists in watcher.rs but never called)

### Phase 3: Markdown Editor — MOSTLY COMPLETE
- CodeMirror 6 with markdown syntax highlighting
- `[[wikilink]]` and `#tag` syntax highlighting in editor
- Auto-save on change (1s debounce)
- Live preview pane (markdown-it with wikilinks, tags, task lists, code blocks, tables)
- Tab system with dirty indicator
- **Remaining**: synchronized scroll editor↔preview, KaTeX math rendering (dep installed, not wired), vim mode

### Phase 4: Wiki Links & Backlinks — MOSTLY COMPLETE
- Python link extraction: `[[wiki-links]]`, `[[link|alias]]`
- In-memory link index (forward links + backlinks)
- Re-index on file save
- Click wikilink in preview → navigate to target note
- Backlinks panel with context paragraphs
- **Remaining**: Ctrl+Click in editor to navigate, `[[` autocomplete suggestions, standard `[text](path.md)` link parsing

### Phase 5: Search, Tags & Frontmatter — MOSTLY COMPLETE
- Whoosh full-text search with incremental updates
- Search modal (Ctrl+Shift+F) with ranked results and highlighted snippets
- `#tag` parsing from note body and YAML frontmatter
- Tags panel in sidebar with counts
- YAML frontmatter parsing in Python
- **Remaining**: tag click → filter notes, tag autocomplete in editor, frontmatter metadata display in UI

### Phase 6: Graph View — MOSTLY COMPLETE
- Python graph data computation (nodes + edges from link index)
- D3 force-directed graph in fullscreen overlay
- Zoom, pan, drag nodes
- Click node → open note
- Node size scaled by link count
- **Remaining**: highlight current note + connections, color coding by folder/tag, local vs global graph toggle, filter options

### Phase 7: Daily Notes & Templates — NOT STARTED
### Phase 8: Split Panes & Command Palette — NOT STARTED
### Phase 9: Plugin System — NOT STARTED

### Phase 10: Polish & Settings — PARTIAL
- Dark theme via CSS custom properties (Catppuccin-style)
- **Remaining**: light theme, theme toggle, settings panel, configurable keybindings, font/tab size options

## Recent Work (2026-04-02)
- Full code review: 11 issues identified and fixed
- PR #15: Security fixes (path traversal, XSS, CSP, sidecar race, error handling)
- PR #16: Enhancements (dead code cleanup, encapsulation, IPC type validation)

## Known Issues
- All 11 code review issues (#4-#14) resolved
- FS watcher exists but is not wired up (dead code in watcher.rs)
