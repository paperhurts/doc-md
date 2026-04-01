use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Arc;
use tauri::{AppHandle, Manager};
use tauri_plugin_shell::process::CommandChild;
use tauri_plugin_shell::ShellExt;
use tokio::sync::{oneshot, Mutex};

static REQUEST_ID: AtomicU64 = AtomicU64::new(1);

#[derive(Debug, Serialize)]
struct JsonRpcRequest {
    jsonrpc: &'static str,
    id: u64,
    method: String,
    params: Value,
}

#[derive(Debug, Deserialize)]
struct JsonRpcResponse {
    #[allow(dead_code)]
    jsonrpc: String,
    id: u64,
    result: Option<Value>,
    error: Option<JsonRpcError>,
}

#[derive(Debug, Deserialize)]
struct JsonRpcError {
    code: i64,
    message: String,
}

pub struct SidecarState {
    child: Mutex<Option<CommandChild>>,
    pending: Mutex<std::collections::HashMap<u64, oneshot::Sender<Result<Value, String>>>>,
}

impl SidecarState {
    pub fn new() -> Self {
        Self {
            child: Mutex::new(None),
            pending: Mutex::new(std::collections::HashMap::new()),
        }
    }

    pub async fn send_request(
        &self,
        method: &str,
        params: Value,
    ) -> Result<Value, String> {
        let id = REQUEST_ID.fetch_add(1, Ordering::Relaxed);
        let request = JsonRpcRequest {
            jsonrpc: "2.0",
            id,
            method: method.to_string(),
            params,
        };

        let mut request_line =
            serde_json::to_string(&request).map_err(|e| format!("Serialize error: {}", e))?;
        request_line.push('\n');

        let (tx, rx) = oneshot::channel();

        // Write to the sidecar first, only register the pending sender on success.
        // This avoids leaking the sender in the pending map if the write fails.
        {
            let mut child_lock = self.child.lock().await;
            if let Some(ref mut child) = *child_lock {
                child
                    .write(request_line.as_bytes())
                    .map_err(|e| format!("Write error: {}", e))?;
            } else {
                return Err("Sidecar not running".to_string());
            }
        }

        {
            let mut pending = self.pending.lock().await;
            pending.insert(id, tx);
        }

        rx.await.map_err(|_| "Response channel closed".to_string())?
    }

    pub async fn handle_response(&self, line: &str) {
        if let Ok(resp) = serde_json::from_str::<JsonRpcResponse>(line) {
            let mut pending = self.pending.lock().await;
            if let Some(tx) = pending.remove(&resp.id) {
                let result = if let Some(error) = resp.error {
                    Err(format!("RPC Error {}: {}", error.code, error.message))
                } else {
                    Ok(resp.result.unwrap_or(Value::Null))
                };
                let _ = tx.send(result);
            }
        }
    }
}

pub async fn start_sidecar(app: &AppHandle) -> Result<(), String> {
    let shell = app.shell();
    let command = shell
        .sidecar("doc-md-sidecar")
        .map_err(|e| format!("Failed to create sidecar command: {}", e))?;

    let state = Arc::new(SidecarState::new());
    let state_clone = state.clone();

    let (mut rx, child) = command
        .spawn()
        .map_err(|e| format!("Failed to spawn sidecar: {}", e))?;

    {
        let mut child_lock = state.child.lock().await;
        *child_lock = Some(child);
    }

    // Listen for responses from the sidecar
    tauri::async_runtime::spawn(async move {
        use tauri_plugin_shell::process::CommandEvent;
        while let Some(event) = rx.recv().await {
            match event {
                CommandEvent::Stdout(line) => {
                    let line_str = String::from_utf8_lossy(&line);
                    for l in line_str.lines() {
                        state_clone.handle_response(l).await;
                    }
                }
                CommandEvent::Stderr(line) => {
                    let line_str = String::from_utf8_lossy(&line);
                    eprintln!("[sidecar stderr] {}", line_str);
                }
                CommandEvent::Terminated(status) => {
                    eprintln!("[sidecar] terminated with status: {:?}", status);
                    break;
                }
                _ => {}
            }
        }
    });

    // Store state in app
    app.manage(state);

    println!("Sidecar started successfully");
    Ok(())
}
