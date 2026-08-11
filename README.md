# doc-md

A local-first markdown knowledge management app — an Obsidian alternative built with **Tauri 2** (Rust) and **Svelte 5**.

Notes are stored as **plain markdown files** on disk. No proprietary formats, no cloud lock-in. Targets **Windows, macOS, iOS, and Android** from a single codebase.

**⬇️ [Download the latest release](https://paperhurts.github.io/doc-md/)** — installers for Windows, macOS, and Linux, with install instructions. (Or browse [raw releases](https://github.com/paperhurts/doc-md/releases).)

## Features

- **Markdown editor** — CodeMirror 6 with syntax highlighting, live preview, and split pane editing
- **Preview-edit mode** — Edit formatted text directly (Obsidian-style live preview): markdown syntax hides, headings/bold/checkboxes render inline, the active line reveals its source while you're editing (the whole note renders when the editor is unfocused). Three view modes — MD / Split / Preview — cycle with Ctrl+Shift+E
- **Image paste** — Paste an image from the clipboard: it's saved to `attachments/` in the vault and a markdown link is inserted; images render in the preview
- **Screenshot capture** — Press **Ctrl+Shift+S** anywhere (even with doc-md in the tray, OneNote-style): the screen freezes, drag a region, and the shot lands in `attachments/` with a link inserted at the cursor — or appended to today's daily note when no note is open. Hotkey rebindable in Settings
- **Transcription notes** — A note with `transcription: true` frontmatter gets a recorder bar: it listens to your mic (`[me]`) and/or system audio (`[audio]` — videos, calls) and appends timestamped transcript lines, transcribed **locally** by Whisper (audio never leaves your machine)
- **Kanban boards** — Any note with `kanban: true` frontmatter opens as a drag & drop board (`## headings` = columns, `- [ ]` items = cards). Boards stay plain markdown: diffable, syncable, editable as text
- **Sticky notes** — Pop any note out as a small always-on-top desktop sticky (📌 Stick button or command palette). Toggle all stickies from the tray; positions persist across restarts
- **System tray** — Closing the window minimizes to the tray (setting-gated); tray menu: Show, Toggle sticky notes, Quit
- **Wiki links** — `[[note-name]]` linking with `[[` autocomplete, Ctrl+Click navigation, and backlinks panel
- **Full-text search** — MiniSearch-powered instant search with highlighted snippets (Ctrl+Shift+F)
- **Graph view** — D3 force-directed visualization with current-note highlighting and folder coloring (Ctrl+Shift+G)
- **Tag system** — `#tag` support with tag browser panel, click to filter notes by tag
- **Math rendering** — KaTeX support for `$inline$` and `$$block$$` LaTeX math
- **File explorer** — Tree view sidebar with create, rename, delete, and live external change detection
- **Tabbed editing** — Multiple open files with dirty indicators
- **Daily notes** — Ctrl+D opens today's note, auto-creates with template in `daily/` folder
- **Templates** — `_templates/` folder with variable substitution (`{{date}}`, `{{title}}`, `{{time}}`)
- **Formatting toolbar** — Select text to get a floating toolbar: Bold, Italic, Strike, Code, Heading, Link, Wikilink, Bullet, Checkbox, Blockquote
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
- **CMake + LLVM** — required by the local-Whisper transcription feature (whisper.cpp builds via CMake, its Rust bindings via libclang). Windows: `winget install Kitware.CMake LLVM.LLVM`. Not needed if you build with `--no-default-features` (below).

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

# Faster dev builds without the Whisper transcription engine
# (skips the whisper.cpp compile; transcription notes show
# "not available in this build" instead)
cargo tauri dev --no-default-features
```

## Testing

```bash
# Frontend unit tests (Vitest)
npm test

# Rust unit tests
cd src-tauri && cargo test --lib
```

Running `npm run dev` and opening http://localhost:5420 in a plain browser starts the app in **mock mode**: an in-memory demo vault backs all file operations, so the full UI (including kanban, live preview, and image paste) works without Tauri. This mode powers the automated screenshot verification in `.verify/` (git-ignored).

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
| Ctrl+K | Command palette — quick access to all commands |
| Ctrl+, | Settings panel |
| Ctrl+S | Save current file |
| Ctrl+D | Open today's daily note |
| Ctrl+Shift+F | Search all notes |
| Ctrl+Shift+G | Graph view |
| Ctrl+B | Bold selected text |
| Ctrl+I | Italic selected text |
| Ctrl+E | Inline code |
| Ctrl+Shift+S | Strikethrough |
| Ctrl+Shift+H | Cycle heading (H1→H2→H3→none) |
| Ctrl+Shift+W | Wrap in wikilink |
| Ctrl+Click | Navigate to `[[wikilink]]` target in editor |
| Ctrl+Shift+E | Cycle view mode (MD source → Split → Preview-edit) |
| Escape | Close modals, cancel rename |

## Writing Notes

### Wiki Links
Link between notes with `[[note-name]]` or `[[note-name|display text]]`. Type `[[` in the editor to get autocomplete suggestions. Click a link in the preview pane or Ctrl+Click in the editor to navigate.

### Tags
Add tags anywhere in your note with `#tagname` (must have a space before the `#`). Tags also work in YAML frontmatter:
```yaml
---
tags: [project, ideas]
---
```
Click a tag in the Tags panel (bottom of sidebar) to see all notes with that tag.

### Backlinks
The right panel shows all notes that link **to** the current note. If `note-a.md` contains `[[note-b]]`, then opening `note-b.md` will show `note-a` in the backlinks panel with surrounding context.

### Graph View
The graph (Ctrl+Shift+G) visualizes connections between notes:
- **Active note**: highlighted in a distinct color with larger size
- **Connected notes**: full opacity (notes that link to/from the active note)
- **Unconnected notes**: faded to 25% opacity
- Click any node to open that note. Scroll to zoom, drag to rearrange.

### Daily Notes
Press Ctrl+D to open today's note (`daily/YYYY-MM-DD.md`). If it doesn't exist, it's created from a template. The `daily/` folder is created automatically.

### Templates
Create `.md` files in a `_templates/` folder in your vault. Use template variables:
- `{{date}}` — today's date (YYYY-MM-DD)
- `{{title}}` — the note's name
- `{{time}}` — current time (HH:MM)

Use Ctrl+K → "New from template" to create a note from a template.

### View modes & preview editing
Every note has three view modes (toolbar buttons or Ctrl+Shift+E): **MD** (raw source), **Split** (source + rendered preview), and **Preview** — a live-preview editing surface where markdown syntax is hidden and text renders formatted (headings, bold/italic, checkboxes you can click, bullets, quotes, images, shaded code blocks). Move the cursor onto a line to reveal and edit its raw syntax; when the editor loses focus the whole note renders. Selecting text pops up the formatting toolbar in every mode.

### Pasting images
Paste an image from the clipboard directly into the editor. It's saved as `attachments/pasted-<timestamp>.png` inside the vault and `![](attachments/…)` is inserted at the cursor. Images render in the preview. The attachment folder name is configurable in Settings.

### Screenshot capture
Press **Ctrl+Shift+S** anywhere — the hotkey is system-wide and works while doc-md sits in the tray. The monitor under your cursor freezes, you drag a region (Esc cancels), and the shot is saved as `attachments/screenshot-<timestamp>.png`:

- If a note is open in the editor, `![](attachments/…)` is inserted at the cursor.
- Otherwise (window hidden, nothing open, kanban board showing), it's appended to today's daily note — capture always succeeds silently, like OneNote's quick notes.

The hotkey is rebindable under Settings → Screenshot; if another app owns the combo, the conflict is shown there with a prompt to pick another. (Windows reserves Win+Shift+S for its own Snipping Tool, so that one can't be used.) Capture can also be triggered from the command palette.

### Transcription notes
Ctrl+K → "New transcription note" creates a note with `transcription: true` frontmatter and a `## Transcript` section — or use Ctrl+K → "Transcribe in this note" to add the recorder bar to any existing note (it just adds the same frontmatter flag; delete the flag to remove the bar). Opening any such note shows a recorder bar above the editor:

- **● Listen / ■ Stop** with an elapsed timer and a live partial line while speech is being decoded.
- Independent **Mic** and **System audio** toggles — mic lines are attributed `[me]`, system audio (a video you're watching, the other side of a call) `[audio]`.
- Final lines append to the note as `- **[HH:MM:SS] [me]** text` — plain markdown you can edit like anything else.

Transcription runs locally via Whisper (whisper.cpp). Pick a model under Settings → Transcription (tiny 75 MB / base 142 MB / small 466 MB); it downloads on first use with a progress bar. Windows note: mic capture requires desktop apps to be allowed microphone access in Windows Privacy settings.

### Kanban boards
Ctrl+K → "New kanban board" creates a note like:

```markdown
---
kanban: true
---

## To Do
- [ ] A card

## Done
- [x] Another card
```

Notes with `kanban: true` open as a drag & drop board (columns = `## headings`, cards = `- [ ]` items). Drag cards between columns, double-click to edit, use ◀ ▶ to reorder columns — every change writes straight back to the markdown, so boards remain plain text files you can diff, sync, and eventually share with a team (see `docs/COLLABORATION.md`).

### Sticky notes
Click **📌 Stick** in the editor toolbar (or Ctrl+K → "Pop out as sticky note") to pop the current note out as a small always-on-top desktop sticky. Stickies use the live-preview editor and auto-save to the same file. Hide one with **—**, remove it with **✕**, or toggle all stickies from the tray menu / command palette. Positions and the sticky set persist across restarts.

### System tray
Closing the main window minimizes it to the system tray instead of quitting (toggle "Close to tray" in Settings). The tray menu offers **Show doc-md**, **Toggle sticky notes**, and **Quit**; left-clicking the tray icon restores the window.

### Math
KaTeX math is supported:
- Inline: `$E = mc^2$`
- Block: `$$\int_0^1 x^2 dx$$` (on its own lines)

## Themes

5 built-in themes, switchable via Ctrl+K → "Switch theme":

| Theme | Style |
|---|---|
| **Midnight** (default) | Sleek dark with lavender accents |
| **Dark TM** | Neon cyan/magenta dual accent on dark |
| **Editorial** | Stark white, serif typography, minimal color |
| **Cyberpunk** | Neon green terminal with glow + scanlines |
| **Studio** | Warm amber/cream with soft shadows |

Your theme choice is saved and persists across restarts.

## License

MIT
