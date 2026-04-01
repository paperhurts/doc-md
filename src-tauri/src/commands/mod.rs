pub mod files;
pub mod vault;

use crate::sidecar::SidecarState;
use serde_json::Value;
use std::sync::Arc;
use tauri::State;

pub use files::{create_directory, delete_file, list_files, read_file, rename_file, write_file};
pub use vault::{get_current_vault, set_current_vault};

#[tauri::command]
pub async fn sidecar_ping(state: State<'_, Arc<SidecarState>>) -> Result<String, String> {
    let result = state.send_request("ping", Value::Null).await?;
    Ok(result
        .as_str()
        .unwrap_or("unknown response")
        .to_string())
}

#[tauri::command]
pub async fn sidecar_request(
    state: State<'_, Arc<SidecarState>>,
    method: String,
    params: Value,
) -> Result<Value, String> {
    state.send_request(&method, params).await
}
