# Technical Context

## Environment Setup

### Prerequisites
- **Node.js** 18+ (for frontend build)
- **Rust** (stable toolchain, for Tauri backend)
- **Tauri CLI**: `npm run tauri` (via `@tauri-apps/cli` devDependency)

### Development
```bash
cargo tauri dev          # Full app with hot reload
npm run dev              # Frontend only (no Tauri shell)
npm run build            # Frontend production build
cargo build              # Rust backend only (from src-tauri/)
```

### Port
Vite dev server runs on port **5420** (configured in `vite.config.ts`). If you get "port in use" errors, kill stale node processes:
```bash
# PowerShell
Get-NetTCPConnection -LocalPort 5420 | Select-Object -ExpandProperty OwningProcess | ForEach-Object { Stop-Process -Id $_ -Force }
```

## Architecture Overview

### Two-layer architecture
1. **Rust (Tauri)**: Thin layer for file I/O, vault management, FS watching, window management
2. **TypeScript (Svelte)**: All application logic — indexing, search, parsing, UI

### Why no backend processing?
The Python sidecar was eliminated in PR #18 because:
- iOS/Android cannot spawn child processes
- Simpler architecture (no IPC protocol, no process management)
- Faster startup (no sidecar boot time)
- All Python logic was simple enough to port to TypeScript

### Data flow
```
User action → Svelte component → VaultStore → Tauri IPC (file I/O only) → Rust → Filesystem
                                     ↓
                               JS Services (parser, indexer, search)
                                     ↓
                               UI updates via $state reactivity
```

### Key services (`src/lib/services/`)
- **tauri.ts** — Tauri IPC wrappers (file read/write/list/delete, vault commands)
- **parser.ts** — Extract wikilinks, tags, frontmatter from markdown content
- **indexer.ts** — `LinkIndex` class: backlinks, forward links, tags, graph data, content cache
- **search.ts** — `SearchIndex` class: MiniSearch wrapper with snippet highlighting

### State management
Single `VaultStore` class (`src/lib/stores/vault.svelte.ts`) using Svelte 5 runes (`$state`, `$derived`). Holds: vault config, file tree, open files, active file, backlinks, note names, error state.

### Security
- All file commands validate paths are within the vault boundary (path traversal protection)
- CSP enabled in `tauri.conf.json`
- HTML escaped before rendering in markdown preview and search snippets (XSS protection)
- Shell plugin removed (no process spawning capability)

## File conventions
- Rust commands in `src-tauri/src/commands/` with `#[tauri::command]`
- Svelte components in `src/lib/components/`
- Types in `src/lib/types/index.ts`
- State management in `src/lib/stores/`
- CodeMirror extensions in `src/lib/editor/`
