# doc-md: Obsidian Replacement App — Implementation Plan

## Overview

A full-featured, local-first markdown knowledge management app built with **Tauri 2** (Rust desktop shell) and a **Svelte 5** web frontend. Notes are stored as plain markdown files on disk. All indexing, search, and parsing runs in the frontend TypeScript layer.

**Target platforms**: Windows, macOS, iOS, Android (via Tauri 2).

---

## Architecture

```
┌──────────────────────────────────────────┐
│            Tauri Shell (Rust)             │
│  ┌─────────────────┐  ┌───────────────┐  │
│  │ Svelte Frontend  │  │ Rust Commands │  │
│  │ ───────────────  │  │ ──────────── │  │
│  │ • Editor (CM6)   │  │ • File I/O    │  │
│  │ • File Explorer  │  │ • FS Watcher  │  │
│  │ • Graph View     │  │ • Window Mgmt │  │
│  │ • Search Index   │  │ • Vault Mgmt  │  │
│  │ • Link Index     │  │               │  │
│  │ • Tag Index      │  │               │  │
│  │ • Command Palette│  │               │  │
│  │ • Backlinks      │  │               │  │
│  └─────────────────┘  └───────────────┘  │
│          Tauri IPC (invoke/emit)          │
└──────────────────────────────────────────┘
```

### Communication Flow
- **Frontend ↔ Rust**: Tauri's built-in IPC (`invoke` / `emit`)
- **File watching**: Rust's `notify` crate watches the vault directory and pushes change events to the frontend
- **All indexing/search/parsing**: Runs in the frontend JS layer (no backend processing)

### Key Design Decisions

1. **No Python sidecar**: All logic runs in the frontend TypeScript layer. This enables iOS/Android support since mobile platforms cannot spawn child processes.
2. **Plain files on disk**: No database for note storage. The frontend builds in-memory indexes on vault open and keeps them updated via file change events.
3. **MiniSearch for full-text search**: Lightweight (~7KB) client-side search library replacing Whoosh.
4. **CodeMirror 6 for editing**: Best-in-class extensible editor.
5. **Svelte 5 for UI**: Lightweight, fast, compiles to minimal JS.
6. **Tauri 2 for cross-platform**: Single codebase for desktop and mobile.

---

## Tech Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| Desktop/Mobile shell | Tauri 2.x (Rust) | Window management, native OS integration, file I/O |
| Frontend | Svelte 5 + TypeScript | UI framework |
| Editor | CodeMirror 6 | Markdown editing with syntax highlighting |
| Markdown preview | markdown-it | Rendering markdown to HTML with plugin support |
| Full-text search | MiniSearch | Client-side search indexing |
| Graph visualization | D3.js | Interactive knowledge graph |
| Styling | Tailwind CSS 4 | Utility-first CSS framework |
| Math rendering | KaTeX | LaTeX math in notes |

---

## Directory Structure

```
doc-md/
├── src-tauri/                  # Rust/Tauri backend
│   ├── Cargo.toml
│   ├── tauri.conf.json
│   ├── src/
│   │   ├── main.rs             # Tauri app entry
│   │   ├── lib.rs              # Plugin setup, command registration
│   │   ├── commands/           # Tauri command handlers
│   │   │   ├── mod.rs
│   │   │   ├── files.rs        # File read/write/list/delete (vault-scoped)
│   │   │   └── vault.rs        # Vault open/switch/persist
│   │   └── watcher.rs          # FS watcher (notify crate)
│   └── capabilities/
│       └── default.json        # Tauri permissions
│
├── src/                        # Svelte frontend
│   ├── App.svelte              # Root layout
│   ├── main.ts                 # Entry point
│   ├── app.css                 # Global styles + theme variables
│   ├── lib/
│   │   ├── components/
│   │   │   ├── Editor.svelte           # CodeMirror wrapper
│   │   │   ├── EditorPane.svelte       # Editor + preview split
│   │   │   ├── MarkdownPreview.svelte  # Live preview pane
│   │   │   ├── FileExplorer.svelte     # Vault sidebar + tree
│   │   │   ├── FileTreeNode.svelte     # Recursive tree node
│   │   │   ├── GraphView.svelte        # D3 knowledge graph
│   │   │   ├── BacklinksPanel.svelte   # Incoming links panel
│   │   │   ├── TagsPanel.svelte        # Tag browser
│   │   │   ├── TabBar.svelte           # Open file tabs
│   │   │   └── SearchModal.svelte      # Full-text search UI
│   │   ├── services/
│   │   │   ├── tauri.ts        # Tauri IPC wrappers (file I/O only)
│   │   │   ├── parser.ts       # Markdown link/tag/frontmatter extraction
│   │   │   ├── indexer.ts      # LinkIndex (backlinks, tags, graph)
│   │   │   └── search.ts       # MiniSearch full-text search
│   │   ├── stores/
│   │   │   └── vault.svelte.ts # Vault state (open files, tree, index)
│   │   ├── editor/
│   │   │   ├── setup.ts        # CodeMirror extensions
│   │   │   ├── markdown.ts     # markdown-it plugins (wikilinks, tasks)
│   │   │   ├── wikilink.ts     # CodeMirror wikilink/tag highlighting
│   │   │   └── theme.ts        # CodeMirror theme
│   │   └── types/
│   │       └── index.ts        # TypeScript type definitions
│   └── styles/
│       └── themes/             # Light/dark theme definitions
│
├── package.json                # Frontend dependencies
├── svelte.config.js
├── vite.config.ts
├── PLAN.md                     # This file
├── PROJECT_STATUS.md           # Current state tracker
├── CLAUDE.md                   # AI assistant behavioral rules
└── tasks/                      # Session tracking
    ├── todo.md                 # Current session scratchpad
    ├── lessons.md              # Persistent learnings
    └── user.md                 # Handoff testing instructions
```

