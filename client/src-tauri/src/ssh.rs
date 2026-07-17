use std::collections::HashMap;
use std::sync::Mutex;
use serde::{Deserialize, Serialize};
use tauri::State;

#[derive(Debug, Serialize, Deserialize)]
pub struct SSHConfig {
    pub host: String,
    pub port: u16,
    pub username: String,
    pub password: Option<String>,
    pub private_key: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SSHSession {
    pub id: String,
    pub host: String,
    pub port: u16,
    pub connected: bool,
}

pub struct SSHState {
    sessions: Mutex<HashMap<String, SSHSession>>,
}

impl Default for SSHState {
    fn default() -> Self {
        Self {
            sessions: Mutex::new(HashMap::new()),
        }
    }
}

#[tauri::command]
pub async fn connect(
    config: SSHConfig,
    state: State<'_, SSHState>,
) -> Result<SSHSession, String> {
    let session_id = uuid::Uuid::new_v4().to_string();

    // TODO: Implement actual SSH connection using ssh2 crate
    // For now, return a mock session
    let session = SSHSession {
        id: session_id.clone(),
        host: config.host.clone(),
        port: config.port,
        connected: true,
    };

    state.sessions.lock().unwrap().insert(session_id, session.clone());

    Ok(session)
}

#[tauri::command]
pub async fn disconnect(
    session_id: String,
    state: State<'_, SSHState>,
) -> Result<(), String> {
    state.sessions.lock().unwrap().remove(&session_id);
    Ok(())
}

#[tauri::command]
pub async fn send_input(
    session_id: String,
    data: String,
    state: State<'_, SSHState>,
) -> Result<(), String> {
    // TODO: Send input to SSH session
    println!("Sending input to session {}: {}", session_id, data);
    Ok(())
}

#[tauri::command]
pub async fn resize(
    session_id: String,
    cols: u32,
    rows: u32,
    state: State<'_, SSHState>,
) -> Result<(), String> {
    // TODO: Resize terminal
    println!("Resizing session {} to {}x{}", session_id, cols, rows);
    Ok(())
}
