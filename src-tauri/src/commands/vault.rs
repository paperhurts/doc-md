use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use tauri::{AppHandle, Manager};
use tokio::sync::Mutex;

/// Validate that a filesystem path is within the vault boundary.
/// For paths that don't exist yet (a first screenshot into a not-yet-created
/// attachments/ folder), canonicalize the nearest EXISTING ancestor and
/// re-append the missing components. The missing tail bypasses
/// canonicalization, so any `.`/`..` in it is refused rather than resolved —
/// on Windows a lexical `..` after a nonexistent component would otherwise
/// escape the vault before the containment check.
fn canonicalize_or_parent(path: &str) -> Result<PathBuf, String> {
    if let Ok(canon) = fs::canonicalize(path) {
        return Ok(canon);
    }
    let p = PathBuf::from(path);
    if p
        .components()
        .any(|c| matches!(c, std::path::Component::ParentDir | std::path::Component::CurDir))
    {
        return Err(format!("Relative components not allowed in new paths: {}", path));
    }
    let mut base = p.clone();
    let mut tail: Vec<std::ffi::OsString> = Vec::new();
    loop {
        match (base.parent(), base.file_name()) {
            (Some(parent), Some(name)) => {
                tail.push(name.to_os_string());
                base = parent.to_path_buf();
            }
            _ => return Err(format!("Cannot resolve path: {}", path)),
        }
        if let Ok(canon) = fs::canonicalize(&base) {
            let mut out = canon;
            for c in tail.iter().rev() {
                out.push(c);
            }
            return Ok(out);
        }
    }
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct VaultConfig {
    pub path: String,
    pub name: String,
}

pub struct VaultState {
    pub current: Mutex<Option<VaultConfig>>,
    config_path: PathBuf,
}

impl VaultState {
    pub fn new(app: &AppHandle) -> Self {
        let config_path = app
            .path()
            .app_config_dir()
            .unwrap_or_else(|_| PathBuf::from("."))
            .join("vault-config.json");

        let current = if config_path.exists() {
            fs::read_to_string(&config_path)
                .ok()
                .and_then(|s| serde_json::from_str::<VaultConfig>(&s).ok())
        } else {
            None
        };

        Self {
            current: Mutex::new(current),
            config_path,
        }
    }

    /// Validate that a path is within the currently open vault.
    /// Returns the canonicalized path on success.
    pub async fn validate_path(&self, path: &str) -> Result<PathBuf, String> {
        let current = self.current.lock().await;
        let vault = current.as_ref().ok_or("No vault is open")?;
        let vault_root = fs::canonicalize(&vault.path)
            .map_err(|e| format!("Vault root resolve error: {}", e))?;
        let requested = canonicalize_or_parent(path)?;
        if !requested.starts_with(&vault_root) {
            return Err(format!("Path is outside the vault: {}", path));
        }
        Ok(requested)
    }

    pub async fn set_vault(&self, config: VaultConfig) -> Result<(), String> {
        // Persist to disk
        if let Some(parent) = self.config_path.parent() {
            fs::create_dir_all(parent).map_err(|e| format!("Config dir error: {}", e))?;
        }
        let json =
            serde_json::to_string_pretty(&config).map_err(|e| format!("Serialize error: {}", e))?;
        fs::write(&self.config_path, json).map_err(|e| format!("Write config error: {}", e))?;

        let mut current = self.current.lock().await;
        *current = Some(config);
        Ok(())
    }
}

#[tauri::command]
pub async fn get_current_vault(
    state: tauri::State<'_, VaultState>,
) -> Result<Option<VaultConfig>, String> {
    let current = state.current.lock().await;
    Ok(current.clone())
}

/// Allow the asset protocol to serve files from the vault directory only.
/// The static scope in tauri.conf.json is empty; access is granted at runtime
/// per-vault so images resolve while everything else on disk stays blocked.
pub fn allow_vault_assets(app: &AppHandle, vault_path: &str) {
    if let Err(e) = app.asset_protocol_scope().allow_directory(vault_path, true) {
        eprintln!("[vault] failed to extend asset scope: {}", e);
    }
}

#[tauri::command]
pub async fn set_current_vault(
    app: AppHandle,
    state: tauri::State<'_, VaultState>,
    path: String,
) -> Result<VaultConfig, String> {
    let p = PathBuf::from(&path);
    if !p.is_dir() {
        return Err(format!("Not a directory: {}", path));
    }

    let name = p
        .file_name()
        .map(|n| n.to_string_lossy().to_string())
        .unwrap_or_else(|| "Vault".to_string());

    let config = VaultConfig {
        path: path.clone(),
        name,
    };

    state.set_vault(config.clone()).await?;
    allow_vault_assets(&app, &path);
    Ok(config)
}

#[cfg(test)]
mod tests {
    use super::canonicalize_or_parent;
    use std::fs;

    fn unique_temp_dir(tag: &str) -> std::path::PathBuf {
        let dir = std::env::temp_dir().join(format!("docmd-vault-test-{tag}-{}", std::process::id()));
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(&dir).unwrap();
        dir
    }

    #[test]
    fn resolves_new_file_under_missing_subdirs() {
        // <existing>/attachments/screenshot.png where attachments/ does not
        // exist yet — the exact shape of a first screenshot in a fresh vault.
        let root = unique_temp_dir("newdirs");
        let target = root.join("attachments").join("screenshot.png");
        let resolved = canonicalize_or_parent(&target.to_string_lossy()).unwrap();
        assert!(resolved.ends_with(std::path::Path::new("attachments").join("screenshot.png")));
        assert!(resolved.starts_with(fs::canonicalize(&root).unwrap()));
        let _ = fs::remove_dir_all(&root);
    }

    #[test]
    fn resolves_existing_file() {
        let root = unique_temp_dir("existing");
        let file = root.join("note.md");
        fs::write(&file, "x").unwrap();
        let resolved = canonicalize_or_parent(&file.to_string_lossy()).unwrap();
        assert_eq!(resolved, fs::canonicalize(&file).unwrap());
        let _ = fs::remove_dir_all(&root);
    }

    #[test]
    fn rejects_traversal_in_missing_tail() {
        // ".." inside a not-yet-existing tail bypasses canonicalization and
        // must be refused, not resolved.
        let root = unique_temp_dir("traversal");
        let sneaky = root.join("nope").join("..").join("..").join("escape.png");
        assert!(canonicalize_or_parent(&sneaky.to_string_lossy()).is_err());
        let _ = fs::remove_dir_all(&root);
    }
}
