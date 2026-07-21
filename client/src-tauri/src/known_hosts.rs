use std::fs;
use std::path::PathBuf;
use std::sync::LazyLock;
use std::sync::Mutex;
use serde::Serialize;

/// Path to known_hosts file, set during app initialization
static KNOWN_HOSTS_PATH: LazyLock<Mutex<Option<PathBuf>>> = LazyLock::new(|| Mutex::new(None));

/// Set the known_hosts file path (called during app init)
pub fn set_known_hosts_path(path: PathBuf) {
    if let Ok(mut guard) = KNOWN_HOSTS_PATH.lock() {
        *guard = Some(path);
    }
}

/// Get the known_hosts file path
pub fn get_known_hosts_path() -> Result<PathBuf, String> {
    let guard = KNOWN_HOSTS_PATH.lock().map_err(|e| e.to_string())?;
    guard.clone().ok_or_else(|| "known_hosts path not initialized".to_string())
}

/// Represents a trusted host key entry
#[derive(Debug, Clone, Serialize)]
pub struct KnownHostEntry {
    pub host: String,
    pub port: u16,
    pub fingerprint: String,
}

/// Load known_hosts from file
pub fn load_known_hosts(path: &PathBuf) -> Vec<KnownHostEntry> {
    let mut entries = Vec::new();

    if let Ok(content) = fs::read_to_string(path) {
        for line in content.lines() {
            let line = line.trim();
            if line.is_empty() || line.starts_with('#') {
                continue;
            }

            // Format: host:port fingerprint
            if let Some((host_port, fingerprint)) = line.split_once(' ') {
                if let Some((host, port_str)) = host_port.rsplit_once(':') {
                    if let Ok(port) = port_str.parse::<u16>() {
                        entries.push(KnownHostEntry {
                            host: host.to_string(),
                            port,
                            fingerprint: fingerprint.to_string(),
                        });
                    }
                }
            }
        }
    }

    entries
}

/// Save known_hosts to file
pub fn save_known_hosts(path: &PathBuf, entries: &[KnownHostEntry]) -> Result<(), String> {
    let mut content = String::from("# TermVault known hosts - DO NOT EDIT\n");

    for entry in entries {
        content.push_str(&format!(
            "{}:{} {}\n",
            entry.host, entry.port, entry.fingerprint
        ));
    }

    fs::write(path, content).map_err(|e| format!("Failed to save known_hosts: {}", e))?;

    Ok(())
}

/// Check if a host key is trusted
/// Returns:
/// - Ok(true) if key is trusted (matches or first connection)
/// - Ok(false) if key changed (potential MITM)
/// - Err if file I/O error
pub fn check_host_key(
    path: &PathBuf,
    host: &str,
    port: u16,
    fingerprint: &str,
) -> Result<HostKeyStatus, String> {
    let entries = load_known_hosts(path);

    for entry in &entries {
        if entry.host == host && entry.port == port {
            if entry.fingerprint == fingerprint {
                return Ok(HostKeyStatus::Trusted);
            } else {
                return Ok(HostKeyStatus::Changed {
                    old_fingerprint: entry.fingerprint.clone(),
                });
            }
        }
    }

    Ok(HostKeyStatus::Unknown)
}

/// Trust a host key (add or update)
pub fn trust_host_key(
    path: &PathBuf,
    host: &str,
    port: u16,
    fingerprint: &str,
) -> Result<(), String> {
    let mut entries = load_known_hosts(path);

    // Remove existing entry for this host:port
    entries.retain(|e| !(e.host == host && e.port == port));

    // Add new entry
    entries.push(KnownHostEntry {
        host: host.to_string(),
        port,
        fingerprint: fingerprint.to_string(),
    });

    save_known_hosts(path, &entries)
}

/// Status of a host key check
#[derive(Debug, Clone)]
pub enum HostKeyStatus {
    /// Key is trusted (first connection or matches saved)
    Trusted,
    /// Key has changed (potential MITM attack)
    Changed {
        old_fingerprint: String,
    },
    /// Unknown host (first connection)
    Unknown,
}

// ---- Tauri commands for UI management ----

#[tauri::command]
pub fn list_known_hosts() -> Result<Vec<KnownHostEntry>, String> {
    let path = get_known_hosts_path()?;
    Ok(load_known_hosts(&path))
}

#[tauri::command]
pub fn remove_known_host(host: String, port: u16) -> Result<(), String> {
    let path = get_known_hosts_path()?;
    let mut entries = load_known_hosts(&path);
    entries.retain(|e| !(e.host == host && e.port == port));
    save_known_hosts(&path, &entries)
}

#[tauri::command]
pub fn clear_known_hosts() -> Result<(), String> {
    let path = get_known_hosts_path()?;
    save_known_hosts(&path, &[])
}
