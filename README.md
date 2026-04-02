# doc-md

A local-first markdown knowledge management app — an Obsidian alternative built with **Tauri 2** (Rust), **Svelte 5**, and a **Python sidecar**.

Notes are stored as **plain markdown files** on disk. No proprietary formats, no cloud sync, no lock-in.

## Features

- **Markdown editor** — CodeMirror 6 with syntax highlighting, live preview, and split pane editing
- **Wiki links** — `[[note-name]]` linking with backlinks panel and forward link resolution
- **Full-text search** — Whoosh-powered search with stemming and highlighted snippets (Ctrl+Shift+F)
- **Graph view** — D3 force-directed visualization of note connections (Ctrl+Shift+G)
- **Tag system** — `#tag` support with tag browser panel sorted by usage count
- **File explorer** — Tree view sidebar with vault switching via folder picker
- **Tabbed editing** — Multiple open files with dirty indicators and tab management
- **Auto-save** — 1-second debounced auto-save with Ctrl+S manual save
- **Frontmatter** — YAML frontmatter parsing and extraction
- **Dark theme** — Catppuccin Mocha color scheme throughout

## Architecture

```
Svelte 5 Frontend (TypeScript)
        │ Tauri IPC
Tauri Shell (Rust) — file I/O, FS watching, window management
        │ JSON-RPC over stdio
Python Sidecar — parsing, indexing, search, graph data
```

## Prerequisites

- **Node.js** 18+
- **Rust** (latest stable)
- **Python** 3.10+ with pip
- **Tauri 2 CLI**: `cargo install tauri-cli --version "^2"`
- **System libs** (Linux): `libgtk-3-dev libwebkit2gtk-4.1-dev libayatana-appindicator3-dev librsvg2-dev libsoup-3.0-dev libjavascriptcoregtk-4.1-dev`

## Setup

```bash
# Clone
git clone https://github.com/paperhurts/doc-md.git
cd doc-md

# Install frontend dependencies
npm install

# Install Python sidecar dependencies
cd sidecar
pip install -e ".[dev]"
cd ..

# Run in development mode
cargo tauri dev

# Build for production
cargo tauri build
```

## Running Tests

```bash
# Python sidecar tests (24 tests)
cd sidecar && python -m pytest tests/ -v

# Frontend build check
npm run build
```

## Project Structure

```
doc-md/
├── src/                    # Svelte 5 frontend
│   ├── App.svelte
│   └── lib/
│       ├── components/     # UI components
│       ├── editor/         # CodeMirror setup, theme, plugins
│       ├── services/       # Tauri IPC wrappers
│       ├── stores/         # Svelte 5 rune-based stores
│       └── types/          # TypeScript interfaces
├── src-tauri/              # Tauri/Rust backend
│   └── src/
│       ├── lib.rs          # App entry, plugin registration
│       ├── sidecar.rs      # JSON-RPC client over stdio
│       ├── watcher.rs      # File system watcher
│       └── commands/       # Tauri command handlers
├── sidecar/                # Python sidecar
│   └── src/doc_md/
│       ├── main.py         # RPC method registration
│       ├── rpc.py          # JSON-RPC 2.0 server
│       ├── parser.py       # Markdown/link/tag extraction
│       ├── indexer.py      # Link index & graph data
│       └── search.py       # Whoosh full-text search
└── PLAN.md                 # 10-phase implementation plan
```

## Keyboard Shortcuts

| Shortcut | Action |
|---|---|
| Ctrl+S | Save current file |
| Ctrl+Shift+F | Toggle search modal |
| Ctrl+Shift+G | Toggle graph view |

## License

MIT
