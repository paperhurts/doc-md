# Releasing doc-md

Releases are tag-driven: pushing a `v*` tag makes GitHub Actions build
installers for Windows, macOS (universal), and Linux, and attach them to a
**draft** GitHub Release for review.

## Checklist

1. **Bump the version** (all three must match):
   - `src-tauri/tauri.conf.json` → `version`
   - `src-tauri/Cargo.toml` → `version` (then run `cargo check` in `src-tauri/` to refresh `Cargo.lock`)
   - `package.json` → `version`
2. **Update `CHANGELOG.md`** with a section for the new version.
3. **Verify**: `npm test`, `cd src-tauri && cargo test --lib`, and a local
   `npm run tauri build` if the bundle config or Rust deps changed.
4. **Commit and push** (via the normal branch flow; main is protected by the CI check).
5. **Tag and push the tag**:
   ```bash
   git tag vX.Y.Z
   git push origin vX.Y.Z
   ```
6. The **Release workflow** (`.github/workflows/release.yml`) builds all
   platforms and creates a draft release with the installers.
7. **Review the draft** on GitHub (artifacts present, notes correct) and
   click **Publish**.
8. Nothing else — the [downloads page](https://paperhurts.github.io/doc-md/)
   fetches the latest release client-side, so it updates itself the moment
   the release is published.

## Artifacts produced

| Platform | Installers |
|---|---|
| Windows | `.msi` (WiX), `.exe` (NSIS) |
| macOS | `.dmg`, `.app` (universal: Apple Silicon + Intel) |
| Linux | `.deb`, `.rpm`, `.AppImage` |

Code signing activates automatically when credentials exist — see
`docs/SIGNING.md` for the one-time Azure (Windows) and Apple (macOS) setup.
Until then builds are unsigned and SmartScreen/Gatekeeper warn on first run.

## Icons

`src-tauri/icons/` is generated from the vector master `src-tauri/app-icon.svg`
(the "MD" monogram whose D-stem is a cyan down-arrow). To regenerate the full
set (including `.icns`, `.ico`, and the store logos), edit the SVG and run:

```
npm run tauri icon src-tauri/app-icon.svg
```

Never edit the PNGs in `src-tauri/icons/` by hand — change the SVG and rerun.
