//! Whisper model catalog: ids, download URLs, on-disk locations.

use std::path::{Path, PathBuf};

/// (id, label, approximate size in MB). Mirrored by the frontend catalog in
/// src/lib/services/transcription.ts.
pub const MODELS: &[(&str, &str, u32)] = &[
    ("tiny.en", "Tiny (fastest)", 75),
    ("base.en", "Base (recommended)", 142),
    ("small.en", "Small (most accurate)", 466),
];

/// Validate a model id against the catalog (also blocks path traversal,
/// since the id is interpolated into a filename).
pub fn is_known_model(id: &str) -> bool {
    MODELS.iter().any(|(m, _, _)| *m == id)
}

pub fn model_url(id: &str) -> String {
    format!("https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-{id}.bin")
}

pub fn model_path(app_data_dir: &Path, id: &str) -> PathBuf {
    app_data_dir.join("models").join(format!("ggml-{id}.bin"))
}

/// In-progress download target; atomically renamed on completion.
pub fn model_part_path(app_data_dir: &Path, id: &str) -> PathBuf {
    app_data_dir.join("models").join(format!("ggml-{id}.bin.part"))
}

pub fn is_downloaded(app_data_dir: &Path, id: &str) -> bool {
    model_path(app_data_dir, id).is_file()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn known_models() {
        assert!(is_known_model("base.en"));
        assert!(is_known_model("tiny.en"));
        assert!(!is_known_model("gpt-5"));
        assert!(!is_known_model("../../../etc/passwd"));
        assert!(!is_known_model(""));
    }

    #[test]
    fn url_and_path_mapping() {
        assert_eq!(
            model_url("base.en"),
            "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.en.bin"
        );
        let dir = Path::new("data");
        let path = model_path(dir, "base.en");
        assert_eq!(path.file_name().unwrap(), "ggml-base.en.bin");
        assert_eq!(path.parent().unwrap().file_name().unwrap(), "models");
        assert!(path.starts_with(dir));
        assert_eq!(
            model_part_path(dir, "base.en").file_name().unwrap(),
            "ggml-base.en.bin.part"
        );
    }
}
