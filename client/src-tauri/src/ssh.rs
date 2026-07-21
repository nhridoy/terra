use std::collections::HashMap;
use std::io::{Read, Write};
use std::net::TcpListener;
use std::path::Path;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex as StdMutex};
use std::time::Duration;

use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use ssh2::Session;
use tauri::{AppHandle, Emitter, State};

use crate::known_hosts;

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
    pub reader_stop: Arc<AtomicBool>,
}

impl SSHSessionInner {
    pub fn stop_reader(&self) {
        self.reader_stop.store(true, Ordering::SeqCst);
    }
}

pub struct SSHState {
    pub sessions: HashMap<String, SSHSessionInner>,
    pub port_forwards: HashMap<String, PortForwardInner>,
}

impl Default for SSHState {
    fn default() -> Self {
        Self {
            sessions: HashMap::new(),
            port_forwards: HashMap::new(),
        }
    }
}

static CHANNELS: std::sync::LazyLock<StdMutex<HashMap<String, StdMutex<Option<ssh2::Channel>>>>> =
    std::sync::LazyLock::new(|| StdMutex::new(HashMap::new()));

static SESSIONS: std::sync::LazyLock<StdMutex<HashMap<String, StdMutex<Option<Session>>>>> =
    std::sync::LazyLock::new(|| StdMutex::new(HashMap::new()));

/// Pending host key verification (sender for user response)
static PENDING_HOST_KEY: std::sync::LazyLock<
    StdMutex<Option<std::sync::mpsc::SyncSender<bool>>>,
> = std::sync::LazyLock::new(|| StdMutex::new(None));

