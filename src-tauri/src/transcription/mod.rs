//! Transcription notes: capture mic and/or system audio, transcribe locally
//! with Whisper, stream lines to the frontend as events.
//!
//! Event contract (see docs/TECHNICAL_CONTEXT.md and
//! src/lib/services/transcription.ts):
//!   transcription-line           {source, text, tMs, kind}
//!   transcription-status         {state, message?}
//!   transcription-model-progress {model, downloaded, total, done?, error?}
//!
//! One capture thread + one engine thread per source; two sources give
//! speaker attribution ([me] vs [audio]) for free. Everything is gated on
//! `all(desktop, feature = "transcription")`; other builds get stub
//! commands that return an error the UI shows as its error state.

#[cfg(all(desktop, feature = "transcription"))]
pub mod audio;
#[cfg(all(desktop, feature = "transcription"))]
pub mod chunker;
#[cfg(all(desktop, feature = "transcription"))]
pub mod download;
#[cfg(all(desktop, feature = "transcription"))]
pub mod models;

#[cfg(all(desktop, feature = "transcription"))]
mod real {
    use super::{audio, chunker, download, models};

    use serde::Serialize;
    use std::sync::atomic::{AtomicBool, Ordering};
    use std::sync::mpsc;
    use std::sync::{Arc, Mutex};
    use std::time::{Duration, Instant};
    use tauri::{AppHandle, Emitter, Manager};
    use whisper_rs::{FullParams, SamplingStrategy, WhisperContext, WhisperContextParameters};

    use audio::Source;
    use chunker::{Chunk, ChunkKind, Chunker, SAMPLE_RATE};

    const LINE_EVENT: &str = "transcription-line";
    const STATUS_EVENT: &str = "transcription-status";
    /// Minimum interval between partial transcriptions per source.
    const PARTIAL_INTERVAL: Duration = Duration::from_millis(2500);

    #[derive(Clone, Serialize)]
    #[serde(rename_all = "camelCase")]
    struct LineEvent {
        source: &'static str,
        text: String,
        t_ms: u64,
        kind: &'static str,
    }

    #[derive(Clone, Serialize)]
    #[serde(rename_all = "camelCase")]
    struct StatusEvent {
        state: &'static str,
        #[serde(skip_serializing_if = "Option::is_none")]
        message: Option<String>,
    }

    #[derive(Clone, Serialize)]
    #[serde(rename_all = "camelCase")]
    pub struct ModelInfo {
        id: String,
        label: String,
        size_mb: u32,
        downloaded: bool,
    }

    // ---- whisper engine -------------------------------------------------

    struct Engine {
        ctx: WhisperContext,
    }

    impl Engine {
        fn load(model_path: &std::path::Path) -> Result<Self, String> {
            let ctx = WhisperContext::new_with_params(
                model_path.to_str().ok_or("bad model path")?,
                WhisperContextParameters::default(),
            )
            .map_err(|e| format!("failed to load model: {e}"))?;
            Ok(Self { ctx })
        }

        fn transcribe(&self, samples: &[f32]) -> Result<String, String> {
            let mut state = self.ctx.create_state().map_err(|e| e.to_string())?;
            let mut params = FullParams::new(SamplingStrategy::Greedy { best_of: 1 });
            let threads = std::thread::available_parallelism()
                .map(|n| (n.get() as i32 / 2).clamp(2, 6))
                .unwrap_or(4);
            params.set_n_threads(threads);
            params.set_language(Some("en"));
            params.set_print_special(false);
            params.set_print_progress(false);
            params.set_print_realtime(false);
            params.set_print_timestamps(false);
            params.set_suppress_blank(true);
            params.set_no_context(true);

            state.full(params, samples).map_err(|e| e.to_string())?;

            let mut text = String::new();
            for seg in state.as_iter() {
                if let Ok(s) = seg.to_str_lossy() {
                    text.push_str(&s);
                }
            }
            Ok(text.trim().to_string())
        }
    }

