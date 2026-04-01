use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};

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
pub fn list_files(vault_path: String) -> Result<Vec<VaultEntry>, String> {
    let path = PathBuf::from(&vault_path);
    if !path.is_dir() {
        return Err(format!("Not a directory: {}", vault_path));
    }
    build_tree(&path, 0)
}

#[tauri::command]
pub fn read_file(file_path: String) -> Result<String, String> {
    fs::read_to_string(&file_path).map_err(|e| format!("Read error: {}", e))
}

#[tauri::command]
pub fn write_file(file_path: String, content: String) -> Result<(), String> {
    // Ensure parent directory exists
    if let Some(parent) = Path::new(&file_path).parent() {
        fs::create_dir_all(parent).map_err(|e| format!("Create dir error: {}", e))?;
    }
    fs::write(&file_path, content).map_err(|e| format!("Write error: {}", e))
}

#[tauri::command]
pub fn delete_file(file_path: String) -> Result<(), String> {
    let path = Path::new(&file_path);
    if path.is_dir() {
        fs::remove_dir_all(path).map_err(|e| format!("Delete dir error: {}", e))
    } else {
        fs::remove_file(path).map_err(|e| format!("Delete file error: {}", e))
    }
}

#[tauri::command]
pub fn rename_file(old_path: String, new_path: String) -> Result<(), String> {
    if let Some(parent) = Path::new(&new_path).parent() {
        fs::create_dir_all(parent).map_err(|e| format!("Create dir error: {}", e))?;
    }
    fs::rename(&old_path, &new_path).map_err(|e| format!("Rename error: {}", e))
}

#[tauri::command]
pub fn create_directory(dir_path: String) -> Result<(), String> {
    fs::create_dir_all(&dir_path).map_err(|e| format!("Create dir error: {}", e))
}
