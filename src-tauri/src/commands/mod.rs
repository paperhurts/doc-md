use crate::sidecar::SidecarState;
use serde_json::Value;
use std::sync::Arc;
use tauri::State;

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
