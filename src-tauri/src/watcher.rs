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
                    .collect();

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

/// Stop watching the current vault directory.
#[tauri::command]
pub async fn stop_watching(state: tauri::State<'_, WatcherState>) -> Result<(), String> {
    let mut watcher_lock = state.watcher.lock().await;
    *watcher_lock = None;
    Ok(())
}
