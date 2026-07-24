#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::sync::Mutex;
use tauri::Manager;

pub struct AppState {
    pub device_id: String,
    pub api_url: Mutex<Option<String>>,
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
fn detect_shells() -> Vec<ShellInfo> {
    detect_shells_platform()
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
            Ok(())
        })
        .manage(AppState {
            device_id: get_or_create_device_id(),
            api_url: Mutex::new(None),
        })
        .invoke_handler(tauri::generate_handler![
            get_device_id,
            set_api_url,
            get_api_url,
            write_file,
            detect_shells,
        ])
        .run(tauri::generate_context!())
        .unwrap_or_else(|e| {
            eprintln!("Failed to run TermVault: {e}");
            std::process::exit(1);
        });
}
