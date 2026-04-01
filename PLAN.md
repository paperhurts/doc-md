# doc-md: Obsidian Replacement App — Implementation Plan

## Overview

A full-featured, local-first markdown knowledge management app built with **Tauri** (Rust desktop shell), a **Svelte** web frontend, and a **Python sidecar** backend. Notes are stored as plain markdown files on disk.

---

## Architecture

```
┌─────────────────────────────────────────────────┐
│                   Tauri Shell (Rust)             │
│  ┌───────────────────────┐ ┌──────────────────┐ │
│  │   Svelte Frontend     │ │  Rust Commands   │ │
│  │  ─────────────────    │ │  ──────────────  │ │
│  │  • Editor (CodeMirror)│ │  • File I/O      │ │
│  │  • File Explorer      │ │  • FS Watcher    │ │
│  │  • Graph View (D3)    │ │  • Window Mgmt   │ │
│  │  • Command Palette    │ │  • IPC Bridge    │ │
│  │  • Split Panes        │ │                  │ │
│  │  • Backlinks Panel    │ │                  │ │
│  └──────────┬────────────┘ └────────┬─────────┘ │
│             │      Tauri IPC        │           │
└─────────────┼───────────────────────┼───────────┘
              │                       │
              │    JSON-RPC (stdio)   │
              │                       │
┌─────────────┴───────────────────────┴───────────┐
│              Python Sidecar                      │
│  • Markdown parsing & link extraction            │
│  • Full-text search index                        │
│  • Graph data computation                        │
│  • YAML frontmatter parsing                      │
│  • Tag indexing                                   │
│  • Template engine                                │
│  • Plugin runtime                                 │
└──────────────────────────────────────────────────┘
```

### Communication Flow
- **Frontend ↔ Rust**: Tauri's built-in IPC (`invoke` / `emit`)
- **Rust ↔ Python**: Tauri sidecar spawned on startup, communicating via JSON-RPC over stdin/stdout
- **File watching**: Rust's `notify` crate watches the vault directory and pushes change events to both frontend and Python

---

## Tech Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| Desktop shell | Tauri 2.x (Rust) | Window management, native OS integration, file I/O |
| Frontend | Svelte 5 + TypeScript | UI framework |
| Editor | CodeMirror 6 | Markdown editing with syntax highlighting, vim mode support |
| Markdown preview | markdown-it | Rendering markdown to HTML with plugin support |
| Graph visualization | D3.js / force-graph | Interactive knowledge graph |
| Styling | Tailwind CSS | Utility-first CSS framework |
| Python runtime | Python 3.11+ (sidecar) | Backend processing |
| Search | Whoosh (Python) | Full-text search indexing |
| Markdown parsing | markdown-it-py + python-frontmatter | Link extraction, metadata parsing |
| Plugin system | Custom Python loader | Dynamic plugin loading |

---

## Directory Structure

