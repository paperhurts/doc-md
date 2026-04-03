# doc-md

A local-first markdown knowledge management app — an Obsidian alternative built with **Tauri 2** (Rust) and **Svelte 5**.

Notes are stored as **plain markdown files** on disk. No proprietary formats, no cloud lock-in. Targets **Windows, macOS, iOS, and Android** from a single codebase.

## Features

- **Markdown editor** — CodeMirror 6 with syntax highlighting, live preview, and split pane editing
- **Wiki links** — `[[note-name]]` linking with `[[` autocomplete, Ctrl+Click navigation, and backlinks panel
- **Full-text search** — MiniSearch-powered instant search with highlighted snippets (Ctrl+Shift+F)
- **Graph view** — D3 force-directed visualization with current-note highlighting and folder coloring (Ctrl+Shift+G)
- **Tag system** — `#tag` support with tag browser panel, click to filter notes by tag
- **Math rendering** — KaTeX support for `$inline$` and `$$block$$` LaTeX math
- **File explorer** — Tree view sidebar with create, rename, delete, and live external change detection
- **Tabbed editing** — Multiple open files with dirty indicators
- **Daily notes** — Ctrl+D opens today's note, auto-creates with template in `daily/` folder
- **Templates** — `_templates/` folder with variable substitution (`{{date}}`, `{{title}}`, `{{time}}`)
- **Command palette** — Ctrl+K for quick access to all commands, file search, and template picker
- **Auto-save** — 1-second debounced auto-save with Ctrl+S manual save
- **Frontmatter** — YAML frontmatter parsing for tags and metadata
- **Dark theme** — Catppuccin Mocha color scheme

## Architecture

```
Svelte 5 Frontend (TypeScript)
  • Editor, UI, search index, link index, parsing
        │ Tauri IPC
Tauri Shell (Rust)
  • File I/O, FS watching, window management, vault config
```

All indexing, search, and parsing runs in the frontend JS layer — no backend processes. This enables cross-platform support including mobile.

## Prerequisites

- **Node.js** 18+
- **Rust** (latest stable)
- **Tauri 2 CLI**: installed via npm (`@tauri-apps/cli`)

## Setup

```bash
# Clone
git clone https://github.com/paperhurts/doc-md.git
cd doc-md

# Install dependencies
npm install

# Run in development mode
cargo tauri dev

# Build for production
cargo tauri build
```

## Project Structure

```
doc-md/
├── src/                    # Svelte 5 frontend
│   ├── App.svelte
│   └── lib/
│       ├── components/     # UI components (editor, graph, search, etc.)
│       ├── editor/         # CodeMirror setup, theme, wikilink plugin, autocomplete
│       ├── services/       # Tauri IPC, parser, indexer, search
│       ├── stores/         # Svelte 5 rune-based state management
│       └── types/          # TypeScript interfaces
├── src-tauri/              # Tauri/Rust backend
│   └── src/
│       ├── lib.rs          # App entry, plugin registration
│       ├── watcher.rs      # File system watcher
│       └── commands/       # Tauri command handlers (file I/O, vault)
├── PLAN.md                 # 10-phase implementation plan
├── PROJECT_STATUS.md       # Current project state
└── docs/TECHNICAL_CONTEXT.md  # Architecture and dev setup details
```

## Keyboard Shortcuts

| Shortcut | Action |
|---|---|
| Ctrl+S | Save current file |
| Ctrl+Shift+F | Toggle search modal |
| Ctrl+Shift+G | Toggle graph view |
| Ctrl+K | Command palette |
| Ctrl+D | Open today's daily note |
| Ctrl+Click | Navigate to wikilink target in editor |

## License

MIT
