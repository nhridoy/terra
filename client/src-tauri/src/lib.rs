#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::collections::{HashMap, BTreeMap};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use std::io::{Read, Write};
use std::thread;
use tauri::{Emitter, Listener, Manager};

pub struct AppState {
    pub device_id: String,
    pub api_url: Mutex<Option<String>>,
}

pub struct CancelTokens {
    pub tokens: Mutex<HashMap<String, Arc<AtomicBool>>>,
}

#[tauri::command]
fn get_device_id(state: tauri::State<'_, AppState>) -> String {
    state.device_id.clone()
}

#[tauri::command]
fn set_api_url(url: String, state: tauri::State<'_, AppState>) -> Result<(), String> {
    let mut guard = state.api_url.lock().map_err(|e| e.to_string())?;
    *guard = Some(url);
    Ok(())
}

#[tauri::command]
fn get_api_url(state: tauri::State<'_, AppState>) -> Result<String, String> {
    let guard = state.api_url.lock().map_err(|e| e.to_string())?;
    Ok(guard
        .clone()
        .unwrap_or_else(|| "http://localhost:8080".to_string()))
}

#[tauri::command]
fn write_file(path: String, contents: String) -> Result<(), String> {
    let p = std::path::Path::new(&path);
    if let Some(parent) = p.parent() {
        std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    std::fs::write(p, contents).map_err(|e| e.to_string())
}

#[derive(serde::Serialize)]
struct ShellInfo {
    name: String,
    path: String,
}

fn probe_shell(name: &str, args: &[&str]) -> Option<ShellInfo> {
    std::process::Command::new(name)
        .args(args)
        .stdout(std::process::Stdio::piped())
        .stderr(std::process::Stdio::null())
        .output()
        .ok()
        .and_then(|output| {
            if output.status.success() {
                Some(ShellInfo {
                    name: name.to_string(),
                    path: name.to_string(),
                })
            } else {
                None
            }
        })
}

fn probe_shell_with_timeout(name: &str, args: &[&str], timeout_ms: u64) -> Option<ShellInfo> {
    use std::process::Command;
    use std::sync::mpsc;
    use std::thread;
    use std::time::Duration;

    let mut cmd = Command::new(name);
    cmd.args(args)
        .stdout(std::process::Stdio::piped())
        .stderr(std::process::Stdio::null());

    let child_id;

    {
        let child = cmd.spawn().ok()?;
        child_id = child.id();

        let (tx, rx) = mpsc::channel();
        thread::spawn(move || {
            thread::sleep(Duration::from_millis(timeout_ms));
            #[cfg(target_os = "windows")]
            {
                let _ = Command::new("taskkill")
                    .args(["/F", "/PID", &child_id.to_string()])
                    .output();
            }
            #[cfg(not(target_os = "windows"))]
            {
                let _ = Command::new("kill")
                    .args(["-9", &child_id.to_string()])
                    .output();
            }
            let _ = tx.send(());
        });

        let output = child.wait_with_output().ok()?;
        let _ = rx.recv_timeout(Duration::from_millis(100));

        if output.status.success() {
            return Some(ShellInfo {
                name: name.to_string(),
                path: name.to_string(),
            });
        }
    }

    None
}

#[cfg(target_os = "windows")]
fn detect_shells_platform() -> Vec<ShellInfo> {
    let mut shells = Vec::new();

    // PowerShell 7+ (pwsh)
    if let Some(s) = probe_shell("pwsh", &["--version"]) {
        shells.push(ShellInfo { name: "PowerShell 7".to_string(), ..s });
    }
    // Windows PowerShell
    if let Some(s) = probe_shell("powershell.exe", &["-NoProfile", "-Command", "echo ok"]) {
        shells.push(ShellInfo { name: "PowerShell".to_string(), ..s });
    }
    // cmd.exe
    if probe_shell("cmd.exe", &["/C", "echo ok"]).is_some() {
        shells.push(ShellInfo {
            name: "Command Prompt".to_string(),
            path: "cmd.exe".to_string(),
        });
    }
    // Git Bash
    let git_bash_paths = [
        r"C:\Program Files\Git\bin\bash.exe",
        r"C:\Program Files (x86)\Git\bin\bash.exe",
    ];
    for p in &git_bash_paths {
        if std::path::Path::new(p).exists() {
            shells.push(ShellInfo {
                name: "Git Bash".to_string(),
                path: p.to_string(),
            });
            break;
        }
    }
    // WSL — use timeout probe to avoid hanging on misconfigured systems
    if probe_shell_with_timeout("wsl.exe", &["--status"], 3000).is_some() {
        shells.push(ShellInfo {
            name: "WSL".to_string(),
            path: "wsl.exe".to_string(),
        });
    }
    // sh (if available via MSYS/Git/etc) — use -c "echo ok" since most
    // Windows sh implementations don't support --version
    if probe_shell("sh", &["-c", "echo ok"]).is_some() {
        shells.push(ShellInfo {
            name: "sh".to_string(),
            path: "sh".to_string(),
        });
    }

    shells
}

#[cfg(target_os = "macos")]
fn detect_shells_platform() -> Vec<ShellInfo> {
    let mut shells = Vec::new();
    let mut seen_names: std::collections::HashSet<String> = std::collections::HashSet::new();

    // Respect user's default shell
    if let Ok(user_shell) = std::env::var("SHELL") {
        let shell_name = user_shell
            .split('/')
            .last()
            .unwrap_or("shell")
            .to_string();
        shells.push(ShellInfo {
            name: format!("{shell_name} (default)"),
            path: user_shell,
        });
        seen_names.insert(shell_name);
    }

    // Common shells — dedup by base name to avoid duplicates when $SHELL
    // points to a non-standard path (e.g. /usr/local/bin/zsh)
    let candidates = [
        ("/bin/zsh", "zsh"),
        ("/bin/bash", "bash"),
        ("/usr/bin/fish", "fish"),
        ("/opt/homebrew/bin/fish", "fish"),
        ("pwsh", "PowerShell 7"),
    ];

    for (path, display) in &candidates {
        if !seen_names.contains(*display) && probe_shell(path, &["-c", "echo ok"]).is_some() {
            shells.push(ShellInfo {
                name: display.to_string(),
                path: path.to_string(),
            });
            seen_names.insert(display.to_string());
        }
    }

    shells
}

#[cfg(target_os = "linux")]
fn detect_shells_platform() -> Vec<ShellInfo> {
    let mut shells = Vec::new();
    let mut seen_names: std::collections::HashSet<String> = std::collections::HashSet::new();

    // Respect user's default shell
    if let Ok(user_shell) = std::env::var("SHELL") {
        let shell_name = user_shell
            .split('/')
            .last()
            .unwrap_or("shell")
            .to_string();
        shells.push(ShellInfo {
            name: format!("{shell_name} (default)"),
            path: user_shell,
        });
        seen_names.insert(shell_name);
    }

    let candidates = [
        ("/bin/bash", "bash"),
        ("/usr/bin/bash", "bash"),
        ("/bin/zsh", "zsh"),
        ("/usr/bin/zsh", "zsh"),
        ("/usr/bin/fish", "fish"),
        ("pwsh", "PowerShell 7"),
    ];

    for (path, display) in &candidates {
        if !seen_names.contains(*display) && probe_shell(path, &["-c", "echo ok"]).is_some() {
            shells.push(ShellInfo {
                name: display.to_string(),
                path: path.to_string(),
            });
            seen_names.insert(display.to_string());
        }
    }

    shells
}

#[cfg(not(any(target_os = "windows", target_os = "macos", target_os = "linux")))]
fn detect_shells_platform() -> Vec<ShellInfo> {
    vec![ShellInfo {
        name: "sh".to_string(),
        path: "sh".to_string(),
    }]
}

#[tauri::command]
async fn detect_shells() -> Vec<ShellInfo> {
    tokio::task::spawn_blocking(|| detect_shells_platform())
        .await
        .unwrap_or_default()
}

#[cfg(target_os = "windows")]
#[tauri::command]
fn is_same_volume(path1: String, path2: String) -> Result<bool, String> {
    // Canonicalize both paths, then compare their root (e.g. "C:\")
    let canon1 = std::fs::canonicalize(&path1).map_err(|e| e.to_string())?;
    let canon2 = std::fs::canonicalize(&path2).map_err(|e| e.to_string())?;

    // Get the root directory of each path (e.g. C:\ or \\server\share)
    let root1 = canon1.ancestors().last().unwrap_or(&canon1);
    let root2 = canon2.ancestors().last().unwrap_or(&canon2);

    Ok(root1 == root2)
}

#[cfg(unix)]
#[tauri::command]
fn is_same_volume(path1: String, path2: String) -> Result<bool, String> {
    use std::os::unix::fs::MetadataExt;
    let meta1 = std::fs::metadata(&path1).map_err(|e| e.to_string())?;
    let meta2 = std::fs::metadata(&path2).map_err(|e| e.to_string())?;
    Ok(meta1.dev() == meta2.dev())
}

#[cfg(not(any(target_os = "windows", unix)))]
#[tauri::command]
fn is_same_volume(_path1: String, _path2: String) -> Result<bool, String> {
    Ok(false)
}

#[derive(serde::Deserialize)]
struct CopyFileEntry {
    source: String,
    destination: String,
}

#[tauri::command]
async fn get_file_size(path: String) -> Result<u64, String> {
    let p = std::path::PathBuf::from(&path);
    tauri::async_runtime::spawn_blocking(move || {
        p.metadata()
            .map(|m| m.len())
            .map_err(|e| format!("{path}: {e}"))
    })
    .await
    .map_err(|e| format!("Task failed: {e}"))?
}

#[tauri::command]
fn cancel_copy(
    state: tauri::State<'_, CancelTokens>,
    operation_id: String,
) -> Result<(), String> {
    let tokens = state.tokens.lock().map_err(|e| e.to_string())?;
    if let Some(token) = tokens.get(&operation_id) {
        token.store(true, Ordering::Relaxed);
    }
    Ok(())
}

#[tauri::command]
async fn copy_files_with_progress(
    app: tauri::AppHandle,
    state: tauri::State<'_, CancelTokens>,
    files: Vec<CopyFileEntry>,
    operation_id: String,
) -> Result<Vec<String>, String> {
    let cancelled = Arc::new(AtomicBool::new(false));
    state
        .tokens
        .lock()
        .map_err(|e| e.to_string())?
        .insert(operation_id.clone(), cancelled.clone());

    let op_id = operation_id.clone();
    let errors = tauri::async_runtime::spawn_blocking(move || {
        let mut errors = Vec::new();
        for entry in &files {
            if cancelled.load(Ordering::Relaxed) {
                errors.push("Cancelled".to_string());
                break;
            }

            let src = std::path::Path::new(&entry.source);
            let dst = std::path::Path::new(&entry.destination);
            let name = src
                .file_name()
                .map(|n| n.to_string_lossy().into_owned())
                .unwrap_or_else(|| entry.source.clone());

            if let Some(parent) = dst.parent() {
                if let Err(e) = std::fs::create_dir_all(parent) {
                    errors.push(format!("{name}: {e}"));
                    continue;
                }
            }

            let total = match std::fs::metadata(src) {
                Ok(m) => m.len(),
                Err(e) => {
                    errors.push(format!("{name}: {e}"));
                    continue;
                }
            };

            let src_file = match std::fs::File::open(src) {
                Ok(f) => f,
                Err(e) => {
                    errors.push(format!("{name}: {e}"));
                    continue;
                }
            };

            let dst_file = match std::fs::File::create(dst) {
                Ok(f) => f,
                Err(e) => {
                    errors.push(format!("{name}: {e}"));
                    continue;
                }
            };

            if cancelled.load(Ordering::Relaxed) {
                drop(dst_file);
                let _ = std::fs::remove_file(dst);
                errors.push(format!("{name}: Cancelled"));
                break;
            }

            let mut reader = std::io::BufReader::new(src_file);
            let mut writer = std::io::BufWriter::new(dst_file);
            let mut copied: u64 = 0;
            let mut buf = vec![0u8; 64 * 1024]; // 64 KB chunks
            let mut last_percent = 0u8;

            loop {
                if cancelled.load(Ordering::Relaxed) {
                    drop(writer);
                    let _ = std::fs::remove_file(dst);
                    errors.push(format!("{name}: Cancelled"));
                    break;
                }

                let n = match std::io::Read::read(&mut reader, &mut buf) {
                    Ok(0) => break,
                    Ok(n) => n,
                    Err(e) => {
                        errors.push(format!("{name}: {e}"));
                        break;
                    }
                };

                if let Err(e) = std::io::Write::write_all(&mut writer, &buf[..n]) {
                    errors.push(format!("{name}: {e}"));
                    break;
                }

                copied += n as u64;
                let percent = if total > 0 {
                    ((copied as f64 / total as f64) * 100.0).min(100.0) as u8
                } else {
                    100
                };

                if percent != last_percent || copied == total {
                    last_percent = percent;
                    let _ = app.emit(
                        "copy-progress",
                        serde_json::json!({
                            "operationId": op_id,
                            "source": entry.source,
                            "destination": entry.destination,
                            "copied": copied,
                            "total": total,
                            "percent": percent,
                        }),
                    );
                }
            }
        }
        errors
    })
    .await
    .map_err(|e| format!("Task failed: {e}"))?;

    // Clean up cancel token
    state
        .tokens
        .lock()
        .map_err(|e| e.to_string())?
        .remove(&operation_id);

    Ok(errors)
}

#[derive(Default, Clone, serde::Deserialize)]
struct SshConfig {
    host: String,
    port: u16,
    username: String,
    password: Option<String>,
    private_key: Option<String>,
    passphrase: Option<String>,
}

use std::process::{Child, Command, Stdio};

pub struct LocalSessions {
    pub children: Mutex<HashMap<String, std::process::Child>>,
    pub stdins: Mutex<HashMap<String, std::process::ChildStdin>>,
}

#[tauri::command]
async fn connect_local(
    app_handle: tauri::AppHandle,
    session_id: String,
    shell: Option<String>,
    cols: u16,
    rows: u16,
    state: tauri::State<'_, LocalSessions>,
) -> Result<(), String> {
    let shell_path = shell.unwrap_or_else(|| {
        if cfg!(target_os = "windows") {
            "cmd.exe".to_string()
        } else {
            std::env::var("SHELL").unwrap_or_else(|_| "/bin/sh".to_string())
        }
    });

    let mut cmd = Command::new(&shell_path);
    cmd.stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());

    let mut child = cmd.spawn().map_err(|e| format!("Failed to spawn: {e}"))?;
    let stdin_writer = child.stdin.take().unwrap();
    let mut stdout = child.stdout.take().unwrap();

    let sid = session_id.clone();
    let sid2 = session_id.clone();
    let handle = app_handle.clone();

    // Emit connected event
    let _ = handle.emit(
        "ssh-output",
        serde_json::json!({"sessionId": sid2, "type": "connected", "data": ""}),
    );

    // Spawn thread to read stdout and emit events
    thread::spawn(move || {
        let mut buf = [0u8; 4096];
        loop {
            match stdout.read(&mut buf) {
                Ok(0) => {
                    let _ = handle.emit(
                        "ssh-output",
                        serde_json::json!({"sessionId": sid.clone(), "type": "disconnected", "data": ""}),
                    );
                    break;
                }
                Ok(n) => {
                    let data = String::from_utf8_lossy(&buf[..n]).to_string();
                    let _ = handle.emit(
                        "ssh-output",
                        serde_json::json!({"sessionId": sid.clone(), "type": "output", "data": data}),
                    );
                }
                Err(_) => break,
            }
        }
    });

    // Store stdin writer and child in state
    {
        let mut children = state.children.lock().map_err(|_| "Lock failed")?;
        children.insert(session_id.clone(), child);
        let mut stdins = state.stdins.lock().map_err(|_| "Lock failed")?;
        stdins.insert(session_id.clone(), stdin_writer);
    }

    Ok(())
}

