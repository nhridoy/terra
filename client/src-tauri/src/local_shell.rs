use std::collections::HashMap;
use std::io::{Read, Write};
use std::sync::{Arc, LazyLock, Mutex};

use portable_pty::{CommandBuilder, NativePtySystem, PtySize, PtySystem};
use serde::Serialize;
use tauri::{AppHandle, Emitter};

struct LocalSession {
    writer: Mutex<Box<dyn Write + Send>>,
    child: Mutex<Option<Box<dyn portable_pty::Child + Send>>>,
    master: Mutex<Box<dyn portable_pty::MasterPty + Send>>,
}

static LOCAL_SESSIONS: LazyLock<Mutex<HashMap<String, Arc<LocalSession>>>> =
    LazyLock::new(|| Mutex::new(HashMap::new()));

#[derive(Debug, Serialize)]
pub struct ShellInfo {
    pub name: String,
    pub path: String,
}

#[tauri::command]
pub fn list_local_shells() -> Vec<ShellInfo> {
    let mut shells = Vec::new();

    #[cfg(target_os = "windows")]
    {
        let candidates = [
            ("PowerShell", "powershell.exe"),
            ("PowerShell 7", "pwsh.exe"),
            ("Command Prompt", "cmd.exe"),
            ("Git Bash", "C:\\Program Files\\Git\\bin\\bash.exe"),
            ("WSL Bash", "wsl.exe"),
        ];
        for (name, path) in candidates {
            if std::path::Path::new(path).exists() {
                shells.push(ShellInfo {
                    name: name.to_string(),
                    path: path.to_string(),
                });
            }
        }
    }

    #[cfg(not(target_os = "windows"))]
    {
        let candidates = [
            ("Bash", "/bin/bash"),
            ("Zsh", "/bin/zsh"),
            ("Fish", "/usr/bin/fish"),
            ("Sh", "/bin/sh"),
            ("Dash", "/bin/dash"),
            ("Ksh", "/bin/ksh"),
            ("Nushell", "/usr/bin/nu"),
        ];
        for (name, path) in candidates {
            if std::path::Path::new(path).exists() {
                shells.push(ShellInfo {
                    name: name.to_string(),
                    path: path.to_string(),
                });
            }
        }

        if let Ok(shell) = std::env::var("SHELL") {
            if !shells.iter().any(|s| s.path == shell) {
                let name = shell.rsplit('/').next().unwrap_or(&shell);
                shells.push(ShellInfo {
                    name: name.to_string(),
                    path: shell,
                });
            }
        }
    }

    shells
}

