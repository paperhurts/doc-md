use notify::{Event, EventKind, RecommendedWatcher, RecursiveMode, Watcher};
use std::path::Path;
use std::sync::mpsc;
use tauri::{AppHandle, Emitter};

pub fn start_watcher(app: &AppHandle, vault_path: &str) -> Result<RecommendedWatcher, String> {
    let (tx, rx) = mpsc::channel::<notify::Result<Event>>();
    let app_handle = app.clone();

    let mut watcher =
        RecommendedWatcher::new(tx, notify::Config::default())
            .map_err(|e| format!("Watcher error: {}", e))?;

    watcher
        .watch(Path::new(vault_path), RecursiveMode::Recursive)
        .map_err(|e| format!("Watch error: {}", e))?;

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

    Ok(watcher)
}
