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
- **screenshot.ts** — Screenshot capture wrappers, save + routing (insert at cursor vs daily note)
- **transcription.ts** — Transcription note type (template, `isTranscriptionContent`, `formatTranscriptLine`), engine command wrappers, and a full mock engine (canned script on an interval)

### Transcription notes (`src/lib/services/transcription.ts` + `TranscriptionBar.svelte`)
- Typed-note pattern like kanban: `transcription: true` frontmatter → `EditorPane` mounts `TranscriptionBar` above the (normal, editable) editor.
- Event contract (Rust → JS, also emitted by the mock engine):
  - `transcription-line` `{source: "mic"|"system", text, tMs, kind: "partial"|"final"}` — partials only update the bar; finals are appended to the note via `vaultStore.appendToNote()` as `- **[HH:MM:SS] [me|audio]** text`
  - `transcription-status` `{state: "listening"|"stopped"|"error", message?}`
  - `transcription-model-progress` `{model, downloaded, total, done?, error?}`
- Commands: `start_transcription {mic, system, model}`, `stop_transcription`, `get_transcription_models`, `download_transcription_model {model}`. On mobile or `--no-default-features` builds these are stubs returning an error the bar surfaces as its error state — degradation is by design.
- Mock engine: `startTranscription()` outside Tauri runs a 1.2 s interval over a canned script, alternating sources, each line partial-then-final; model downloads emit fake progress. Fully drives the UI at :5420 and in Vitest (fake timers).

### Transcription engine (`src-tauri/src/transcription/`, Cargo feature `transcription`, default-ON)
- **Feature gate**: `all(desktop, feature = "transcription")`; deps (`whisper-rs`, `cpal`, `ureq`) are optional + desktop-target-gated. Default-ON so CI/release always build it; `cargo tauri dev --no-default-features` for lean dev builds. **Build toolchain: CMake + LLVM/libclang** (whisper.cpp via CMake, bindgen needs libclang — the `WHISPER_DONT_GENERATE_BINDINGS` shortcut does NOT work on Windows: the shipped bindings are Linux-generated and their glibc struct-size asserts fail under MSVC).
- **audio.rs**: mic = default input device; system audio = WASAPI loopback — `build_input_stream` on the default *output* device using `default_output_config()` (input-config calls fail on render devices). Callbacks downmix + linear-resample to 16 kHz mono (`chunker::to_mono_16k`) and send over mpsc. Streams die on default-device switch: capture loop rebuilds with 1 s backoff, gives up with a status event after 5 straight failures (mic failure message includes the Windows privacy-settings hint).
- **chunker.rs** (pure, unit-tested): energy-based VAD. Finals flush at a >= 700 ms trailing-silence boundary (natural pause = clean cut — the plan's overlap+dedup was dropped for v1 simplicity; hard cap 12 s can clip mid-word, documented tradeoff) or at the 12 s cap; partial snapshots of the growing buffer every >= 2.5 s (throttled to 3x the last inference cost so slow machines don't fall behind); all-silent audio is discarded. Timestamps derive from consumed-sample counts.
- **Silence synthesis**: WASAPI loopback emits nothing while the machine is quiet — the engine thread synthesizes zero-samples from wall-clock gaps (> 400 ms) for the system source so pause-flushes fire and timestamps track real time.
- **mod.rs**: one capture thread + one engine thread per enabled source; both share one `WhisperContext` (per-call states), giving [me]/[audio] attribution for free. Whisper non-speech markers ([BLANK_AUDIO], (music)) are filtered. Session teardown = drop → stop flag → engine threads drain a last final chunk; the bar ignores post-stop events.
- **download.rs**: worker thread streams to `<model>.part`, progress events every ~4 MB, size-verified, atomic rename — a half-written file can never be mistaken for a model. Models live in `app_data_dir()/models/ggml-<id>.bin` (catalog in models.rs, ids validated against it).

### Screenshot capture (`src-tauri/src/screenshot.rs` + `src/lib/services/screenshot.ts`)
- Global hotkey via `tauri-plugin-global-shortcut` (registered Rust-side in `setup()`; failure is stored, surfaced in Settings, never fatal). Screen grab via `xcap` (GDI path — the `wgc` feature is deliberately off to avoid Windows' capture border).
- Flow: hotkey → hide main window if visible (+150 ms DWM settle) → capture monitor under cursor → frozen frame into `CaptureState` → frameless always-on-top overlay window at `index.html?capture=1` (routed in `src/main.ts`, label `capture` in `capabilities/default.json`) sized/positioned with **Physical** units post-creation.
- **DPI convention: the overlay converts CSS px → physical px via `devicePixelRatio`; Rust only clamps** (`clamp_rect`). Keep it that way — one conversion point.
- The cropped PNG returns to the frontend as base64 and is saved through the existing `write_binary_file` vault-validated pipeline. The overlay emits `screenshot-captured {relPath, markdown}`; the main window's listener inserts at the cursor (via `stores/editorBridge.svelte.ts`) or falls back to `vaultStore.appendToDailyNote()` — which never shows a hidden window.
- The overlay's `Destroyed` window event is the cleanup safety net (drops the frame, restores main-window visibility) no matter how the overlay dies.
- Mobile builds compile stub commands that return an error; desktop-only deps are target-gated in `Cargo.toml`.
- Mock mode: `triggerCapture()` skips the overlay, saves a synthetic 1×1 PNG, and emits the same event — the full routing path runs in browser/Vitest.

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