    /// Whisper emits bracketed/parenthesized non-speech markers like
    /// [BLANK_AUDIO], [MUSIC], (wind blowing). Drop lines that are only that.
    fn is_noise_only(text: &str) -> bool {
        let stripped: String = text
            .chars()
            .filter(|c| !c.is_whitespace())
            .collect();
        stripped.is_empty()
            || (stripped.starts_with(['[', '(']) && stripped.ends_with([']', ')']))
    }

    // ---- session --------------------------------------------------------

    #[derive(Default)]
    pub struct TranscriptionState {
        session: Mutex<Option<Session>>,
    }

    struct Session {
        stop: Arc<AtomicBool>,
    }

    impl Drop for Session {
        fn drop(&mut self) {
            self.stop.store(true, Ordering::SeqCst);
        }
    }

    fn spawn_source(app: AppHandle, source: Source, engine: Arc<Engine>, stop: Arc<AtomicBool>) {
        let (tx, rx) = mpsc::channel::<Vec<f32>>();

        // Capture thread: owns the cpal stream, rebuilds on device errors
        {
            let stop = stop.clone();
            let app = app.clone();
            std::thread::spawn(move || {
                if let Err(msg) = audio::capture_loop(source, stop, tx) {
                    eprintln!("[transcription] {msg}");
                    let _ = app.emit(
                        STATUS_EVENT,
                        StatusEvent { state: "error", message: Some(msg) },
                    );
                }
                // Dropping tx ends the engine thread's recv loop
            });
        }

        // Engine thread: chunk, transcribe, emit
        std::thread::spawn(move || {
            let mut chunker = Chunker::new();
            let mut last_data = Instant::now();
            let mut last_partial = Instant::now();
            let mut infer_cost = Duration::ZERO;

            let emit_chunk = |chunk: &Chunk, infer_cost: &mut Duration| {
                let started = Instant::now();
                match engine.transcribe(&chunk.samples) {
                    Ok(text) => {
                        *infer_cost = started.elapsed();
                        if !is_noise_only(&text) {
                            let _ = app.emit(
                                LINE_EVENT,
                                LineEvent {
                                    source: source.name(),
                                    text,
                                    t_ms: chunk.start_ms,
                                    kind: match chunk.kind {
                                        ChunkKind::Partial => "partial",
                                        ChunkKind::Final => "final",
                                    },
                                },
                            );
                        }
                    }
                    Err(e) => eprintln!("[transcription] inference failed: {e}"),
                }
            };

            loop {
                match rx.recv_timeout(Duration::from_millis(250)) {
                    Ok(samples) => {
                        // WASAPI loopback emits nothing during silence;
                        // synthesize the gap so pause-flush and timestamps
                        // track wall-clock time.
                        if source == Source::System {
                            let gap = last_data.elapsed();
                            if gap > Duration::from_millis(400) {
                                let n = gap.as_millis() as usize * SAMPLE_RATE / 1000;
                                if let Some(chunk) = chunker.push(&vec![0.0; n]) {
                                    emit_chunk(&chunk, &mut infer_cost);
                                }
                            }
                        }
                        last_data = Instant::now();

                        if let Some(chunk) = chunker.push(&samples) {
                            emit_chunk(&chunk, &mut infer_cost);
                            last_partial = Instant::now();
                        } else if last_partial.elapsed() > PARTIAL_INTERVAL.max(infer_cost * 3) {
                            if let Some(chunk) = chunker.partial() {
                                emit_chunk(&chunk, &mut infer_cost);
                                last_partial = Instant::now();
                            }
                        }
                    }
                    Err(mpsc::RecvTimeoutError::Timeout) => {
                        if stop.load(Ordering::SeqCst) {
                            break;
                        }
                        if source == Source::System && last_data.elapsed() > Duration::from_millis(400)
                        {
                            let n = 250 * SAMPLE_RATE / 1000;
                            if let Some(chunk) = chunker.push(&vec![0.0; n]) {
                                emit_chunk(&chunk, &mut infer_cost);
                            }
                        }
                    }
                    Err(mpsc::RecvTimeoutError::Disconnected) => break,
                }
            }

            // Session over: flush whatever speech remains
            if let Some(chunk) = chunker.drain() {
                emit_chunk(&chunk, &mut infer_cost);
            }
        });
    }