```
doc-md/
├── src-tauri/                  # Rust/Tauri backend
│   ├── Cargo.toml
│   ├── tauri.conf.json
│   ├── src/
│   │   ├── main.rs             # Tauri app entry
│   │   ├── commands/           # Tauri command handlers
│   │   │   ├── mod.rs
│   │   │   ├── files.rs        # File read/write/list
│   │   │   ├── vault.rs        # Vault open/switch
│   │   │   └── sidecar.rs      # Python sidecar management
│   │   ├── watcher.rs          # FS watcher (notify crate)
│   │   └── sidecar.rs          # JSON-RPC bridge to Python
│   └── binaries/               # Bundled Python sidecar
│
├── src/                        # Svelte frontend
│   ├── app.html
│   ├── app.css
│   ├── lib/
│   │   ├── components/
│   │   │   ├── Editor.svelte           # CodeMirror wrapper
│   │   │   ├── MarkdownPreview.svelte  # Live preview pane
│   │   │   ├── FileExplorer.svelte     # Vault file tree
│   │   │   ├── GraphView.svelte        # D3 knowledge graph
│   │   │   ├── CommandPalette.svelte   # Cmd+K command palette
│   │   │   ├── BacklinksPanel.svelte   # Incoming links panel
│   │   │   ├── TagsPanel.svelte        # Tag browser
│   │   │   ├── SplitPane.svelte        # Resizable split container
│   │   │   ├── TabBar.svelte           # Open file tabs
│   │   │   ├── SearchModal.svelte      # Full-text search UI
│   │   │   └── DailyNote.svelte        # Daily note creation
│   │   ├── stores/
│   │   │   ├── vault.ts        # Vault state (open files, tree)
│   │   │   ├── editor.ts       # Editor state (active file, dirty)
│   │   │   ├── settings.ts     # User preferences
│   │   │   └── graph.ts        # Graph data store
│   │   ├── services/
│   │   │   ├── tauri.ts        # Tauri IPC wrappers
│   │   │   ├── markdown.ts     # Client-side markdown utils
│   │   │   └── keybindings.ts  # Keyboard shortcut manager
│   │   └── types/
│   │       └── index.ts        # TypeScript type definitions
│   ├── routes/
│   │   └── +page.svelte        # Main app layout
│   └── styles/
│       └── themes/             # Light/dark theme definitions
│
├── sidecar/                    # Python backend
│   ├── pyproject.toml
│   ├── src/
│   │   └── doc_md/
│   │       ├── __init__.py
│   │       ├── main.py         # JSON-RPC server entry point
│   │       ├── rpc.py          # JSON-RPC protocol handler
│   │       ├── indexer.py      # File indexer (links, tags, frontmatter)
│   │       ├── search.py       # Whoosh full-text search
│   │       ├── graph.py        # Graph data builder
│   │       ├── parser.py       # Markdown + frontmatter parser
│   │       ├── templates.py    # Template engine
│   │       ├── daily.py        # Daily notes logic
│   │       └── plugins/
│   │           ├── __init__.py
│   │           ├── loader.py   # Plugin discovery & loading
│   │           └── api.py      # Plugin API surface
│   └── tests/
│       ├── test_parser.py
│       ├── test_indexer.py
│       ├── test_search.py
│       └── test_graph.py
│
├── .gitignore
├── LICENSE
├── README.md
├── package.json                # Frontend dependencies
├── svelte.config.js
├── vite.config.ts
└── tailwind.config.js
```

---

## Implementation Phases

### Phase 1: Project Scaffolding & Core Shell
**Goal**: Get Tauri + Svelte + Python sidecar wired up and communicating.

1. **Initialize Tauri project** with Svelte frontend template
   - `npm create tauri-app@latest` with Svelte + TypeScript
   - Configure `tauri.conf.json` (window settings, title, permissions)

2. **Set up Python sidecar**
   - Create `sidecar/` with pyproject.toml, basic JSON-RPC server
   - Implement stdin/stdout JSON-RPC protocol in `rpc.py`
   - Add Tauri sidecar configuration to spawn Python on app start
   - Implement Rust-side JSON-RPC client in `src-tauri/src/sidecar.rs`

3. **Verify end-to-end IPC**
   - Frontend → Rust → Python → Rust → Frontend round-trip
   - Health check / ping-pong command

### Phase 2: File Management & Vault
**Goal**: Open a vault (directory), browse files, read/write markdown.

4. **Vault management**
   - "Open Vault" dialog (native folder picker via Tauri)
   - Persist last-opened vault path in app settings
   - Rust command: `list_files` — recursive directory listing
   - Rust command: `read_file` / `write_file`

5. **File Explorer component**
   - Tree view of vault directory
   - Create / rename / delete files and folders
   - Drag-and-drop reordering
   - File icons (markdown, image, etc.)

6. **File system watcher**
   - Rust `notify` crate watches vault directory
   - Emit events to frontend on file create/modify/delete
   - Sync external changes into the UI in real-time

