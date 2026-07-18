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

## Artifacts produced

| Platform | Installers |
|---|---|
| Windows | `.msi` (WiX), `.exe` (NSIS) |
| macOS | `.dmg`, `.app` (universal: Apple Silicon + Intel) |
| Linux | `.deb`, `.rpm`, `.AppImage` |

Builds are unsigned for now — Windows SmartScreen and macOS Gatekeeper will
warn on first run. Code signing / notarization is future work.

## Icons

`src-tauri/icons/` is generated with `npx tauri icon src-tauri/icons/icon.png`.
The current source is 256×256; if the logo is redone at 1024×1024, rerun that
command to regenerate the full set (including `.icns` and the store logos).
