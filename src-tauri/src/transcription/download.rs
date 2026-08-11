//! Model download worker: streams the ggml file to `<model>.part`, emits
//! progress events, and atomically renames on success so a half-written
//! file can never be mistaken for a downloaded model.

use serde::Serialize;
use std::fs;
use std::io::{Read, Write};
use std::path::Path;
use tauri::{AppHandle, Emitter, Manager};

use super::models;

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ModelProgress {
    pub model: String,
    pub downloaded: u64,
    pub total: u64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub done: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

const PROGRESS_EVENT: &str = "transcription-model-progress";
/// Emit progress roughly every this many bytes.
const PROGRESS_STRIDE: u64 = 4 * 1024 * 1024;

pub fn spawn_download(app: AppHandle, model: String) {
    std::thread::spawn(move || {
        let result = download(&app, &model);
        let payload = match result {
            Ok(total) => ModelProgress {
                model: model.clone(),
                downloaded: total,
                total,
                done: Some(true),
                error: None,
            },
            Err(e) => ModelProgress {
                model: model.clone(),
                downloaded: 0,
                total: 0,
                done: None,
                error: Some(e),
            },
        };
        let _ = app.emit(PROGRESS_EVENT, payload);
    });
}

fn download(app: &AppHandle, model: &str) -> Result<u64, String> {
    let data_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("no app data dir: {e}"))?;
    let target = models::model_path(&data_dir, model);
    let part = models::model_part_path(&data_dir, model);
    if let Some(parent) = target.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }

    let url = models::model_url(model);
    let resp = ureq::get(&url).call().map_err(|e| format!("download failed: {e}"))?;
    let total: u64 = resp
        .header("Content-Length")
        .and_then(|v| v.parse().ok())
        .unwrap_or(0);

    let mut reader = resp.into_reader();
    let result = stream_to_part(&mut reader, &part, total, |downloaded| {
        let _ = app.emit(
            PROGRESS_EVENT,
            ModelProgress {
                model: model.to_string(),
                downloaded,
                total,
                done: None,
                error: None,
            },
        );
    });

    match result {
        Ok(written) => {
            if total > 0 && written != total {
                let _ = fs::remove_file(&part);
                return Err(format!("incomplete download: {written} of {total} bytes"));
            }
            fs::rename(&part, &target).map_err(|e| {
                let _ = fs::remove_file(&part);
                format!("rename failed: {e}")
            })?;
            Ok(written)
        }
        Err(e) => {
            let _ = fs::remove_file(&part);
            Err(e)
        }
    }
}

/// Stream `reader` to `part_path`, calling `on_progress` periodically.
/// Factored out so the file handling is testable without a network.
pub fn stream_to_part(
    reader: &mut dyn Read,
    part_path: &Path,
    _total: u64,
    mut on_progress: impl FnMut(u64),
) -> Result<u64, String> {
    let mut file = fs::File::create(part_path).map_err(|e| e.to_string())?;
    let mut buf = [0u8; 64 * 1024];
    let mut written: u64 = 0;
    let mut last_emit: u64 = 0;
    loop {
        let n = reader.read(&mut buf).map_err(|e| e.to_string())?;
        if n == 0 {
            break;
        }
        file.write_all(&buf[..n]).map_err(|e| e.to_string())?;
        written += n as u64;
        if written - last_emit >= PROGRESS_STRIDE {
            last_emit = written;
            on_progress(written);
        }
    }
    file.flush().map_err(|e| e.to_string())?;
    Ok(written)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Cursor;

    #[test]
    fn streams_all_bytes_and_reports_progress() {
        let data = vec![7u8; 9 * 1024 * 1024]; // > 2 progress strides
        let dir = std::env::temp_dir().join("doc-md-test-download");
        fs::create_dir_all(&dir).unwrap();
        let part = dir.join("m.bin.part");

        let mut progress = Vec::new();
        let written =
            stream_to_part(&mut Cursor::new(&data), &part, data.len() as u64, |d| {
                progress.push(d)
            })
            .unwrap();

        assert_eq!(written, data.len() as u64);
        assert_eq!(fs::metadata(&part).unwrap().len(), data.len() as u64);
        assert!(!progress.is_empty());
        assert!(progress.windows(2).all(|w| w[0] < w[1]));
        let _ = fs::remove_file(&part);
    }
}