### Phase 3: Markdown Editor
**Goal**: Rich markdown editing with live preview.

7. **CodeMirror 6 integration**
   - Svelte wrapper component for CodeMirror
   - Markdown syntax highlighting
   - Custom extensions: `[[wiki-link]]` syntax highlighting
   - Auto-save on change (debounced 1s)
   - Undo/redo history

8. **Live preview pane**
   - markdown-it rendering with custom plugins:
     - `[[wiki-links]]` → clickable internal links
     - `#tags` → clickable tag links
     - Checkbox task lists
     - Syntax-highlighted code blocks
     - LaTeX math (KaTeX)
   - Synchronized scroll between editor and preview

9. **Tab system**
   - Open multiple files in tabs
   - Dirty indicator (unsaved changes dot)
   - Tab context menu (close, close others, close all)

### Phase 4: Wiki Links & Backlinks
**Goal**: Bidirectional linking between notes, the core knowledge graph feature.

10. **Link extraction (Python)**
    - Parse `[[wiki-links]]` and `[[link|alias]]` from markdown
    - Parse standard `[text](relative-path.md)` links
    - Build in-memory link index (forward links + reverse/backlinks)
    - Re-index on file change events

11. **Link navigation (Frontend)**
    - Click `[[link]]` in preview → open target note
    - `Ctrl+Click` in editor → open target note
    - Auto-complete `[[` in editor → fuzzy file name suggestions

12. **Backlinks panel**
    - Show all notes that link TO the current note
    - Display surrounding context (the paragraph containing the link)
    - Click to navigate to the linking note

### Phase 5: Search, Tags & Frontmatter
**Goal**: Fast full-text search, tag system, and YAML metadata.

13. **Full-text search (Python + Whoosh)**
    - Index all markdown files on vault open
    - Incremental index updates on file changes
    - Search API: query → ranked results with snippets
    - Frontend search modal (`Ctrl+Shift+F`)

14. **YAML frontmatter parsing**
    - Extract frontmatter from all notes on indexing
    - Support standard fields: `title`, `tags`, `date`, `aliases`
    - Expose metadata via RPC for UI display

15. **Tag system**
    - Parse `#tags` from note body AND frontmatter `tags:` field
    - Tag index: tag → list of notes
    - Tags panel in sidebar: browse all tags, click to filter
    - Tag auto-complete in editor

### Phase 6: Graph View
**Goal**: Interactive visualization of the knowledge graph.

16. **Graph data computation (Python)**
    - Build node (notes) + edge (links) graph from link index
    - Compute graph metrics (degree, clusters)
    - Filter options: orphan notes, tags, folders
    - RPC endpoint: `get_graph_data` → `{nodes: [], edges: []}`

17. **Graph visualization (Frontend)**
    - D3.js force-directed graph in a dedicated pane
    - Nodes = notes, edges = links, node size = link count
    - Hover → show note title, click → open note
    - Zoom, pan, drag nodes
    - Highlight current note and its connections
    - Color coding by folder or tag
    - Local graph view (neighbors only) vs. global graph

### Phase 7: Daily Notes & Templates
**Goal**: Quick-capture daily notes and reusable templates.

