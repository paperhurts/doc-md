//! OneNote-style screenshot capture.
//!
//! Flow: global hotkey (or palette command) -> hide main window if visible ->
//! grab the monitor under the cursor (xcap, GDI path) -> show a frameless
//! overlay window (`index.html?capture=1`) painted with the frozen frame ->
//! the overlay sends back a crop rect in physical pixels -> Rust crops and
//! returns PNG base64; the frontend saves it into the vault and routes the
//! markdown link (active note or daily note).
//!
//! The overlay converts CSS px -> physical px (devicePixelRatio); Rust only
//! clamps. Mobile builds compile stub commands that return an error.

#[cfg(desktop)]
mod desktop {
    use base64::engine::general_purpose::STANDARD as B64;
    use base64::Engine;
    use image::RgbaImage;
    use std::io::Cursor;
    use std::sync::atomic::{AtomicBool, Ordering};
    use std::sync::Mutex;
    use std::time::Duration;
    use tauri::{
        AppHandle, Manager, PhysicalPosition, PhysicalSize, WebviewUrl, WebviewWindowBuilder,
    };
    use tauri_plugin_global_shortcut::{GlobalShortcutExt, Shortcut, ShortcutState};

    pub const DEFAULT_SHORTCUT: &str = "Ctrl+Shift+S";
    const OVERLAY_LABEL: &str = "capture";

    #[derive(Default)]
    pub struct CaptureState {
        /// Frozen full-monitor frame while the overlay is up.
        frame: Mutex<Option<RgbaImage>>,
        /// We hid the main window for this capture and owe it a restore.
        restore_main: AtomicBool,
        /// Startup hotkey registration error, surfaced in Settings.
        shortcut_error: Mutex<Option<String>>,
    }

    /// Register `shortcut_str` as the capture hotkey. Fails if another app
    /// owns the combo — callers surface the error, never abort startup.
    pub fn register_capture_shortcut(app: &AppHandle, shortcut_str: &str) -> Result<(), String> {
        let shortcut: Shortcut = shortcut_str
            .parse()
            .map_err(|e| format!("invalid shortcut \"{shortcut_str}\": {e}"))?;
        app.global_shortcut()
            .on_shortcut(shortcut, |app, _shortcut, event| {
                // Handlers fire on press AND release
                if event.state() == ShortcutState::Pressed {
                    start_capture(app);
                }
            })
            .map_err(|e| e.to_string())
    }

    /// Called from setup(): register the default hotkey, stash any error for
    /// the Settings panel instead of failing startup.
    pub fn init(app: &AppHandle) {
        app.manage(CaptureState::default());
        if let Err(e) = register_capture_shortcut(app, DEFAULT_SHORTCUT) {
            eprintln!("[screenshot] hotkey registration failed: {e}");
            let state = app.state::<CaptureState>();
            *state.shortcut_error.lock().unwrap() = Some(e);
        }
    }

    /// Entry point for hotkey and palette. Non-blocking: the capture flow
    /// (window hide + DWM settle sleep + grab) runs on its own thread.
    pub fn start_capture(app: &AppHandle) {
        if let Some(overlay) = app.get_webview_window(OVERLAY_LABEL) {
            let _ = overlay.set_focus();
            return;
        }
        let app = app.clone();
        std::thread::spawn(move || {
            if let Err(e) = capture_flow(&app) {
                eprintln!("[screenshot] capture failed: {e}");
                restore_main_if_needed(&app);
            }
        });
    }