#[tauri::command]
async fn send_input_local(
    session_id: String,
    data: String,
    state: tauri::State<'_, LocalSessions>,
) -> Result<(), String> {
    let stdins = state.stdins.lock().map_err(|_| "Lock failed")?;
    if let Some(mut stdin) = stdins.get(&session_id) {
        // Can't write through immutable reference; need mutable
    }
    // Since mutex guard gives immutable access, drop and re-lock mutably
    drop(stdins);
    let mut stdins = state.stdins.lock().map_err(|_| "Lock failed")?;
    if let Some(mut stdin) = stdins.get_mut(&session_id) {
        stdin.write_all(data.as_bytes()).map_err(|e| e.to_string())?;
        stdin.flush().map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
async fn resize_local(
    session_id: String,
    cols: u16,
    rows: u16,
    _state: tauri::State<'_, LocalSessions>,
) -> Result<(), String> {
    Ok(())
}

#[tauri::command]
async fn disconnect_local(
    session_id: String,
    state: tauri::State<'_, LocalSessions>,
) -> Result<(), String> {
    let mut children = state.children.lock().map_err(|_| "Lock failed")?;
    if let Some(mut child) = children.remove(&session_id) {
        let _ = child.kill();
    }
    let mut stdins = state.stdins.lock().map_err(|_| "Lock failed")?;
    stdins.remove(&session_id);
    Ok(())
}

#[tauri::command]
async fn connect(
    session_id: String,
    config: SshConfig,
    app_handle: tauri::AppHandle,
) -> Result<(), String> {
    // Basic SSH stub: emit connected then a simulated output, then disconnected
    let sid = session_id.clone();
    let handle = app_handle.clone();
    tokio::spawn(async move {
        let _ = handle.emit(
            "ssh-output",
            serde_json::json!({"sessionId": sid.clone(), "type": "connected", "data": ""}),
        );
        tokio::time::sleep(tokio::time::Duration::from_millis(500)).await;
        let _ = handle.emit(
            "ssh-output",
            serde_json::json!({"sessionId": sid.clone(), "type": "output", "data": "\r\nConnected to remote host\r\n"}),
        );
    });
    Ok(())
}

#[tauri::command]
async fn disconnect(
    session_id: String,
) -> Result<(), String> {
    Ok(())
}

#[tauri::command]
async fn send_input(
    session_id: String,
    data: String,
) -> Result<(), String> {
    Ok(())
}

#[tauri::command]
async fn resize(
    session_id: String,
    cols: u16,
    rows: u16,
) -> Result<(), String> {
    Ok(())
}

#[tauri::command]
async fn accept_host_key(
    accepted: bool,
) -> Result<(), String> {
    Ok(())
}

fn get_or_create_device_id() -> String {
    let dirs = dirs::data_local_dir().unwrap_or_else(|| std::path::PathBuf::from("."));
    let path = dirs.join("termvault").join("device_id");
    if let Ok(id) = std::fs::read_to_string(&path) {
        let id = id.trim().to_string();
        if !id.is_empty() {
            return id;
        }
    }
    let id = uuid::Uuid::new_v4().to_string();
    if let Some(parent) = path.parent() {
        let _ = std::fs::create_dir_all(parent);
    }
    let _ = std::fs::write(&path, &id);
    id
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(tauri_plugin_pty::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            let window = app
                .get_webview_window("main")
                .ok_or("main window not found")?;
            window.set_title("TermVault")?;

            let handle = app.handle().clone();
            app.listen("main-ready", move |_| {
                let splash = handle.get_webview_window("splashscreen");
                let main = handle.get_webview_window("main");
                if let Some(s) = splash {
                    let _ = s.close();
                }
                if let Some(m) = main {
                    let _ = m.show();
                }
            });

            Ok(())
        })
        .manage(AppState {
            device_id: get_or_create_device_id(),
            api_url: Mutex::new(None),
        })
        .manage(CancelTokens {
            tokens: Mutex::new(HashMap::new()),
        })
        .manage(LocalSessions {
            children: Mutex::new(HashMap::new()),
            stdins: Mutex::new(HashMap::new()),
        })
        .invoke_handler(tauri::generate_handler![
            get_device_id,
            set_api_url,
            get_api_url,
            write_file,
            detect_shells,
            is_same_volume,
            get_file_size,
            copy_files_with_progress,
            cancel_copy,
            connect_local,
            send_input_local,
            resize_local,
            disconnect_local,
            connect,
            disconnect,
            send_input,
            resize,
            accept_host_key,
        ])
        .run(tauri::generate_context!())
        .unwrap_or_else(|e| {
            eprintln!("Failed to run TermVault: {e}");
            std::process::exit(1);
        });
}
