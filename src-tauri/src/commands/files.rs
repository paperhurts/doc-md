use super::vault::VaultState;
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::Path;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct VaultEntry {
    pub name: String,
    pub path: String,
    pub is_dir: bool,
    pub children: Option<Vec<VaultEntry>>,
}

fn build_tree(dir: &Path, depth: usize) -> Result<Vec<VaultEntry>, String> {
    if depth > 20 {
        return Ok(vec![]);
    }

    let mut entries: Vec<VaultEntry> = Vec::new();
    let read_dir = fs::read_dir(dir).map_err(|e| format!("Read dir error: {}", e))?;

    for entry in read_dir {
        let entry = entry.map_err(|e| format!("Entry error: {}", e))?;
        let path = entry.path();
        let name = entry.file_name().to_string_lossy().to_string();

        // Skip hidden files/dirs and common non-note directories
        if name.starts_with('.') || name == "node_modules" || name == "target" {
            continue;
        }

        let is_dir = path.is_dir();
        let children = if is_dir {
            Some(build_tree(&path, depth + 1)?)
        } else {
            None
        };

        entries.push(VaultEntry {
            name,
            path: path.to_string_lossy().to_string(),
            is_dir,
            children,
        });
    }

    // Sort: directories first, then alphabetically
    entries.sort_by(|a, b| match (a.is_dir, b.is_dir) {
        (true, false) => std::cmp::Ordering::Less,
        (false, true) => std::cmp::Ordering::Greater,
        _ => a.name.to_lowercase().cmp(&b.name.to_lowercase()),
    });

    Ok(entries)
}

#[tauri::command]
pub async fn list_files(
    vault_path: String,
    vault_state: tauri::State<'_, VaultState>,
) -> Result<Vec<VaultEntry>, String> {
    let validated = vault_state.validate_path(&vault_path).await?;
    if !validated.is_dir() {
        return Err(format!("Not a directory: {}", vault_path));
    }
    build_tree(&validated, 0)
}

#[tauri::command]
pub async fn read_file(
    file_path: String,
    vault_state: tauri::State<'_, VaultState>,
) -> Result<String, String> {
    let validated = vault_state.validate_path(&file_path).await?;
    fs::read_to_string(&validated).map_err(|e| format!("Read error: {}", e))
}

#[tauri::command]
pub async fn write_file(
    file_path: String,
    content: String,
    vault_state: tauri::State<'_, VaultState>,
) -> Result<(), String> {
    let validated = vault_state.validate_path(&file_path).await?;
    // Ensure parent directory exists
    if let Some(parent) = validated.parent() {
        fs::create_dir_all(parent).map_err(|e| format!("Create dir error: {}", e))?;
    }
    fs::write(&validated, content).map_err(|e| format!("Write error: {}", e))
}

#[tauri::command]
pub async fn delete_file(
    file_path: String,
    vault_state: tauri::State<'_, VaultState>,
) -> Result<(), String> {
    let validated = vault_state.validate_path(&file_path).await?;
    if validated.is_dir() {
        fs::remove_dir_all(&validated).map_err(|e| format!("Delete dir error: {}", e))
    } else {
        fs::remove_file(&validated).map_err(|e| format!("Delete file error: {}", e))
    }
}

#[tauri::command]
pub async fn rename_file(
    old_path: String,
    new_path: String,
    vault_state: tauri::State<'_, VaultState>,
) -> Result<(), String> {
    let validated_old = vault_state.validate_path(&old_path).await?;
    let validated_new = vault_state.validate_path(&new_path).await?;
    if let Some(parent) = validated_new.parent() {
        fs::create_dir_all(parent).map_err(|e| format!("Create dir error: {}", e))?;
    }
    fs::rename(&validated_old, &validated_new).map_err(|e| format!("Rename error: {}", e))
}

#[tauri::command]
pub async fn create_directory(
    dir_path: String,
    vault_state: tauri::State<'_, VaultState>,
) -> Result<(), String> {
    let validated = vault_state.validate_path(&dir_path).await?;
    fs::create_dir_all(&validated).map_err(|e| format!("Create dir error: {}", e))
}
