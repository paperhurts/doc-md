mod commands;
mod watcher;

use commands::{
    create_directory, delete_file, get_current_vault, list_files, read_file, rename_file,
    set_current_vault, write_file,
};
use commands::vault::VaultState;
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            let handle = app.handle().clone();

            // Initialize vault state (loads last-used vault from config)
            let vault_state = VaultState::new(&handle);
            app.manage(vault_state);

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
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
