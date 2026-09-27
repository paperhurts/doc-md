# doc-md: Obsidian Replacement App — Implementation Plan

## Overview

A full-featured, local-first markdown knowledge management app built with **Tauri 2** (Rust desktop shell) and a **Svelte 5** web frontend. Notes are stored as plain markdown files on disk. All indexing, search, and parsing runs in the frontend TypeScript layer.

**Target platforms**: Windows, macOS, iOS, Android (via Tauri 2). Mobile design: `docs/MOBILE.md` (Phase 13).

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

### Phase 9: Polish & Settings — COMPLETE
21. 5 themes: Midnight (default), Dark TM, Editorial, Cyberpunk, Studio ✅
22. Settings panel (Ctrl+,): font sizes, tab size, auto-save, folders, shortcuts ✅
23. Keyboard shortcuts reference in settings ✅

### Phase 10: Plugin System — NOT STARTED
24. Plugin architecture (JS plugins in `.doc-md/plugins/`)
25. Plugin manager UI

### Phase 11: Desktop & Boards Wave (July 2026) — COMPLETE (shipped in v0.2.0)
26. Test infrastructure: Vitest + browser mock backend (#35) ✅ — prerequisite for 27–31 test coverage
27. Preview-edit view mode: CM6 live preview, 3 view modes (#36) ✅
28. Clipboard image paste + asset-protocol rendering (#39) ✅ — depends on 26 (mock binary FS)
29. Kanban boards, markdown-backed (#40) ✅ — data model designed for Phase 12
30. System tray + close-to-tray (#37) ✅
31. Desktop sticky notes via multi-window (#38) ✅ — depends on 30 (tray toggle entry)

### Phase 12: Team Sharing — NOT STARTED
32. Git/GitHub vault sync (#21) — **pulled forward into Phase 13 as M3** (GitHub API sync engine, see docs/MOBILE.md)
33. Conflict surfacing UI — v1 ships as conflict copies in #21; a richer "theirs/mine" UI stays here
34. Attribution via git history

### Phase 13: Mobile — iOS first, replace Google Keep (#71) — PLANNED 2026-09-27
Design + rationale: `docs/MOBILE.md`. Tauri 2 iOS reusing the Svelte frontend; CI-built on macOS runners and shipped via TestFlight; dev loop (`tauri ios dev` + Safari Web Inspector) on Sid's M1 MacBook Air. Notes sync to the private `paperhurts/dm-notes` repo.

**MVP**
35. M1 iOS foundation (#72): cfg(desktop) gating, app-sandbox vault, `tauri.ios.conf.json` (`com.paperhurts.docmd`), `gen/apple` generated on Sid's M1 MacBook Air, `ios.yml` TestFlight pipeline — tracer bullet, first
36. M2 Mobile shell (#73): Keep-style home grid, full-screen live-preview editor, keyboard toolbar — built in browser mock mode, parallel with 35
37. M3 Sync via private GitHub repo (#21): TS 3-way sync core + Rust keychain/HTTP transport — core parallel with 35–36; on-device test needs 35
38. M4 Google Keep import from Takeout (#74): pure-TS converter, desktop command — independent; reaches the phone via 37
39. M5 Photos from camera/library (#75) — depends on 35 (Info.plist) + 36 (toolbar)
40. M6 iOS Share Extension (#76) — depends on 35 (committed gen/apple, signing); App Group + Swift target, last because most native-heavy

**Post-MVP**
41. Home-screen widget (#77) — depends on 40 (App Group plumbing)
42. Reminders via local notifications (#78)
43. Android build + share intent (#79) — reuses 36–39; APK sideload via CI

```
35 M1 foundation ──┬──► 39 M5 photos
                   ├──► 40 M6 share ──► 41 widget
                   └──► on-device test of 36, 37
36 M2 shell ───────────► 39
37 M3 sync  ◄── 38 M4 import (needs sync to reach phone)
36+37+38+39 ──► 43 Android
```

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
