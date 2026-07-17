use std::collections::HashMap;
use std::io::{Read, Write};
use std::path::Path;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex as StdMutex};
use std::time::Duration;

use serde::{Deserialize, Serialize};
use ssh2::Session;
use tauri::{AppHandle, Emitter, State};

#[derive(Debug, Serialize, Deserialize)]
pub struct SSHConfig {
    pub host: String,
    pub port: u16,
    pub username: String,
    pub password: Option<String>,
    pub private_key: Option<String>,
    pub passphrase: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct SSHSessionInfo {
    pub id: String,
    pub host: String,
    pub port: u16,
    pub connected: bool,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SFTPFileItem {
    pub name: String,
    pub path: String,
    #[serde(rename = "type")]
    pub file_type: String,
    pub size: u64,
    pub permissions: String,
    pub modified_at: String,
}

pub struct SSHSessionInner {
    pub id: String,
    pub host: String,
    pub port: u16,
    pub session: Session,
    reader_stop: Arc<AtomicBool>,
}

impl SSHSessionInner {
    pub fn stop_reader(&self) {
        self.reader_stop.store(true, Ordering::SeqCst);
    }
}

pub struct SSHState {
    pub sessions: HashMap<String, SSHSessionInner>,
}

impl Default for SSHState {
    fn default() -> Self {
        Self {
            sessions: HashMap::new(),
        }
    }
}

static CHANNELS: std::sync::LazyLock<StdMutex<HashMap<String, StdMutex<Option<ssh2::Channel>>>>> =
    std::sync::LazyLock::new(|| StdMutex::new(HashMap::new()));

#[tauri::command]
pub async fn connect(
    session_id: String,
    config: SSHConfig,
    app: AppHandle,
    state: State<'_, StdMutex<SSHState>>,
) -> Result<SSHSessionInfo, String> {
    let addr = format!("{}:{}", config.host, config.port);

    let tcp =
        std::net::TcpStream::connect(&addr).map_err(|e| format!("TCP connect failed: {e}"))?;
    tcp.set_read_timeout(Some(Duration::from_secs(30)))
        .map_err(|e| e.to_string())?;

    let mut session = Session::new().map_err(|e| format!("Session create failed: {e}"))?;
    session.set_tcp_stream(tcp);
    session
        .handshake()
        .map_err(|e| format!("SSH handshake failed: {e}"))?;

    if let Some(ref password) = config.password {
        session
            .userauth_password(&config.username, password)
            .map_err(|e| format!("Password auth failed: {e}"))?;
    } else if let Some(ref key_path) = config.private_key {
        session
            .userauth_pubkey_file(
                &config.username,
                None,
                Path::new(key_path),
                config.passphrase.as_deref(),
            )
            .map_err(|e| format!("Key auth failed: {e}"))?;
    } else {
        return Err("No auth method provided".into());
    }

    if !session.authenticated() {
        return Err("Authentication failed".into());
    }

    let mut channel = session
        .channel_session()
        .map_err(|e| format!("Channel open failed: {e}"))?;
    channel
        .request_pty("xterm-256color", None, Some((80, 24, 0, 0)))
        .map_err(|e| format!("PTY request failed: {e}"))?;
    channel
        .shell()
        .map_err(|e| format!("Shell start failed: {e}"))?;

    let stop_flag = Arc::new(AtomicBool::new(false));
    let reader_channel = channel.clone();

    let inner = SSHSessionInner {
        id: session_id.clone(),
        host: config.host.clone(),
        port: config.port,
        session,
        reader_stop: stop_flag.clone(),
    };

    {
        let mut state = state.lock().map_err(|e| e.to_string())?;
        state.sessions.insert(session_id.clone(), inner);
    }

    let channel_mutex = StdMutex::new(Some(channel));
    CHANNELS
        .lock()
        .map_err(|e| e.to_string())?
        .insert(session_id.clone(), channel_mutex);

    let app_clone = app.clone();
    let sid = session_id.clone();
    let stop = stop_flag.clone();

    std::thread::spawn(move || {
        let mut buf = [0u8; 4096];
        let mut reader = reader_channel;
        loop {
            if stop.load(Ordering::SeqCst) {
                break;
            }
            match reader.read(&mut buf) {
                Ok(0) => {
                    let _ = app_clone.emit(
                        "ssh-output",
                        serde_json::json!({
                            "sessionId": sid,
                            "type": "disconnected",
                            "data": ""
                        }),
                    );
                    break;
                }
                Ok(n) => {
                    let data = String::from_utf8_lossy(&buf[..n]).to_string();
                    let _ = app_clone.emit(
                        "ssh-output",
                        serde_json::json!({
                            "sessionId": sid,
                            "type": "output",
                            "data": data
                        }),
                    );
                }
                Err(ref e)
                    if e.kind() == std::io::ErrorKind::WouldBlock
                        || e.kind() == std::io::ErrorKind::TimedOut =>
                {
                    continue;
                }
                Err(_) => {
                    break;
                }
            }
        }
    });

    let _ = app.emit(
        "ssh-output",
        serde_json::json!({
            "sessionId": session_id,
            "type": "connected",
            "data": ""
        }),
    );

    Ok(SSHSessionInfo {
        id: session_id,
        host: config.host,
        port: config.port,
        connected: true,
    })
}

#[tauri::command]
pub async fn disconnect(
    session_id: String,
    state: State<'_, StdMutex<SSHState>>,
) -> Result<(), String> {
    {
        let mut channels = CHANNELS.lock().map_err(|e| e.to_string())?;
        if let Some(ch) = channels.remove(&session_id) {
            if let Ok(mut ch) = ch.lock() {
                if let Some(mut ch) = ch.take() {
                    let _ = ch.close();
                    let _ = ch.wait_close();
                }
            }
        }
    }
    {
        let mut state = state.lock().map_err(|e| e.to_string())?;
        if let Some(session) = state.sessions.remove(&session_id) {
            session.stop_reader();
        }
    }
    Ok(())
}

#[tauri::command]
pub async fn send_input(session_id: String, data: String) -> Result<(), String> {
    let channels = CHANNELS.lock().map_err(|e| e.to_string())?;
    let ch = channels
        .get(&session_id)
        .ok_or("Session not found")?;
    let mut ch = ch.lock().map_err(|e| e.to_string())?;
    let ch = ch.as_mut().ok_or("Channel closed")?;
    ch.write_all(data.as_bytes())
        .map_err(|e| e.to_string())?;
    ch.flush().map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub async fn resize(session_id: String, cols: u32, rows: u32) -> Result<(), String> {
    let channels = CHANNELS.lock().map_err(|e| e.to_string())?;
    let ch = channels
        .get(&session_id)
        .ok_or("Session not found")?;
    let mut ch = ch.lock().map_err(|e| e.to_string())?;
    let ch = ch.as_mut().ok_or("Channel closed")?;
    ch.request_pty("xterm-256color", None, Some((cols, rows, 0, 0)))
        .map_err(|e| e.to_string())?;
    Ok(())
}

// ── SFTP commands ─────────────────────────────────────────────

#[tauri::command]
pub async fn sftp_list(
    session_id: String,
    path: String,
    state: State<'_, StdMutex<SSHState>>,
) -> Result<Vec<SFTPFileItem>, String> {
    let state = state.lock().map_err(|e| e.to_string())?;
    let session = state
        .sessions
        .get(&session_id)
        .ok_or("Session not found")?;

    let sftp = session.session.sftp().map_err(|e| e.to_string())?;
    let entries = sftp.readdir(Path::new(&path)).map_err(|e| e.to_string())?;

    let mut items = Vec::new();
    for (dir_entry, metadata) in entries {
        let name = dir_entry
            .file_name()
            .map(|n| n.to_string_lossy().to_string())
            .unwrap_or_default();
        let full_path = if path.ends_with('/') {
            format!("{path}{name}")
        } else {
            format!("{path}/{name}")
        };

        let file_type = if metadata.is_dir() {
            "directory"
        } else if metadata.is_file() {
            "file"
        } else {
            "symlink"
        };

        items.push(SFTPFileItem {
            name,
            path: full_path,
            file_type: file_type.to_string(),
            size: metadata.size.unwrap_or(0),
            permissions: format!("{:o}", metadata.perm.unwrap_or(0)),
            modified_at: {
                let mtime = metadata.mtime.unwrap_or(0) as i64;
                let dt = chrono::DateTime::from_timestamp(mtime, 0).unwrap_or_default();
                dt.to_rfc3339()
            },
        });
    }

    Ok(items)
}

#[tauri::command]
pub async fn sftp_read(
    session_id: String,
    path: String,
    state: State<'_, StdMutex<SSHState>>,
) -> Result<String, String> {
    let state = state.lock().map_err(|e| e.to_string())?;
    let session = state
        .sessions
        .get(&session_id)
        .ok_or("Session not found")?;

    let sftp = session.session.sftp().map_err(|e| e.to_string())?;
    let mut file = sftp.open(Path::new(&path)).map_err(|e| e.to_string())?;
    let mut content = String::new();
    file.read_to_string(&mut content)
        .map_err(|e| e.to_string())?;
    Ok(content)
}

#[tauri::command]
pub async fn sftp_write(
    session_id: String,
    path: String,
    content: String,
    state: State<'_, StdMutex<SSHState>>,
) -> Result<(), String> {
    let state = state.lock().map_err(|e| e.to_string())?;
    let session = state
        .sessions
        .get(&session_id)
        .ok_or("Session not found")?;

    let sftp = session.session.sftp().map_err(|e| e.to_string())?;
    let mut file = sftp.create(Path::new(&path)).map_err(|e| e.to_string())?;
    std::io::Write::write_all(&mut file, content.as_bytes()).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub async fn sftp_delete(
    session_id: String,
    path: String,
    state: State<'_, StdMutex<SSHState>>,
) -> Result<(), String> {
    let state = state.lock().map_err(|e| e.to_string())?;
    let session = state
        .sessions
        .get(&session_id)
        .ok_or("Session not found")?;

    let sftp = session.session.sftp().map_err(|e| e.to_string())?;
    if sftp.unlink(Path::new(&path)).is_err() {
        sftp.rmdir(Path::new(&path))
            .map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
pub async fn sftp_mkdir(
    session_id: String,
    path: String,
    state: State<'_, StdMutex<SSHState>>,
) -> Result<(), String> {
    let state = state.lock().map_err(|e| e.to_string())?;
    let session = state
        .sessions
        .get(&session_id)
        .ok_or("Session not found")?;

    let sftp = session.session.sftp().map_err(|e| e.to_string())?;
    sftp.mkdir(Path::new(&path), 0o755)
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub async fn sftp_rename(
    session_id: String,
    old_path: String,
    new_path: String,
    state: State<'_, StdMutex<SSHState>>,
) -> Result<(), String> {
    let state = state.lock().map_err(|e| e.to_string())?;
    let session = state
        .sessions
        .get(&session_id)
        .ok_or("Session not found")?;

    let sftp = session.session.sftp().map_err(|e| e.to_string())?;
    sftp.rename(Path::new(&old_path), Path::new(&new_path), None)
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub async fn sftp_chmod(
    _session_id: String,
    _path: String,
    _mode: u32,
) -> Result<(), String> {
    // ssh2 SFTP doesn't expose chmod directly; skip for now
    Ok(())
}

#[tauri::command]
pub async fn sftp_copy(
    session_id: String,
    src_path: String,
    dst_path: String,
    state: State<'_, StdMutex<SSHState>>,
) -> Result<(), String> {
    let state = state.lock().map_err(|e| e.to_string())?;
    let session = state
        .sessions
        .get(&session_id)
        .ok_or("Session not found")?;

    let sftp = session.session.sftp().map_err(|e| e.to_string())?;
    let mut src_file = sftp.open(Path::new(&src_path)).map_err(|e| e.to_string())?;
    let mut content = Vec::new();
    src_file
        .read_to_end(&mut content)
        .map_err(|e| e.to_string())?;

    let mut dst_file = sftp
        .create(Path::new(&dst_path))
        .map_err(|e| e.to_string())?;
    std::io::Write::write_all(&mut dst_file, &content).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub async fn sftp_cross_copy(
    src_session_id: String,
    src_path: String,
    dst_session_id: String,
    dst_path: String,
    state: State<'_, StdMutex<SSHState>>,
) -> Result<(), String> {
    let state = state.lock().map_err(|e| e.to_string())?;

    let src_session = state
        .sessions
        .get(&src_session_id)
        .ok_or("Source session not found")?;
    let src_sftp = src_session.session.sftp().map_err(|e| e.to_string())?;
    let mut src_file = src_sftp
        .open(Path::new(&src_path))
        .map_err(|e| e.to_string())?;
    let mut content = Vec::new();
    src_file
        .read_to_end(&mut content)
        .map_err(|e| e.to_string())?;

    let dst_session = state
        .sessions
        .get(&dst_session_id)
        .ok_or("Destination session not found")?;
    let dst_sftp = dst_session.session.sftp().map_err(|e| e.to_string())?;
    let mut dst_file = dst_sftp
        .create(Path::new(&dst_path))
        .map_err(|e| e.to_string())?;
    std::io::Write::write_all(&mut dst_file, &content).map_err(|e| e.to_string())?;

    Ok(())
}
