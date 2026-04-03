mod commands;
mod sidecar;
mod watcher;

use commands::{
    create_directory, delete_file, get_current_vault, list_files, read_file, rename_file,
    set_current_vault, sidecar_ping, sidecar_request, write_file,
};
use commands::vault::VaultState;
use tauri::{Emitter, Manager};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            let handle = app.handle().clone();

            // Initialize vault state (loads last-used vault from config)
            let vault_state = VaultState::new(&handle);
            app.manage(vault_state);

            tauri::async_runtime::spawn(async move {
                if let Err(e) = sidecar::start_sidecar(&handle).await {
                    eprintln!("Failed to start sidecar: {}", e);
                    // Surface error to the frontend so the UI can inform the user
                    let _ = handle.emit("sidecar-error", e.to_string());
                }
            });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            sidecar_ping,
            sidecar_request,
            list_files,
            read_file,
            write_file,
            delete_file,
            rename_file,
            create_directory,
            get_current_vault,
            set_current_vault,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