    fn capture_flow(app: &AppHandle) -> Result<(), String> {
        // Monitor under the cursor (single-monitor capture in v1)
        let (cx, cy) = match app.cursor_position() {
            Ok(pos) => (pos.x as i32, pos.y as i32),
            Err(_) => (0, 0), // falls back to the primary monitor
        };
        let monitor = xcap::Monitor::from_point(cx, cy).map_err(|e| e.to_string())?;

        let state = app.state::<CaptureState>();
        if let Some(main) = app.get_webview_window("main") {
            if main.is_visible().unwrap_or(false) {
                let _ = main.hide();
                state.restore_main.store(true, Ordering::SeqCst);
                // Give DWM time to compose the frame without our window
                std::thread::sleep(Duration::from_millis(150));
            }
        }

        let frame = monitor.capture_image().map_err(|e| e.to_string())?;
        let (mx, my) = (
            monitor.x().map_err(|e| e.to_string())?,
            monitor.y().map_err(|e| e.to_string())?,
        );
        let (mw, mh) = (frame.width(), frame.height());
        *state.frame.lock().unwrap() = Some(frame);

        let overlay = WebviewWindowBuilder::new(
            app,
            OVERLAY_LABEL,
            WebviewUrl::App("index.html?capture=1".into()),
        )
        .title("Capture")
        .decorations(false)
        .always_on_top(true)
        .skip_taskbar(true)
        .resizable(false)
        .visible(false)
        .build()
        .map_err(|e| e.to_string())?;

        // Builder units are logical; set the monitor rect in physical units
        // after creation so no DPI math is needed here. The overlay stays
        // hidden until the frontend has painted the frozen frame and calls
        // show_capture_overlay — otherwise the user sees a black fullscreen
        // window while the frame PNG crosses IPC.
        overlay
            .set_position(PhysicalPosition::new(mx, my))
            .and_then(|_| overlay.set_size(PhysicalSize::new(mw, mh)))
            .map_err(|e| e.to_string())?;

        // Watchdog: if the frontend never manages to show the overlay (JS
        // error, dead dev server), don't leave the main window hidden with an
        // invisible always-on-top window holding the frame.
        let app = app.clone();
        std::thread::spawn(move || {
            std::thread::sleep(Duration::from_secs(15));
            if let Some(overlay) = app.get_webview_window(OVERLAY_LABEL) {
                if !overlay.is_visible().unwrap_or(true) {
                    eprintln!("[screenshot] overlay never shown; cancelling capture");
                    let _ = overlay.destroy(); // Destroyed handler restores main
                }
            }
        });
        Ok(())
    }

    fn restore_main_if_needed(app: &AppHandle) {
        let state = app.state::<CaptureState>();
        if state.restore_main.swap(false, Ordering::SeqCst) {
            if let Some(main) = app.get_webview_window("main") {
                let _ = main.show();
                let _ = main.unminimize();
                let _ = main.set_focus();
            }
        }
    }

    fn destroy_overlay(app: &AppHandle) {
        if let Some(overlay) = app.get_webview_window(OVERLAY_LABEL) {
            let _ = overlay.destroy();
        }
    }

    /// Safety net for any way the overlay dies (Escape, Alt+F4, finish):
    /// drop the frame and restore the main window exactly once.
    pub fn on_overlay_destroyed(app: &AppHandle) {
        let state = app.state::<CaptureState>();
        *state.frame.lock().unwrap() = None;
        restore_main_if_needed(app);
    }

    /// Clamp a crop rect to the frame; None when nothing remains.
    fn clamp_rect(fw: u32, fh: u32, x: u32, y: u32, w: u32, h: u32) -> Option<(u32, u32, u32, u32)> {
        if x >= fw || y >= fh {
            return None;
        }
        let w = w.min(fw - x);
        let h = h.min(fh - y);
        if w == 0 || h == 0 {
            None
        } else {
            Some((x, y, w, h))
        }
    }

    fn encode_png_base64(img: &RgbaImage) -> Result<String, String> {
        let mut buf = Vec::new();
        img.write_to(&mut Cursor::new(&mut buf), image::ImageFormat::Png)
            .map_err(|e| e.to_string())?;
        Ok(B64.encode(buf))
    }

    // ---- commands -------------------------------------------------------

    /// Frozen frame for the overlay to paint (PNG base64).
    #[tauri::command]
    pub fn get_capture_frame(state: tauri::State<'_, CaptureState>) -> Result<String, String> {
        let guard = state.frame.lock().unwrap();
        let frame = guard.as_ref().ok_or("No capture in progress")?;
        encode_png_base64(frame)
    }

    /// Crop the frozen frame to `x,y,w,h` (physical px) and return PNG
    /// base64. Restores the main window immediately so it is visible before
    /// the overlay emits `screenshot-captured` (the listener routes on
    /// visibility). The overlay destroys itself after saving.
    #[tauri::command]
    pub fn finish_capture(
        app: AppHandle,
        state: tauri::State<'_, CaptureState>,
        x: u32,
        y: u32,
        w: u32,
        h: u32,
    ) -> Result<String, String> {
        let frame = state
            .frame
            .lock()
            .unwrap()
            .take()
            .ok_or("No capture in progress")?;
        if let Some(overlay) = app.get_webview_window(OVERLAY_LABEL) {
            let _ = overlay.hide();
        }
        restore_main_if_needed(&app);
        let (x, y, w, h) =
            clamp_rect(frame.width(), frame.height(), x, y, w, h).ok_or("Empty selection")?;
        let cropped = image::imageops::crop_imm(&frame, x, y, w, h).to_image();
        encode_png_base64(&cropped)
    }

    /// Called by the overlay once the frozen frame has painted: reveal the
    /// (until now hidden) overlay window.
    #[tauri::command]
    pub fn show_capture_overlay(app: AppHandle) {
        if let Some(overlay) = app.get_webview_window(OVERLAY_LABEL) {
            let _ = overlay.show();
            let _ = overlay.set_focus();
        }
    }