fn with_session<F, R>(session_id: &str, f: F) -> Result<R, String>
where
    F: FnOnce(&Session) -> Result<R, String>,
{
    let sessions = SESSIONS.lock().map_err(|e| e.to_string())?;
    let session_mutex = sessions
        .get(session_id)
        .ok_or_else(|| format!("Session {} not found", session_id))?;
    let guard = session_mutex.lock().map_err(|e| e.to_string())?;
    let session = guard.as_ref().ok_or("Session not connected")?;
    f(session)
}

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

    // Verify host key to prevent MITM attacks
    if let Some((key_data, _key_type)) = session.host_key() {
        let key_hash = Sha256::digest(key_data);
        let fingerprint = format!("SHA256:{}", base64::Engine::encode(&base64::engine::general_purpose::STANDARD, &key_hash));

        // Check known_hosts for TOFU verification
        let known_hosts_path = known_hosts::get_known_hosts_path()?;
        match known_hosts::check_host_key(&known_hosts_path, &config.host, config.port, &fingerprint)? {
            known_hosts::HostKeyStatus::Trusted => {
                // Key matches saved fingerprint, proceed
            }
            known_hosts::HostKeyStatus::Unknown => {
                // First connection, trust and save
                known_hosts::trust_host_key(&known_hosts_path, &config.host, config.port, &fingerprint)?;
                let _ = app.emit("ssh-host-key-trusted", &fingerprint);
            }
            known_hosts::HostKeyStatus::Changed { old_fingerprint } => {
                // Key changed! Potential MITM attack
                // Emit event and wait for user decision
                let _ = app.emit("ssh-host-key-changed", serde_json::json!({
                    "host": config.host,
                    "port": config.port,
                    "oldFingerprint": old_fingerprint,
                    "newFingerprint": fingerprint,
                }));

                // Wait for user response via channel
                let (tx, rx) = std::sync::mpsc::sync_channel(1);
                {
                    let mut pending = PENDING_HOST_KEY.lock().map_err(|e| e.to_string())?;
                    *pending = Some(tx);
                }

                // Block until user responds (with timeout)
                let accepted = rx.recv_timeout(Duration::from_secs(30))
                    .map_err(|_| "Host key verification timed out".to_string())?;

                // Clear pending
                {
                    let mut pending = PENDING_HOST_KEY.lock().map_err(|e| e.to_string())?;
                    *pending = None;
                }

                if !accepted {
                    // User rejected the key change
                    drop(session);
                    return Err("Host key verification failed: key has changed".into());
                }

                // User accepted, update known_hosts
                known_hosts::trust_host_key(&known_hosts_path, &config.host, config.port, &fingerprint)?;
            }
        }
    }

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

    // Store session in global map (instead of SSHSessionInner) so port forwarding threads can access it
    let session_mutex = StdMutex::new(Some(session));
    SESSIONS
        .lock()
        .map_err(|e| e.to_string())?
        .insert(session_id.clone(), session_mutex);

    let inner = SSHSessionInner {
        id: session_id.clone(),
        host: config.host.clone(),
        port: config.port,
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

/// Accept or reject a host key change (called from frontend)
#[tauri::command]
pub fn accept_host_key(accepted: bool) -> Result<(), String> {
    let mut pending = PENDING_HOST_KEY.lock().map_err(|e| e.to_string())?;
    if let Some(sender) = pending.take() {
        sender.send(accepted).map_err(|e| format!("Failed to send response: {}", e))?;
    }
    Ok(())
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
    // Clean up global session map
    SESSIONS.lock().map_err(|e| e.to_string())?.remove(&session_id);
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
) -> Result<Vec<SFTPFileItem>, String> {
    with_session(&session_id, |session| {
        let sftp = session.sftp().map_err(|e| e.to_string())?;
        let entries = sftp.readdir(Path::new(&path)).map_err(|e| e.to_string())?;
        let mut items = Vec::new();
        for (dir_entry, metadata) in entries {
            let name = dir_entry.file_name().map(|n| n.to_string_lossy().to_string()).unwrap_or_default();
            let full_path = if path.ends_with('/') { format!("{path}{name}") } else { format!("{path}/{name}") };
            let file_type = if metadata.is_dir() { "directory" } else if metadata.is_file() { "file" } else { "symlink" };
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
    })
}

#[tauri::command]
pub async fn sftp_read(session_id: String, path: String) -> Result<String, String> {
    with_session(&session_id, |session| {
        let sftp = session.sftp().map_err(|e| e.to_string())?;
        let mut file = sftp.open(Path::new(&path)).map_err(|e| e.to_string())?;
        let mut content = String::new();
        file.read_to_string(&mut content).map_err(|e| e.to_string())?;
        Ok(content)
    })
}

#[tauri::command]
pub async fn sftp_write(session_id: String, path: String, content: String) -> Result<(), String> {
    with_session(&session_id, |session| {
        let sftp = session.sftp().map_err(|e| e.to_string())?;
        let mut file = sftp.create(Path::new(&path)).map_err(|e| e.to_string())?;
        std::io::Write::write_all(&mut file, content.as_bytes()).map_err(|e| e.to_string())?;
        Ok(())
    })
}

#[tauri::command]
pub async fn sftp_delete(session_id: String, path: String) -> Result<(), String> {
    with_session(&session_id, |session| {
        let sftp = session.sftp().map_err(|e| e.to_string())?;
        if sftp.unlink(Path::new(&path)).is_err() {
            sftp.rmdir(Path::new(&path)).map_err(|e| e.to_string())?;
        }
        Ok(())
    })
}

#[tauri::command]
pub async fn sftp_mkdir(session_id: String, path: String) -> Result<(), String> {
    with_session(&session_id, |session| {
        let sftp = session.sftp().map_err(|e| e.to_string())?;
        sftp.mkdir(Path::new(&path), 0o755).map_err(|e| e.to_string())?;
        Ok(())
    })
}

#[tauri::command]
pub async fn sftp_rename(session_id: String, old_path: String, new_path: String) -> Result<(), String> {
    with_session(&session_id, |session| {
        let sftp = session.sftp().map_err(|e| e.to_string())?;
        sftp.rename(Path::new(&old_path), Path::new(&new_path), None).map_err(|e| e.to_string())?;
        Ok(())
    })
}

#[tauri::command]
pub async fn sftp_chmod(session_id: String, path: String, mode: u32) -> Result<(), String> {
    with_session(&session_id, |session| {
        let sftp = session.sftp().map_err(|e| e.to_string())?;
        let mut stat = sftp.stat(Path::new(&path)).map_err(|e| e.to_string())?;
        stat.perm = Some(mode);
        sftp.setstat(Path::new(&path), stat).map_err(|e| e.to_string())?;
        Ok(())
    })
}

#[tauri::command]
pub async fn sftp_copy(session_id: String, src_path: String, dst_path: String) -> Result<(), String> {
    with_session(&session_id, |session| {
        let sftp = session.sftp().map_err(|e| e.to_string())?;
        let mut src_file = sftp.open(Path::new(&src_path)).map_err(|e| e.to_string())?;
        let mut dst_file = sftp.create(Path::new(&dst_path)).map_err(|e| e.to_string())?;
        let mut buf = [0u8; 65536];
        loop {
            let n = std::io::Read::read(&mut src_file, &mut buf).map_err(|e| e.to_string())?;
            if n == 0 {
                break;
            }
            std::io::Write::write_all(&mut dst_file, &buf[..n]).map_err(|e| e.to_string())?;
        }
        Ok(())
    })
}

#[tauri::command]
pub async fn sftp_cross_copy(
    src_session_id: String,
    src_path: String,
    dst_session_id: String,
    dst_path: String,
) -> Result<(), String> {
    let mut dst_file = with_session(&dst_session_id, |session| {
        let sftp = session.sftp().map_err(|e| e.to_string())?;
        sftp.create(Path::new(&dst_path)).map_err(|e| e.to_string())
    })?;
    with_session(&src_session_id, |session| {
        let sftp = session.sftp().map_err(|e| e.to_string())?;
        let mut src_file = sftp.open(Path::new(&src_path)).map_err(|e| e.to_string())?;
        let mut buf = [0u8; 65536];
        loop {
            let n = std::io::Read::read(&mut src_file, &mut buf).map_err(|e| e.to_string())?;
            if n == 0 {
                break;
            }
            std::io::Write::write_all(&mut dst_file, &buf[..n]).map_err(|e| e.to_string())?;
        }
        Ok(())
    })
}

// ── Port Forwarding ──────────────────────────────────────────

pub struct PortForwardInner {
    pub id: String,
    pub session_id: String,
    pub local_port: u16,
    pub remote_host: String,
    pub remote_port: u16,
    pub stop: Arc<AtomicBool>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct PortForwardConfig {
    pub local_port: u16,
    pub remote_host: String,
    pub remote_port: u16,
}

#[derive(Debug, Serialize)]
pub struct PortForwardInfo {
    pub id: String,
    pub session_id: String,
    pub local_port: u16,
    pub remote_host: String,
    pub remote_port: u16,
    pub active: bool,
}

fn pipe_local_to_remote(
    mut local: std::net::TcpStream,
    mut channel: ssh2::Channel,
    stop: Arc<AtomicBool>,
) {
    use std::io::Read;

    local
        .set_read_timeout(Some(Duration::from_millis(100)))
        .ok();

    let mut local_buf = [0u8; 8192];
    let mut channel_buf = [0u8; 8192];

    loop {
        if stop.load(Ordering::SeqCst) {
            break;
        }

        // Read from local TCP → write to SSH channel
        match local.read(&mut local_buf) {
            Ok(0) => break,
            Ok(n) => {
                if channel.write_all(&local_buf[..n]).is_err() {
                    break;
                }
                if channel.flush().is_err() {
                    break;
                }
            }
            Err(ref e)
                if e.kind() == std::io::ErrorKind::WouldBlock
                    || e.kind() == std::io::ErrorKind::TimedOut =>
            {
                // no data available, check channel
            }
            Err(_) => break,
        }

        // Read from SSH channel → write to local TCP
        match channel.read(&mut channel_buf) {
            Ok(0) => break,
            Ok(n) => {
                use std::io::Write;
                if local.write_all(&channel_buf[..n]).is_err() {
                    break;
                }
            }
            Err(ref e)
                if e.kind() == std::io::ErrorKind::WouldBlock
                    || e.kind() == std::io::ErrorKind::TimedOut =>
            {
                // no data available
            }
            Err(_) => break,
        }
    }

    let _ = channel.close();
}

#[tauri::command]
pub async fn port_forward_start(
    session_id: String,
    config: PortForwardConfig,
    state: State<'_, StdMutex<SSHState>>,
    app: AppHandle,
) -> Result<PortForwardInfo, String> {
    let forward_id = uuid::Uuid::new_v4().to_string();
    let local_addr = format!("127.0.0.1:{}", config.local_port);

    let listener = TcpListener::bind(&local_addr)
        .map_err(|e| format!("Failed to bind local port {}: {}", config.local_port, e))?;
    listener
        .set_nonblocking(true)
        .map_err(|e| e.to_string())?;

    let stop = Arc::new(AtomicBool::new(false));
    let stop_clone = stop.clone();
    let sid = session_id.clone();
    let fid = forward_id.clone();
    let app_clone = app.clone();
    let remote_host = config.remote_host.clone();
    let remote_port = config.remote_port;

    std::thread::spawn(move || {
        let _ = app_clone.emit(
            "port-forward-started",
            serde_json::json!({ "forwardId": fid, "sessionId": sid }),
        );

        let remote_host = remote_host;

        loop {
            if stop_clone.load(Ordering::SeqCst) {
                break;
            }

            match listener.accept() {
                Ok((tcp_stream, _addr)) => {
                    let rh = remote_host.clone();
                    let sid2 = sid.clone();
                    let app2 = app_clone.clone();
                    let fid2 = fid.clone();
                    let stop2 = stop_clone.clone();

                    std::thread::spawn(move || {
                        // Create a direct-tcpip channel via the SSH session
                        let channel_result = with_session(&sid2, |session| {
                            session
                                .channel_direct_tcpip(&rh, remote_port, Some(("127.0.0.1", 0)))
                                .map_err(|e| format!("Failed to open direct channel: {}", e))
                        });

                        match channel_result {
                            Ok(channel) => {
                                let _ = app2.emit(
                                    "port-forward-connection",
                                    serde_json::json!({
                                        "forwardId": fid2,
                                        "sessionId": sid2,
                                        "status": "connected"
                                    }),
                                );
                                pipe_local_to_remote(tcp_stream, channel, stop2);
                            }
                            Err(e) => {
                                let _ = app2.emit(
                                    "port-forward-connection",
                                    serde_json::json!({
                                        "forwardId": fid2,
                                        "sessionId": sid2,
                                        "status": "error",
                                        "error": e
                                    }),
                                );
                            }
                        }
                    });
                }
                Err(ref e)
                    if e.kind() == std::io::ErrorKind::WouldBlock
                        || e.kind() == std::io::ErrorKind::TimedOut =>
                {
                    std::thread::sleep(Duration::from_millis(50));
                    continue;
                }
                Err(_) => {
                    std::thread::sleep(Duration::from_millis(100));
                    continue;
                }
            }
        }

        let _ = app_clone.emit(
            "port-forward-stopped",
            serde_json::json!({ "forwardId": fid, "sessionId": sid }),
        );
    });

    let info = PortForwardInfo {
        id: forward_id.clone(),
        session_id: session_id.clone(),
        local_port: config.local_port,
        remote_host: config.remote_host.clone(),
        remote_port: config.remote_port,
        active: true,
    };

    {
        let mut state = state.lock().map_err(|e| e.to_string())?;
        state.port_forwards.insert(
            forward_id.clone(),
            PortForwardInner {
                id: forward_id,
                session_id,
                local_port: config.local_port,
                remote_host: config.remote_host,
                remote_port: config.remote_port,
                stop,
            },
        );
    }

    Ok(info)
}

#[tauri::command]
pub async fn port_forward_stop(
    forward_id: String,
    state: State<'_, StdMutex<SSHState>>,
) -> Result<(), String> {
    let mut state = state.lock().map_err(|e| e.to_string())?;
    if let Some(forward) = state.port_forwards.remove(&forward_id) {
        forward.stop.store(true, Ordering::SeqCst);
    }
    Ok(())
}

#[tauri::command]
pub async fn port_forward_list(
    state: State<'_, StdMutex<SSHState>>,
) -> Result<Vec<PortForwardInfo>, String> {
    let state = state.lock().map_err(|e| e.to_string())?;
    Ok(state
        .port_forwards
        .values()
        .map(|f| PortForwardInfo {
            id: f.id.clone(),
            session_id: f.session_id.clone(),
            local_port: f.local_port,
            remote_host: f.remote_host.clone(),
            remote_port: f.remote_port,
            active: !f.stop.load(Ordering::SeqCst),
        })
        .collect())
}