    // ---- commands -------------------------------------------------------

    #[tauri::command]
    pub fn get_transcription_models(app: AppHandle) -> Result<Vec<ModelInfo>, String> {
        let data_dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
        Ok(models::MODELS
            .iter()
            .map(|(id, label, size_mb)| ModelInfo {
                id: (*id).into(),
                label: (*label).into(),
                size_mb: *size_mb,
                downloaded: models::is_downloaded(&data_dir, id),
            })
            .collect())
    }

    #[tauri::command]
    pub fn download_transcription_model(app: AppHandle, model: String) -> Result<(), String> {
        if !models::is_known_model(&model) {
            return Err(format!("Unknown model: {model}"));
        }
        download::spawn_download(app, model);
        Ok(())
    }

    #[tauri::command]
    pub fn start_transcription(
        app: AppHandle,
        state: tauri::State<'_, TranscriptionState>,
        mic: bool,
        system: bool,
        model: String,
    ) -> Result<(), String> {
        if !mic && !system {
            return Err("No audio source enabled".into());
        }
        if !models::is_known_model(&model) {
            return Err(format!("Unknown model: {model}"));
        }
        let data_dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
        let model_path = models::model_path(&data_dir, &model);
        if !model_path.is_file() {
            return Err(format!("Model {model} is not downloaded"));
        }

        let mut session = state.session.lock().unwrap();
        if session.is_some() {
            return Err("A transcription session is already running".into());
        }

        let engine = Arc::new(Engine::load(&model_path)?);
        let stop = Arc::new(AtomicBool::new(false));
        if mic {
            spawn_source(app.clone(), Source::Mic, engine.clone(), stop.clone());
        }
        if system {
            spawn_source(app.clone(), Source::System, engine, stop.clone());
        }
        *session = Some(Session { stop });
        let _ = app.emit(STATUS_EVENT, StatusEvent { state: "listening", message: None });
        Ok(())
    }

    #[tauri::command]
    pub fn stop_transcription(
        app: AppHandle,
        state: tauri::State<'_, TranscriptionState>,
    ) -> Result<(), String> {
        // Dropping the session sets the stop flag; threads wind down and the
        // engine thread flushes a last final chunk.
        *state.session.lock().unwrap() = None;
        let _ = app.emit(STATUS_EVENT, StatusEvent { state: "stopped", message: None });
        Ok(())
    }
}

#[cfg(all(desktop, feature = "transcription"))]
pub use real::*;

// Stub commands for mobile or --no-default-features builds: the UI surfaces
// this error as its error state.
#[cfg(not(all(desktop, feature = "transcription")))]
mod stubs {
    const UNSUPPORTED: &str = "Transcription is not available in this build";

    #[tauri::command]
    pub fn get_transcription_models() -> Result<Vec<String>, String> {
        Err(UNSUPPORTED.into())
    }

    #[tauri::command]
    pub fn download_transcription_model(_model: String) -> Result<(), String> {
        Err(UNSUPPORTED.into())
    }

    #[tauri::command]
    pub fn start_transcription(_mic: bool, _system: bool, _model: String) -> Result<(), String> {
        Err(UNSUPPORTED.into())
    }

    #[tauri::command]
    pub fn stop_transcription() -> Result<(), String> {
        Err(UNSUPPORTED.into())
    }
}

#[cfg(not(all(desktop, feature = "transcription")))]
pub use stubs::*;
