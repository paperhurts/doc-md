//! Audio capture threads (cpal).
//!
//! Mic = default input device. System audio = WASAPI loopback: building an
//! *input* stream on the default *output* device (with the output config —
//! input-config calls fail on render devices) transparently captures what
//! the machine is playing. Each callback downmixes + resamples to 16 kHz
//! mono and sends the samples over an mpsc channel to the engine thread.
//!
//! Streams die when the default device changes; the capture thread rebuilds
//! with a 1 s backoff and gives up (with a status event) after 5 straight
//! failures.

use cpal::traits::{DeviceTrait, HostTrait, StreamTrait};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::mpsc::Sender;
use std::sync::Arc;
use std::time::Duration;

use super::chunker::to_mono_16k;

#[derive(Clone, Copy, PartialEq)]
pub enum Source {
    Mic,
    System,
}

impl Source {
    pub fn name(&self) -> &'static str {
        match self {
            Source::Mic => "mic",
            Source::System => "system",
        }
    }
}

/// Run the capture loop until `stop` is set. Returns an error message when
/// capture had to give up early (caller emits the status event).
pub fn capture_loop(
    source: Source,
    stop: Arc<AtomicBool>,
    tx: Sender<Vec<f32>>,
) -> Result<(), String> {
    let mut consecutive_failures = 0u32;
    while !stop.load(Ordering::SeqCst) {
        let failed = Arc::new(AtomicBool::new(false));
        match build_stream(source, tx.clone(), failed.clone()) {
            Ok(stream) => {
                stream.play().map_err(|e| e.to_string())?;
                consecutive_failures = 0;
                while !stop.load(Ordering::SeqCst) && !failed.load(Ordering::SeqCst) {
                    std::thread::sleep(Duration::from_millis(200));
                }
                drop(stream);
                if stop.load(Ordering::SeqCst) {
                    return Ok(());
                }
                // Device error (e.g. default output switched) — rebuild
                std::thread::sleep(Duration::from_secs(1));
            }
            Err(e) => {
                consecutive_failures += 1;
                if consecutive_failures >= 5 {
                    return Err(match source {
                        Source::Mic => format!(
                            "Microphone capture failed: {e}. On Windows, check \
                             Settings > Privacy > Microphone allows desktop apps."
                        ),
                        Source::System => format!(
                            "System-audio capture failed: {e}. Loopback capture \
                             requires Windows (WASAPI)."
                        ),
                    });
                }
                std::thread::sleep(Duration::from_secs(1));
            }
        }
    }
    Ok(())
}

fn build_stream(
    source: Source,
    tx: Sender<Vec<f32>>,
    failed: Arc<AtomicBool>,
) -> Result<cpal::Stream, String> {
    let host = cpal::default_host();
    // WASAPI loopback: an input stream on an output device captures playback.
    let (device, config) = match source {
        Source::Mic => {
            let d = host.default_input_device().ok_or("no input device")?;
            let c = d.default_input_config().map_err(|e| e.to_string())?;
            (d, c)
        }
        Source::System => {
            let d = host.default_output_device().ok_or("no output device")?;
            // NOT default_input_config — render devices reject it
            let c = d.default_output_config().map_err(|e| e.to_string())?;
            (d, c)
        }
    };

    let channels = config.channels() as usize;
    let rate = config.sample_rate() as usize;
    let err_fn = move |e: cpal::Error| {
        eprintln!("[transcription] stream error ({e})");
        failed.store(true, Ordering::SeqCst);
    };

    let stream = match config.sample_format() {
        cpal::SampleFormat::F32 => device.build_input_stream(
            config.into(),
            move |data: &[f32], _| {
                let _ = tx.send(to_mono_16k(data, channels, rate));
            },
            err_fn,
            None,
        ),
        cpal::SampleFormat::I16 => device.build_input_stream(
            config.into(),
            move |data: &[i16], _| {
                let f: Vec<f32> = data.iter().map(|s| *s as f32 / 32768.0).collect();
                let _ = tx.send(to_mono_16k(&f, channels, rate));
            },
            err_fn,
            None,
        ),
        cpal::SampleFormat::U16 => device.build_input_stream(
            config.into(),
            move |data: &[u16], _| {
                let f: Vec<f32> = data.iter().map(|s| (*s as f32 - 32768.0) / 32768.0).collect();
                let _ = tx.send(to_mono_16k(&f, channels, rate));
            },
            err_fn,
            None,
        ),
        other => return Err(format!("unsupported sample format: {other}")),
    }
    .map_err(|e| e.to_string())?;

    Ok(stream)
}