---

## Implementation Phases

### Phase 1: Project Scaffolding & Core Shell — COMPLETE
1. Initialize Tauri 2 project with Svelte 5 + TypeScript
2. Set up IPC between frontend and Rust
3. Verify end-to-end communication

### Phase 2: File Management & Vault — COMPLETE
4. Vault management (open, switch, persist last vault) ✅
5. File explorer (tree view, create/rename/delete, file icons) ✅
6. File system watcher (live external change detection) ✅

### Phase 3: Markdown Editor — COMPLETE
7. CodeMirror 6 integration (markdown highlighting, wikilink syntax, auto-save) ✅
8. Live preview (wikilinks, tags, task lists, code blocks, tables, KaTeX math) ✅
9. Tab system (multi-file, dirty indicator) ✅

### Phase 4: Wiki Links & Backlinks — COMPLETE
10. Link extraction (wikilinks, aliases) ✅
11. Link navigation (click in preview, Ctrl+Click in editor, `[[` autocomplete) ✅
12. Backlinks panel (context paragraphs, click to navigate) ✅

### Phase 5: Search, Tags & Frontmatter — COMPLETE
13. Full-text search (MiniSearch, Ctrl+Shift+F, snippets) ✅
14. YAML frontmatter parsing ✅
15. Tag system (body + frontmatter parsing, tags panel, click to filter) ✅

### Phase 6: Graph View — COMPLETE
16. Graph data computation ✅
17. D3 force-directed graph (zoom, pan, drag, click to open, current note highlight, folder coloring) ✅

### Phase 7: Daily Notes & Templates — COMPLETE
18. Daily notes (Ctrl+D, daily/ folder, YYYY-MM-DD.md, template on create) ✅
19. Templates (_templates/ folder, {{date}}/{{title}}/{{time}} variables, new from template) ✅

### Phase 8: Command Palette — COMPLETE
20. Command palette (Ctrl+K, fuzzy search commands/files/templates, keyboard navigation) ✅
    - **Remaining**: split panes (deprioritized)

### Phase 9: Polish & Settings — PARTIAL
21. Theme system (dark theme exists) — **Remaining**: light theme, toggle, OS preference
22. Settings panel — **NOT STARTED**
23. Keyboard shortcuts — **Remaining**: configurable keybindings

### Phase 10: Plugin System — NOT STARTED
24. Plugin architecture (JS plugins in `.doc-md/plugins/`)
25. Plugin manager UI

---

## Dependencies

### Rust (Cargo.toml)
- `tauri` 2.x — desktop/mobile framework
- `tauri-plugin-dialog` — native file picker
- `notify` 7 — file system watcher
- `serde` / `serde_json` — serialization
- `tokio` — async runtime

### Frontend (package.json)
- `@tauri-apps/api` — Tauri IPC
- `@tauri-apps/plugin-dialog` — dialog API
- `svelte` 5.x — UI framework
- `@codemirror/*` — editor (view, state, lang-markdown, commands, search, autocomplete)
- `markdown-it` — markdown rendering
- `minisearch` — full-text search (~7KB)
- `d3` — graph visualization
- `tailwindcss` 4 — styling
- `katex` — math rendering