    #[tauri::command]
    pub fn cancel_capture(app: AppHandle, state: tauri::State<'_, CaptureState>) {
        *state.frame.lock().unwrap() = None;
        destroy_overlay(&app); // Destroyed handler restores the main window
        restore_main_if_needed(&app); // …but don't rely on it if no overlay ever opened
    }

    #[tauri::command]
    pub fn trigger_capture(app: AppHandle) {
        start_capture(&app);
    }

    /// Rebind the capture hotkey. On failure the previous binding is
    /// restored and the error returned for the Settings panel.
    #[tauri::command]
    pub fn set_capture_shortcut(
        app: AppHandle,
        state: tauri::State<'_, CaptureState>,
        shortcut: String,
        previous: String,
    ) -> Result<(), String> {
        if let Ok(prev) = previous.parse::<Shortcut>() {
            let _ = app.global_shortcut().unregister(prev);
        }
        match register_capture_shortcut(&app, &shortcut) {
            Ok(()) => {
                *state.shortcut_error.lock().unwrap() = None;
                Ok(())
            }
            Err(e) => {
                let _ = register_capture_shortcut(&app, &previous);
                Err(e)
            }
        }
    }

    /// Startup registration error, if any (Settings panel surfaces it).
    #[tauri::command]
    pub fn get_capture_shortcut_error(
        state: tauri::State<'_, CaptureState>,
    ) -> Option<String> {
        state.shortcut_error.lock().unwrap().clone()
    }

    #[cfg(test)]
    mod tests {
        use super::*;

        #[test]
        fn clamp_rect_inside() {
            assert_eq!(clamp_rect(100, 50, 10, 5, 20, 10), Some((10, 5, 20, 10)));
        }

        #[test]
        fn clamp_rect_overflow_is_trimmed() {
            assert_eq!(clamp_rect(100, 50, 90, 45, 20, 10), Some((90, 45, 10, 5)));
        }

        #[test]
        fn clamp_rect_origin_outside_frame() {
            assert_eq!(clamp_rect(100, 50, 100, 0, 5, 5), None);
            assert_eq!(clamp_rect(100, 50, 0, 50, 5, 5), None);
        }

        #[test]
        fn clamp_rect_zero_size() {
            assert_eq!(clamp_rect(100, 50, 10, 10, 0, 5), None);
            assert_eq!(clamp_rect(100, 50, 10, 10, 5, 0), None);
        }

        #[test]
        fn crop_and_png_roundtrip() {
            // 4x4 frame: red except one blue pixel at (2,1)
            let mut frame = RgbaImage::from_pixel(4, 4, image::Rgba([255, 0, 0, 255]));
            frame.put_pixel(2, 1, image::Rgba([0, 0, 255, 255]));

            let (x, y, w, h) = clamp_rect(4, 4, 1, 1, 2, 2).unwrap();
            let cropped = image::imageops::crop_imm(&frame, x, y, w, h).to_image();
            let b64 = encode_png_base64(&cropped).unwrap();

            let bytes = B64.decode(b64).unwrap();
            let decoded = image::load_from_memory(&bytes).unwrap().to_rgba8();
            assert_eq!(decoded.dimensions(), (2, 2));
            // (2,1) in the frame is (1,0) in the crop
            assert_eq!(decoded.get_pixel(1, 0), &image::Rgba([0, 0, 255, 255]));
            assert_eq!(decoded.get_pixel(0, 0), &image::Rgba([255, 0, 0, 255]));
        }
    }
}

#[cfg(desktop)]
pub use desktop::*;

// Mobile builds: same command surface, always errors. Keeps
// generate_handler! unconditional.
#[cfg(not(desktop))]
mod mobile {
    const UNSUPPORTED: &str = "Screenshot capture is not available on this platform";

    #[tauri::command]
    pub fn get_capture_frame() -> Result<String, String> {
        Err(UNSUPPORTED.into())
    }

    #[tauri::command]
    pub fn finish_capture(_x: u32, _y: u32, _w: u32, _h: u32) -> Result<String, String> {
        Err(UNSUPPORTED.into())
    }

    #[tauri::command]
    pub fn show_capture_overlay() {}

    #[tauri::command]
    pub fn cancel_capture() {}

    #[tauri::command]
    pub fn trigger_capture() {}

    #[tauri::command]
    pub fn set_capture_shortcut(_shortcut: String, _previous: String) -> Result<(), String> {
        Err(UNSUPPORTED.into())
    }

    #[tauri::command]
    pub fn get_capture_shortcut_error() -> Option<String> {
        None
    }
}

#[cfg(not(desktop))]
pub use mobile::*;
