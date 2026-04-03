use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use tauri::{AppHandle, Manager};
use tokio::sync::Mutex;

/// Validate that a filesystem path is within the vault boundary.
/// For paths that don't exist yet (new files), canonicalizes the parent directory.
fn canonicalize_or_parent(path: &str) -> Result<PathBuf, String> {
    // Try canonicalizing directly first (works for existing paths)
    if let Ok(canon) = fs::canonicalize(path) {
        return Ok(canon);
    }
    // For new files: canonicalize the parent and append the filename
    let p = PathBuf::from(path);
    let parent = p.parent().ok_or_else(|| format!("No parent directory for: {}", path))?;
    let filename = p.file_name().ok_or_else(|| format!("No filename in path: {}", path))?;
    let canon_parent = fs::canonicalize(parent)
        .map_err(|e| format!("Cannot resolve parent directory: {}", e))?;
    Ok(canon_parent.join(filename))
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

#[tauri::command]
pub async fn set_current_vault(
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
    Ok(config)
}
