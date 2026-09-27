# Mobile App Design (Phase 13)

Goal: a doc-md app on Sid's iPhone good enough to **retire Google Keep**. Android follows.
Status: **planned** (2026-09-27). Epic #71. Milestones: M1 foundation #72 · M2 shell #73 · M3 sync #21 · M4 Keep import #74 · M5 photos #75 · M6 share #76. Post-MVP: widget #77 · reminders #78 · Android #79. Roadmap: PLAN.md Phase 13.

## Decisions

| Question | Decision | Why |
|---|---|---|
| Platform | **iOS first**, Android next | Sid's phone is an iPhone; Apple Developer Program is already active (EAS builds for Reader) |
| Framework | **Tauri 2 iOS**, same Svelte frontend | Editor, parser, index, search, kanban, and themes are reused as-is. An Expo/React Native app would rewrite all of it and still run CodeMirror in a WebView |
| Build | **GitHub Actions macOS runner → TestFlight** for everyday installs; **Sid's M1 MacBook Air (2020)** for the dev loop | CI builds don't need the Mac to be on. The Mac gives live reload on the phone plus Safari Web Inspector. EAS can't build Tauri apps |
| Sync | **Private GitHub repo**, via the GitHub API (this is #21) | Free, full history, same code on every platform, no git binary on the phone |
| MVP must-haves | Quick notes, checklists, pins, labels, **share into doc-md**, **photos from camera** | Sid's answers 2026-09-27 |
| Post-MVP | Home-screen widget, reminders, Android | "Nice to have, not MVP" |
| Migration | **Google Takeout import** | Existing Keep notes come along |

### What Tauri costs us vs. Expo (accepted tradeoffs)
- No EAS-style credential management or OTA updates: signing lives in GitHub secrets, and every change ships as a new TestFlight build.
- Native extras (Share Extension, widget) mean hand-editing the generated Xcode project (`gen/apple/project.yml`) and writing small Swift targets. Expo has config plugins for these; Tauri does not.
- The cloud Claude session can't reach Sid's Mac. On-device checks happen when Sid pulls a branch and runs `tauri ios dev` there. For native-heavy work (M1 init, M6 share extension), a local Claude Code session on the Mac can drive Xcode and the simulator directly. UI is still built and verified in browser mock mode first (Playwright screenshots at phone size), and Settings gets an in-app debug log for TestFlight builds.

## Architecture

```
┌──────────────── iPhone ────────────────┐        ┌──── Windows desktop ────┐
│ MobileApp.svelte (Keep-style shell)    │        │ App.svelte (3-pane)     │
│   └─ shared stores/services:           │        │   └─ same stores/       │
│      vault, parser, index, search,     │        │      services           │
│      livepreview editor, themes        │        │                         │
│ sync core (TS, 3-way diff)             │        │ sync core (same TS)     │
│ Rust: file I/O, Keychain, GitHub HTTP  │        │ Rust: same commands     │
│ Vault: app Documents/doc-md            │        │ Vault: any folder       │
└──────────────────┬─────────────────────┘        └───────────┬─────────────┘
                   │  GitHub REST (Git Data API)              │
                   └──────────► private notes repo ◄──────────┘
```

- **One frontend, two shells.** `src/main.ts` already routes by query param (sticky, capture). It gains a branch: iOS/Android (or `?mobile=1` in a plain browser) mounts `MobileApp.svelte`. All stores and services stay shared. Desktop-only init (`initCloseToTray`, `initStickies`, `initScreenshots`, zoom) is skipped on mobile.
- **Rust gating.** Tray, global shortcut, screenshot, transcription, and the `notify` watcher are `cfg(desktop)`. On mobile nothing else writes to the app sandbox except sync, so the file tree refreshes on app foreground and after each sync instead of from a watcher.
- **Vault on the phone** lives at `<app Documents>/doc-md`, created on first launch with no folder picker. With `UIFileSharingEnabled` and `LSSupportsOpeningDocumentsInPlace` set, the notes show up in the Files app (On My iPhone › doc-md) as plain markdown files.
- **Bundle identifier.** iOS uses `com.paperhurts.docmd` via `src-tauri/tauri.ios.conf.json`, which Tauri merges over `tauri.conf.json` as a JSON Merge Patch. Desktop keeps `com.docmd.app`, because changing it would move the desktop app's config and localStorage (vault path, themes, stickies). Apple App IDs are also permanent and global, and `com.docmd.*` isn't a namespace we own. **Decide this before the first TestFlight upload; it can't change afterwards.**
- **iOS config surfaces** (Tauri 2): `bundle > iOS` (`developmentTeam`, `minimumSystemVersion` default 15.0, `bundleVersion`). `src-tauri/Info.ios.plist` is merged into the generated Info.plist automatically. Entitlements (App Group) have no config key, so they are edited in `gen/apple/doc-md_iOS/doc-md_iOS.entitlements`. That's the main reason `gen/apple` is committed.

## Sync engine (#21)

Files stay the only source of truth (docs/COLLABORATION.md). Sync is just moving files, and it must never lose an edit.

**Split:** the *logic* is pure TypeScript (unit-testable with a fake GitHub). The *transport and credential* live in Rust. The token is stored in the OS keychain (Keychain on iOS/macOS, Credential Manager on Windows, via the `keyring` crate). One Rust command, `github_api(method, path, body)`, adds the auth header and only allows paths under `/repos/{configured owner}/{configured repo}/`. **The token never enters JavaScript**, so a malicious note that somehow ran script in the preview still couldn't read it.

**Auth (v1):** a fine-grained personal access token with access to *only* the notes repo and permission *Contents: read & write*. Sid pastes it in once per device. GitHub's OAuth device flow could replace this later.

**State:** `<app data>/sync-state.json`, stored per vault and outside the vault so it never syncs itself. It records `{repo, branch, lastCommitSha, base: {path → blobSha}}`.

**Algorithm (one sync pass):**
1. `GET /git/ref/heads/main` with ETag (a 304 is free against the rate limit). If the head is unchanged and no local file changed, stop.
2. `GET /git/trees/{sha}?recursive=1` gives `remote: {path → blobSha}`.
3. Scan the vault and compute each file's **git blob SHA** locally (SHA-1 of `"blob <len>\0" + bytes`, via WebCrypto), cached by mtime+size. This lets local and remote be compared **without downloading anything**.
4. For every path in base ∪ local ∪ remote:

| local vs base | remote vs base | action |
|---|---|---|
| same | same | nothing |
| changed/new/deleted | same | push |
| same | changed/new/deleted | pull (write or delete locally) |
| both changed to the same SHA | — | nothing |
| both changed differently | — | **conflict** |

5. **Conflicts never lose data.** For `.md` files, try a line-level 3-way merge (diff3). If it merges cleanly, keep the merged result. Otherwise keep the local file in place and write the remote version beside it as `name (conflict iPhone 2026-09-27 1432).md`. An edit beats a delete, so the edited file comes back. For binaries, keep both.
6. Pull: write/delete locally. **Open editor buffers are flushed first**, so a pull never overwrites unsaved typing.
7. Push: create blobs, create a tree on top of the remote tree (`base_tree`), create a commit whose parent is the remote head (message `Sync from iPhone`), then fast-forward the ref. If someone else pushed in between (422), restart from step 1, with a bounded number of retries.
8. Save the resulting tree as the new `base`.

**When it runs:** on app foreground, about 20 s after the last save (debounced), on pull-to-refresh or **Sync now**, and on desktop also on window focus and every few minutes.
**Ignored:** dot-files and dot-dirs (`.git`, `.doc-md`, `.obsidian`), `node_modules`, `target` (same rules as the file tree), and files over 50 MB.
**First connect:** an empty repo gets the vault pushed. An empty vault pulls everything. If both have content, the union is merged and conflicts become conflict copies, so nothing is overwritten.
**Notes repo:** `paperhurts/dm-notes` (private), not the doc-md code repo, which is public. Don't also commit to the synced folder by hand with local git. Cloning the repo elsewhere to browse history is fine.

## Mobile shell, Keep-style (#73)

**Home**
- A search bar at the top (tap to open search), with a label-chip row under it (labels = `#tags`).
- **Pinned** section, then **Others**, each in a 2-column masonry grid sorted by last edited. The grid shows **every note in the vault**, not just quick notes (Sid, 2026-09-27).
- Card: title, a light rendered preview (about 8 lines; checklist items show ☐/☑, up to 6), the first image as a thumbnail, and tag chips. There are no per-note colors; the theme sets the look.
- Tap opens the note. Long-press opens a sheet: Pin/Unpin · Archive · Labels · Delete (in-app confirm dialog, never native `confirm()`, see tasks/lessons.md).
- Bottom bar: "Take a note…" · new checklist · photo, plus a floating **+** button.
- The drawer has Notes · Archive · Labels · Folders (the full vault tree) · Settings.

**Note screen**
- Back (saves) · pin toggle · overflow menu (labels, archive, delete).
- A title field (blank means the file is named by timestamp, see below), then the **CodeMirror live-preview editor** already built for desktop, including tappable checkboxes and markdown list continuation on Enter.
- A **keyboard toolbar** stays above the iOS keyboard (via `visualViewport`) with: ☐ checklist · • bullet · H · B · I · `[[` · `#` · 📷 photo · undo/redo.
- An "Edited 3:42 PM" footer.

**Note metadata is frontmatter:** `pinned: true`, `archived: true`. State changes never move files, so wikilinks and sync stay stable, and desktop can read all of it.
**Where quick notes go:** `inbox/` by default (configurable in Settings). The title field sets the filename. Untitled notes are named `YYYY-MM-DD HHmm.md` and the card shows their first line.
**Safe areas:** `viewport-fit=cover` and `env(safe-area-inset-*)`. All 7 themes work, Hot Dog Stand included.
**Deferred on mobile:** graph view, stickies, screenshot capture, transcription, and kanban drag-and-drop (HTML5 DnD doesn't work with touch). Boards open as markdown until a touch interaction exists.

## Google Keep import from Takeout (#74)

A one-time desktop job: pick the unzipped `Takeout/Keep/` folder. Sync then carries the notes to the phone.

| Keep JSON | doc-md |
|---|---|
| `title` / first words / `keep-<created>` | filename in `keep/` (sanitized, deduped with ` 2`) |
| `textContent` | body |
| `listContent[{text, isChecked}]` | `- [ ] text` / `- [x] text` |
| `labels[{name}]` | frontmatter `tags:` |
| `isPinned`, `isArchived` | frontmatter `pinned`, `archived` |
| `color` | ignored (doc-md uses themes, not per-note colors) |
| `isTrashed` | skipped (counted in the report) |
| `attachments[{filePath, mimetype}]` | copied to `attachments/keep/`, embedded `![](…)`; audio is linked |
| `annotations[{title, url}]` | a `Links` list at the end |
| `createdTimestampUsec`, `userEditedTimestampUsec` | frontmatter `created`, `updated` |

Plus `source: google-keep` in frontmatter. The importer never overwrites existing files and ends with a report ("Imported N notes, M images, skipped K trashed"). It's a pure-TS converter with fixture tests. **Takeout's format drifts over time, so the fixtures are checked against 2–3 of Sid's real (non-sensitive) exported notes before this ships.**

## Photos (#75, MVP)

The 📷 button uses `<input type="file" accept="image/*">`, which on iOS offers Take Photo, Photo Library, or Choose File. Before saving, the photo is downscaled on a canvas to at most 2048 px as JPEG q≈0.85, so a 12 MP photo doesn't bloat the notes repo. It's saved through the existing pasted-image pipeline to `attachments/`. `NSCameraUsageDescription` is added to Info.plist.

## Share into doc-md (#76, MVP, iOS Share Extension)

- A small Swift **Share Extension** target (`com.paperhurts.docmd.share`) is added to `gen/apple/project.yml`. It accepts text, URLs, and images.
- The extension and the app share an **App Group** (`group.com.paperhurts.docmd`). The extension writes an inbox item (JSON plus any image files) into the group container and exits. It never touches the vault directly.
- On launch or foreground, the app drains that inbox and turns each share into a new quick note (URL becomes a link, text becomes the body, an image gets embedded), then syncs.
- The app needs a tiny Swift Tauri plugin to get the App Group container path (`FileManager.containerURL(forSecurityApplicationGroupIdentifier:)`).
- This is the most native-heavy piece (XcodeGen + extension + second provisioning profile + App Group), so it lands last in the MVP, after the pipeline is proven.

## Build & distribution, iOS (#72)

- All `tauri ios` commands run only on macOS hosts. **`gen/apple` is generated once on Sid's Mac** (`npm run tauri ios init`), after the M1 branch has `tauri.ios.conf.json`, because init reads the identifier. From then on it's committed like any source.
- `ios.yml` runs on manual trigger and on version tags, on a macOS runner:
  1. `rustup target add aarch64-apple-ios`, then `npm ci`.
  2. `npm run tauri ios build -- --export-method app-store-connect --build-number <run number>`, which writes `src-tauri/gen/apple/build/arm64/doc-md.ipa`.
  3. `xcrun altool --upload-app --type ios --file <ipa> --apiKey $APPLE_API_KEY_ID --apiIssuer $APPLE_API_ISSUER`. altool reads the key from `~/private_keys/AuthKey_<KEY_ID>.p8`.
- **Signing is automatic**, driven by the App Store Connect API key. Tauri reads `APPLE_API_ISSUER`, `APPLE_API_KEY` (key ID), `APPLE_API_KEY_PATH` (.p8 path, required on iOS) and `APPLE_DEVELOPMENT_TEAM`. Tauri's docs call for an **Admin** key for automatic signing, because it creates provisioning profiles, including the Share Extension's later. Manual signing (`IOS_CERTIFICATE`, `IOS_CERTIFICATE_PASSWORD`, `IOS_MOBILE_PROVISION`) is the fallback.
- **Sid's one-time setup:** create the App Store Connect app record for `com.paperhurts.docmd`, create an Admin App Store Connect API key (or check whether Reader's EAS key has Admin), add GitHub secrets `APPLE_API_ISSUER`, `APPLE_API_KEY_ID`, `APPLE_API_KEY_P8` (base64 of the .p8) and `APPLE_DEVELOPMENT_TEAM`, and add herself as an internal TestFlight tester.
- **TestFlight builds expire after 90 days**, so the plan is a rebuild at least every ~80 days, even without changes.
- **Dev loop (Mac):**
  1. Pull the branch.
  2. Run `npm run tauri ios dev` and pick the iPhone (cable or same Wi-Fi) or a simulator. Vite already honors `TAURI_DEV_HOST` for on-device live reload (vite.config.ts).
  3. Debug in Safari → Develop → <iPhone> → doc-md for the Web Inspector.
- **Everyday installs:** CI → TestFlight, so the phone app doesn't depend on the Mac being on.
- **Mac setup (one time):**
  - Xcode from the App Store: open it once, accept the license, add the iOS platform. Xcode plus a simulator needs roughly 30 GB free.
  - Sign in to the Apple ID in Xcode → Settings → Accounts.
  - Homebrew + `brew install cocoapods`.
  - Rust via rustup, then `rustup target add aarch64-apple-ios aarch64-apple-ios-sim`.
  - Node 18+, clone doc-md, `npm ci`.
  - iPhone: Settings → Privacy & Security → Developer Mode on, and Settings → Safari → Advanced → Web Inspector on.
  - Mac Safari: Settings → Advanced → "Show features for web developers".

## Post-MVP

- **Widget** (#77, WidgetKit extension, same App Group): "New note" / "New checklist" buttons deep-linking to `docmd://new?type=checklist`.
- **Reminders** (#78): frontmatter `remind: 2026-10-01T09:00` scheduled as local notifications (tauri-plugin-notification) and re-armed on launch.
- **Android** (#79): `gen/android`, APK built in CI, signed with a self-generated keystore, installed by sideload plus Obtainium for updates. Share-into becomes an intent filter. The vault stays in app-private storage because sync makes shared-storage permissions unnecessary.
- **macOS desktop signing (#43):** the Apple Developer membership also covers Developer ID signing and notarization for the desktop .dmg, so that half of #43 is unblocked.

## Resolved questions (Sid, 2026-09-27)

1. **Home grid scope:** every note in the vault (recency-sorted, pinned first, filterable by label/folder).
2. **Notes repo:** `paperhurts/dm-notes`, private.
3. **Mac:** a 2020 MacBook Air (M1) is available. It's used for the dev loop and to generate `gen/apple`; CI still produces the TestFlight builds.
4. **Keep colors:** dropped entirely (no card tints, no color menu, the importer ignores `color`). Themes cover the look.
