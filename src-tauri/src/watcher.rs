use notify::{Event, EventKind, RecommendedWatcher, RecursiveMode, Watcher};
use std::path::Path;
use std::sync::mpsc;
use tauri::{AppHandle, Emitter};
use tokio::sync::Mutex;

/// Managed state for the file system watcher.
/// Holds an Option so the watcher can be started/stopped on vault switch.
pub struct WatcherState {
    watcher: Mutex<Option<RecommendedWatcher>>,
}

impl WatcherState {
    pub fn new() -> Self {
        Self {
            watcher: Mutex::new(None),
        }
    }
}

/// Start watching a vault directory. Stops any existing watcher first.
#[tauri::command]
pub async fn start_watching(
    app: AppHandle,
    vault_path: String,
    state: tauri::State<'_, WatcherState>,
) -> Result<(), String> {
    let mut watcher_lock = state.watcher.lock().await;

    // Drop existing watcher (stops watching)
    *watcher_lock = None;

    let (tx, rx) = mpsc::channel::<notify::Result<Event>>();
    let app_handle = app.clone();

    let mut watcher = RecommendedWatcher::new(tx, notify::Config::default())
        .map_err(|e| format!("Watcher error: {}", e))?;

    watcher
        .watch(Path::new(&vault_path), RecursiveMode::Recursive)
        .map_err(|e| format!("Watch error: {}", e))?;

    // Spawn a thread to forward events to the frontend
    let root = vault_path.clone();
    std::thread::spawn(move || {
        while let Ok(event) = rx.recv() {
            if let Ok(event) = event {
                let kind = match event.kind {
                    EventKind::Create(_) => "create",
                    EventKind::Modify(_) => "modify",
                    EventKind::Remove(_) => "remove",
                    _ => continue,
                };

                let paths: Vec<String> = event
                    .paths
                    .iter()
                    .map(|p| p.to_string_lossy().to_string())
                    .filter(|p| !is_ignored(&root, p))
                    .collect();

                if paths.is_empty() {
                    continue;
                }

                let _ = app_handle.emit(
                    "fs-change",
                    serde_json::json!({
                        "kind": kind,
                        "paths": paths,
                    }),
                );
            }
        }
    });

    *watcher_lock = Some(watcher);
    Ok(())
}

/// True when `path` lies under a directory the vault UI ignores (same rules
/// as list_files: hidden dot-entries, node_modules, target). Only components
/// BELOW the vault root count — a dot in the vault's own ancestors is fine.
/// Without this, opening a code repo as a vault floods the frontend with
/// .git / build events on every save.
fn is_ignored(vault_root: &str, path: &str) -> bool {
    let rel = match path
        .strip_prefix(vault_root)
        .map(|r| r.trim_start_matches(['/', '\\']))
    {
        Some(r) => r,
        None => return false, // outside the vault? let the frontend decide
    };
    rel.split(['/', '\\'])
        .any(|c| c.starts_with('.') || c == "node_modules" || c == "target")
}

/// Stop watching the current vault directory.
#[tauri::command]
pub async fn stop_watching(state: tauri::State<'_, WatcherState>) -> Result<(), String> {
    let mut watcher_lock = state.watcher.lock().await;
    *watcher_lock = None;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::is_ignored;

    const ROOT: &str = "C:\\dev\\repo";

    #[test]
    fn ignores_git_node_modules_target() {
        assert!(is_ignored(ROOT, "C:\\dev\\repo\\.git\\index.lock"));
        assert!(is_ignored(ROOT, "C:\\dev\\repo\\node_modules\\.vite\\deps\\x.js"));
        assert!(is_ignored(ROOT, "C:\\dev\\repo\\src-tauri\\target\\debug\\app.exe"));
        assert!(is_ignored(ROOT, "C:\\dev\\repo\\tasks\\.user-screenshots\\a.png"));
    }

    #[test]
    fn keeps_normal_vault_files() {
        assert!(!is_ignored(ROOT, "C:\\dev\\repo\\tasks\\user.md"));
        assert!(!is_ignored(ROOT, "C:\\dev\\repo\\daily\\2026-08-09.md"));
        assert!(!is_ignored(ROOT, "C:\\dev\\repo\\attachments\\screenshot-1.png"));
    }

    #[test]
    fn dot_in_vault_ancestors_is_not_ignored() {
        // Hidden component ABOVE the root must not blanket-ignore the vault
        assert!(!is_ignored("C:\\Users\\x\\.vaults\\main", "C:\\Users\\x\\.vaults\\main\\note.md"));
        assert!(is_ignored("C:\\Users\\x\\.vaults\\main", "C:\\Users\\x\\.vaults\\main\\.trash\\note.md"));
    }

    #[test]
    fn forward_slash_paths_work() {
        assert!(is_ignored("/home/u/vault", "/home/u/vault/.git/HEAD"));
        assert!(!is_ignored("/home/u/vault", "/home/u/vault/notes/a.md"));
    }

    #[test]
    fn path_outside_vault_is_kept() {
        assert!(!is_ignored(ROOT, "D:\\elsewhere\\node_modules\\x.js"));
    }
}