18. **Daily notes**
    - Configurable daily note folder and filename format (e.g., `daily/2026-03-31.md`)
    - "Open today's note" command (create if doesn't exist)
    - Apply daily note template on creation
    - Keyboard shortcut: `Ctrl+D`

19. **Templates**
    - Templates folder in vault (e.g., `_templates/`)
    - Template variables: `{{date}}`, `{{title}}`, `{{time}}`
    - "New from template" command
    - Template picker in command palette

### Phase 8: Split Panes & Command Palette
**Goal**: Power-user workspace management.

20. **Split panes**
    - Horizontal and vertical splits
    - Each pane has its own tab bar and editor
    - Drag divider to resize
    - Keyboard shortcuts: `Ctrl+\` split, `Ctrl+W` close pane

21. **Command palette**
    - `Ctrl+K` or `Ctrl+P` to open
    - Fuzzy search across all commands
    - Recent files quick-open
    - Commands: open file, toggle panel, switch theme, create note, etc.
    - Keyboard-navigable results list

### Phase 9: Plugin System
**Goal**: Extensibility via Python plugins.

22. **Plugin architecture**
    - Plugin = Python package in vault's `.doc-md/plugins/` directory
    - Plugin API: hooks for note events (open, save, create, delete)
    - Plugin API: register custom RPC commands
    - Plugin API: register custom markdown-it rendering rules (via frontend bridge)
    - Plugin manifest: `plugin.json` with name, version, description

23. **Plugin manager UI**
    - Settings panel listing installed plugins
    - Enable / disable toggle per plugin
    - Plugin settings (each plugin can define config schema)

### Phase 10: Polish & Settings
**Goal**: Theming, preferences, and UX refinement.

24. **Theme system**
    - Light and dark themes (CSS custom properties)
    - Theme toggle in settings + command palette
    - Respect OS dark mode preference
    - Custom accent colors

25. **Settings panel**
    - Vault-specific settings stored in `.doc-md/config.json`
    - Global app settings via Tauri's app data directory
    - Settings: font family/size, tab size, auto-save interval, daily note format, template folder, keybindings, excluded folders

26. **Keyboard shortcuts**
    - Configurable keybinding system
    - Default keybindings matching common editor conventions
    - Keybinding reference panel

---

## Key Design Decisions

1. **Plain files on disk**: No database for note storage. The Python sidecar builds ephemeral in-memory indexes on vault open and keeps them updated via FS events. Indexes can be cached to `.doc-md/cache/` for faster startup.

2. **Python as sidecar, not embedded**: Python runs as a separate process spawned by Tauri. This keeps the Rust/frontend layer thin and lets us leverage Python's rich text-processing ecosystem. The sidecar is bundled with the app using PyInstaller or Nuitka for distribution.

3. **JSON-RPC over stdio**: Simple, well-defined protocol. Each request/response is a single JSON line. No network ports to manage.

4. **CodeMirror 6 for editing**: Best-in-class extensible editor. Supports custom syntax, vim mode, collaborative editing primitives, and excellent performance on large files.

5. **Svelte 5 for UI**: Lightweight, fast, compiles to minimal JS. Pairs well with Tauri's small footprint philosophy.

---

## Dependencies Summary

### Rust (Cargo.toml)
- `tauri` 2.x — desktop framework
- `notify` — file system watcher
- `serde` / `serde_json` — serialization
- `tokio` — async runtime

### Frontend (package.json)
- `@tauri-apps/api` — Tauri IPC
- `svelte` 5.x — UI framework
- `@codemirror/view`, `@codemirror/state`, `@codemirror/lang-markdown` — editor
- `markdown-it` — markdown rendering
- `d3` / `d3-force` — graph visualization
- `tailwindcss` — styling
- `katex` — math rendering

### Python (pyproject.toml)
- `python-frontmatter` — YAML frontmatter parsing
- `markdown-it-py` — markdown parsing for link/tag extraction
- `whoosh` — full-text search
- `networkx` — graph computation (optional, for advanced metrics)

---

## Estimated Effort by Phase

| Phase | Description | Complexity |
|-------|-------------|------------|
| 1 | Scaffolding & Core Shell | Foundation |
| 2 | File Management & Vault | Medium |
| 3 | Markdown Editor | High |
| 4 | Wiki Links & Backlinks | High |
| 5 | Search, Tags & Frontmatter | Medium |
| 6 | Graph View | High |
| 7 | Daily Notes & Templates | Low |
| 8 | Split Panes & Command Palette | Medium |
| 9 | Plugin System | High |
| 10 | Polish & Settings | Medium |
