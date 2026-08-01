mod commands;
mod screenshot;
mod transcription;
mod watcher;

use commands::{
    create_directory, delete_file, get_current_vault, list_files, read_file, rename_file,
    set_current_vault, write_binary_file, write_file,
};
use commands::vault::VaultState;
use screenshot::{
    cancel_capture, finish_capture, get_capture_frame, get_capture_shortcut_error,
    set_capture_shortcut, trigger_capture,
};
use transcription::{
    download_transcription_model, get_transcription_models, start_transcription,
    stop_transcription,
};
use watcher::{start_watching, stop_watching, WatcherState};
use tauri::menu::{Menu, MenuItem};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::{AppHandle, Emitter, Manager};

/// Restore the main window from the tray.
fn show_main_window(app: &AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.show();
        let _ = window.unminimize();
        let _ = window.set_focus();
    }
}

fn setup_tray(app: &tauri::App) -> tauri::Result<()> {
    let show = MenuItem::with_id(app, "show", "Show doc-md", true, None::<&str>)?;
    let stickies = MenuItem::with_id(app, "toggle-stickies", "Toggle sticky notes", true, None::<&str>)?;
    let quit = MenuItem::with_id(app, "quit", "Quit doc-md", true, None::<&str>)?;
    let menu = Menu::with_items(app, &[&show, &stickies, &quit])?;

    let mut builder = TrayIconBuilder::with_id("main-tray")
        .tooltip("doc-md")
        .menu(&menu)
        .show_menu_on_left_click(false)
        .on_menu_event(|app, event| match event.id.as_ref() {
            "show" => show_main_window(app),
            "toggle-stickies" => {
                // Frontend owns sticky-note state; it reacts to this event
                let _ = app.emit("toggle-stickies", ());
            }
            "quit" => app.exit(0),
            _ => {}
        })
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                show_main_window(tray.app_handle());
            }
        });

    if let Some(icon) = app.default_window_icon() {
        builder = builder.icon(icon.clone());
    }
    builder.build(app)?;
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            let handle = app.handle().clone();

            // Screenshot capture: global-shortcut plugin + default hotkey
            // (registration failure is stored for Settings, never fatal)
            #[cfg(desktop)]
            {
                handle.plugin(tauri_plugin_global_shortcut::Builder::new().build())?;
                screenshot::init(&handle);
            }

            #[cfg(all(desktop, feature = "transcription"))]
            app.manage(transcription::TranscriptionState::default());

            // Initialize vault state (loads last-used vault from config)
            let vault_state = VaultState::new(&handle);
            // Grant asset-protocol access to the loaded vault (images in preview)
            if let Some(config) = vault_state.current.blocking_lock().as_ref() {
                commands::vault::allow_vault_assets(&handle, &config.path);
            }
            app.manage(vault_state);

            // Initialize watcher state (empty until a vault is opened)
            app.manage(WatcherState::new());

            // System tray: close-to-tray restore, sticky toggle, quit
            setup_tray(app)?;

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            list_files,
            read_file,
            write_file,
            write_binary_file,
            delete_file,
            rename_file,
            create_directory,
            get_current_vault,
            set_current_vault,
            start_watching,
            stop_watching,
            get_capture_frame,
            finish_capture,
            cancel_capture,
            trigger_capture,
            set_capture_shortcut,
            get_capture_shortcut_error,
            get_transcription_models,
            download_transcription_model,
            start_transcription,
            stop_transcription,
        ])
        .on_window_event(|window, event| {
            // However the capture overlay dies (finish, Escape, Alt+F4),
            // drop the frozen frame and restore the main window
            #[cfg(desktop)]
            if window.label() == "capture" {
                if let tauri::WindowEvent::Destroyed = event {
                    screenshot::on_overlay_destroyed(window.app_handle());
                }
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