#[tauri::command]
pub fn connect_local(
    app: AppHandle,
    session_id: String,
    shell: Option<String>,
    cols: Option<u16>,
    rows: Option<u16>,
) -> Result<(), String> {
    let shell_path = resolve_shell(shell);

    let pty_system = NativePtySystem::default();

    let size = PtySize {
        rows: rows.unwrap_or(24),
        cols: cols.unwrap_or(80),
        pixel_width: 0,
        pixel_height: 0,
    };

    let pair = pty_system
        .openpty(size)
        .map_err(|e| format!("Failed to open PTY: {e}"))?;

    let mut cmd = CommandBuilder::new(&shell_path);
    cmd.cwd(std::env::current_dir().unwrap_or_else(|_| std::path::PathBuf::from(".")));

    if let Ok(term) = std::env::var("TERM") {
        cmd.env("TERM", &term);
    } else {
        cmd.env("TERM", "xterm-256color");
    }

    let child = pair
        .slave
        .spawn_command(cmd)
        .map_err(|e| format!("Failed to spawn shell: {e}"))?;

    let writer = pair
        .master
        .take_writer()
        .map_err(|e| format!("Failed to get PTY writer: {e}"))?;

    let mut reader = pair
        .master
        .try_clone_reader()
        .map_err(|e| format!("Failed to get PTY reader: {e}"))?;

    let app_clone = app.clone();
    let session_id_clone = session_id.clone();

    // Spawn reader thread — reads PTY output and emits ssh-output events
    std::thread::spawn(move || {
        let mut buf = [0u8; 8192];
        loop {
            match reader.read(&mut buf) {
                Ok(0) => break,
                Ok(n) => {
                    let data = String::from_utf8_lossy(&buf[..n]).to_string();
                    let _ = app_clone.emit(
                        "ssh-output",
                        serde_json::json!({
                            "sessionId": session_id_clone,
                            "type": "output",
                            "data": data,
                        }),
                    );
                }
                Err(_) => break,
            }
        }
    });

    let session = Arc::new(LocalSession {
        writer: Mutex::new(writer),
        child: Mutex::new(Some(child)),
        master: Mutex::new(pair.master),
    });

    LOCAL_SESSIONS
        .lock()
        .map_err(|e| e.to_string())?
        .insert(session_id.clone(), session);

    // Emit connected event
    let _ = app.emit(
        "ssh-output",
        serde_json::json!({
            "sessionId": session_id,
            "type": "connected",
            "data": "",
        }),
    );

    // Watch for child exit → emit disconnected
    let app_exit = app.clone();
    let session_id_exit = session_id.clone();
    std::thread::spawn(move || {
        // Poll the child's exit status
        let exited = {
            let sessions = LOCAL_SESSIONS.lock().unwrap();
            if let Some(s) = sessions.get(&session_id_exit) {
                let mut child_guard = s.child.lock().unwrap();
                if let Some(ref mut c) = *child_guard {
                    // Try wait with timeout
                    match c.try_wait() {
                        Ok(Some(_status)) => true,
                        _ => false,
                    }
                } else {
                    true
                }
            } else {
                return;
            }
        };

        if exited {
            let _ = app_exit.emit(
                "ssh-output",
                serde_json::json!({
                    "sessionId": session_id_exit,
                    "type": "disconnected",
                    "data": "",
                }),
            );
            LOCAL_SESSIONS.lock().unwrap().remove(&session_id_exit);
        }
    });

    Ok(())
}

#[tauri::command]
pub fn disconnect_local(session_id: String) -> Result<(), String> {
    let session = LOCAL_SESSIONS
        .lock()
        .map_err(|e| e.to_string())?
        .remove(&session_id)
        .ok_or_else(|| format!("Local session {} not found", session_id))?;

    // Kill the child process
    let mut child_guard = session.child.lock().map_err(|e| e.to_string())?;
    if let Some(ref mut c) = *child_guard {
        let _ = c.kill();
    }

    Ok(())
}

#[tauri::command]
pub fn send_input_local(session_id: String, data: String) -> Result<(), String> {
    let sessions = LOCAL_SESSIONS
        .lock()
        .map_err(|e| e.to_string())?;
    let session = sessions
        .get(&session_id)
        .ok_or_else(|| format!("Local session {} not found", session_id))?;

    let mut writer = session.writer.lock().map_err(|e| e.to_string())?;
    writer
        .write_all(data.as_bytes())
        .map_err(|e| format!("Failed to write to PTY: {e}"))?;
    writer.flush().map_err(|e| format!("Failed to flush PTY: {e}"))?;

    Ok(())
}

#[tauri::command]
pub fn resize_local(
    session_id: String,
    cols: u16,
    rows: u16,
) -> Result<(), String> {
    let sessions = LOCAL_SESSIONS
        .lock()
        .map_err(|e| e.to_string())?;
    let session = sessions
        .get(&session_id)
        .ok_or_else(|| format!("Local session {} not found", session_id))?;

    let size = PtySize {
        rows,
        cols,
        pixel_width: 0,
        pixel_height: 0,
    };

    let master = session.master.lock().map_err(|e| e.to_string())?;
    master
        .resize(size)
        .map_err(|e| format!("Failed to resize PTY: {e}"))?;

    Ok(())
}

fn resolve_shell(explicit: Option<String>) -> String {
    if let Some(shell) = explicit {
        if !shell.is_empty() {
            return shell;
        }
    }

    #[cfg(target_os = "windows")]
    {
        if std::path::Path::new("powershell.exe").exists() {
            return "powershell.exe".to_string();
        }
        if std::path::Path::new("pwsh.exe").exists() {
            return "pwsh.exe".to_string();
        }
        return "cmd.exe".to_string();
    }

    #[cfg(not(target_os = "windows"))]
    {
        if let Ok(shell) = std::env::var("SHELL") {
            if !shell.is_empty() {
                return shell;
            }
        }
        "/bin/sh".to_string()
    }
}
