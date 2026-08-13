# Real SSH Connect + OS Detection + Ping — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the stub `connect` with a real `russh` SSH engine (password + private-key auth, TOFU host keys), add distro-level OS auto-detection (save-time, connect-time, ping button) with colored OS icons, and add a host-card ping button.

**Architecture:** Pure-Rust async SSH (`russh`) in a new `client/src-tauri/src/ssh.rs` module — one tokio task per session driven by a command mpsc channel, `known_hosts` TOFU file in app data, `uname`+`/etc/os-release` probe mapping to canonical OS ids, frontend zustand ping store + typed TSX OS icon components.

**Tech Stack:** Tauri v2, Rust (tokio, russh 0.54, russh-keys), React 19, zustand, vitest, @phosphor-icons/react.

## Global Constraints

- pnpm only — never npm. (Client commands run from `client/`.)
- Rust edition 2021; cargo build must stay warning-free only where pre-existing (BTreeMap, Child/Command/Stdio, KeyInit, unused sid, GenericArray deprecation are pre-existing — do not fix).
- `biome.json` enforces single quotes, 2-space indent, no unused imports.
- Baseline tests that must keep passing: `cargo test` (44), `pnpm vitest` (133).
- Only new cargo deps allowed: `russh`, `russh-keys`. No new npm deps.
- Tauri v2 converts invoke argument keys camelCase↔snake_case automatically.
- All work in `client/` is committed in the client submodule (its own git repo). The superproject pointer is bumped only in Task 8.
- Server repo untouched.

---

### Task 1: Rust — known_hosts TOFU store + OS detection mapping

**Files:**
- Modify: `client/src-tauri/Cargo.toml`
- Create: `client/src-tauri/src/ssh.rs`
- Modify: `client/src-tauri/src/lib.rs` (`mod ssh;`)

**Interfaces:**
- Consumes: nothing (self-contained).
- Produces: `ssh::KnownHosts`, `ssh::HostKeyStatus`, `ssh::KnownHosts::load(path)`, `.check(host, port, fp) -> HostKeyStatus`, `.accept(host, port, fp)`, `.get_fingerprint(host, port) -> Option<String>`, `ssh::detect_os(uname: &str, os_release: &str) -> Option<&'static str>`, `ssh::fingerprint_of(&ssh_key::PublicKey) -> String`.

- [ ] **Step 1: Add russh dependencies**

`client/src-tauri/Cargo.toml` — add under `[dependencies]`:

```toml
russh = { version = "0.54", default-features = false, features = ["crypto-rust", "ssh-keys"] }
russh-keys = "0.54"
```

Note: if `cargo check` later fails because `russh::keys` is missing (feature renamed), add `"ssh-keys"` variant noted above — the compile error names the expected feature.

- [ ] **Step 2: Write the failing tests** (`client/src-tauri/src/ssh.rs` — tests at the bottom of the same file)

```rust
#[cfg(test)]
mod tests {
    use super::*;
    use std::time::{SystemTime, UNIX_EPOCH};

    fn tmp_path() -> std::path::PathBuf {
        let stamp = SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_nanos();
        std::env::temp_dir().join(format!("termvault-known-hosts-{stamp}.txt"))
    }

    #[test]
    fn os_detection_maps_platforms() {
        assert_eq!(detect_os("Linux", ""), Some("linux"));
        assert_eq!(detect_os("Darwin", ""), Some("darwin"));
        assert_eq!(detect_os("FreeBSD", ""), Some("bsd"));
        assert_eq!(detect_os("OpenBSD", ""), Some("bsd"));
        assert_eq!(detect_os("SunOS", ""), Some("solaris"));
        assert_eq!(detect_os("MINGW64_NT-10.0-26100", ""), Some("windows"));
        assert_eq!(detect_os("CYGWIN_NT-6.1", ""), Some("windows"));
        assert_eq!(detect_os("MSYS_NT-10.0", ""), Some("windows"));
        assert_eq!(detect_os("HP-UX", ""), None);
    }

    #[test]
    fn os_detection_parses_os_release_ids() {
        assert_eq!(detect_os("Linux", "ID=ubuntu\nVERSION_ID=24.04\n"), Some("ubuntu"));
        assert_eq!(detect_os("Linux", "ID=linuxmint\nID_LIKE=\"ubuntu debian\"\n"), Some("linuxmint"));
        assert_eq!(detect_os("Linux", "ID=pop\nID_LIKE=ubuntu\n"), Some("pop"));
        assert_eq!(detect_os("Linux", "ID=opensuse-leap\n"), Some("opensuse"));
        assert_eq!(detect_os("Linux", "ID=amzn\n"), Some("amazon"));
        assert_eq!(detect_os("Linux", "ID=someweirdos\nID_LIKE=debian\n"), Some("debian"));
        assert_eq!(detect_os("Linux", "ID=someweirdos\n"), Some("linux"));
        assert_eq!(detect_os("Linux", ""), Some("linux"));
    }

    #[test]
    fn known_hosts_tofu_flow() {
        let path = tmp_path();
        let mut kh = KnownHosts::load(&path);
        assert_eq!(kh.check("web", 22, "fp-a"), HostKeyStatus::Unknown);
        kh.accept("web", 22, "fp-a");
        assert_eq!(kh.check("web", 22, "fp-a"), HostKeyStatus::Known);
        assert_eq!(kh.check("web", 22, "fp-b"), HostKeyStatus::Changed);
        assert_eq!(kh.get_fingerprint("web", 22), Some("fp-a".to_string()));
        // same host different port is a separate entry
        assert_eq!(kh.check("web", 2222, "fp-a"), HostKeyStatus::Unknown);
        let _ = std::fs::remove_file(&path);
    }

    #[test]
    fn known_hosts_persists_and_skips_corrupt_lines() {
        let path = tmp_path();
        std::fs::write(&path, "web|22|fp-a\ncorrupt-line-no-separators\nmail|25|fp-b\n").unwrap();
        let kh = KnownHosts::load(&path);
        assert_eq!(kh.check("web", 22, "fp-a"), HostKeyStatus::Known);
        assert_eq!(kh.check("mail", 25, "fp-b"), HostKeyStatus::Known);
        // corrupt line is skipped, no crash
        kh.accept("web", 22, "fp-c");
        let reloaded = KnownHosts::load(&path);
        assert_eq!(reloaded.check("web", 22, "fp-c"), HostKeyStatus::Known);
        let _ = std::fs::remove_file(&path);
    }
}
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `cargo test os_detection_maps_platforms os_detection_parses_os_release_ids known_hosts_tofu_flow known_hosts_persists_and_skips_corrupt_lines --manifest-path Cargo.toml`
Expected: error "unresolved import `super::KnownHosts`" / "function `detect_os` is private" — the module does not exist yet.

- [ ] **Step 4: Implement the module** — create `client/src-tauri/src/ssh.rs`:

```rust
use std::path::{Path, PathBuf};
use std::sync::Mutex;

pub struct KnownHosts {
    path: PathBuf,
    entries: Vec<KnownHostEntry>,
}

struct KnownHostEntry {
    host: String,
    port: u16,
    fingerprint: String,
}

#[derive(PartialEq, Debug)]
pub enum HostKeyStatus {
    Unknown,
    Known,
    Changed,
}

impl KnownHosts {
    pub fn load(path: &Path) -> Self {
        let entries = std::fs::read_to_string(path)
            .map(|contents| {
                contents
                    .lines()
                    .filter_map(|line| {
                        let mut parts = line.split('|');
                        let host = parts.next()?;
                        let port = parts.next()?.parse::<u16>().ok()?;
                        let fingerprint = parts.next()?.to_string();
                        if host.is_empty() || fingerprint.is_empty() {
                            return None;
                        }
                        Some(KnownHostEntry { host: host.to_string(), port, fingerprint })
                    })
                    .collect()
            })
            .unwrap_or_default();
        Self { path: path.to_path_buf(), entries }
    }

    pub fn check(&self, host: &str, port: u16, fingerprint: &str) -> HostKeyStatus {
        let mut saw_entry = false;
        for entry in &self.entries {
            if entry.host == host && entry.port == port {
                saw_entry = true;
                if entry.fingerprint == fingerprint {
                    return HostKeyStatus::Known;
                }
            }
        }
        if saw_entry {
            HostKeyStatus::Changed
        } else {
            HostKeyStatus::Unknown
        }
    }

    pub fn get_fingerprint(&self, host: &str, port: u16) -> Option<String> {
        self.entries
            .iter()
            .find(|e| e.host == host && e.port == port)
            .map(|e| e.fingerprint.clone())
    }

    pub fn accept(&mut self, host: &str, port: u16, fingerprint: &str) {
        self.entries.retain(|e| !(e.host == host && e.port == port));
        self.entries.push(KnownHostEntry {
            host: host.to_string(),
            port,
            fingerprint: fingerprint.to_string(),
        });
        let contents = self
            .entries
            .iter()
            .map(|e| format!("{}|{}|{}", e.host, e.port, e.fingerprint))
            .collect::<Vec<_>>()
            .join("\n");
        if let Some(parent) = self.path.parent() {
            let _ = std::fs::create_dir_all(parent);
        }
        let _ = std::fs::write(&self.path, contents);
    }
}

const KNOWN_OS_IDS: &[(&str, &str)] = &[
    ("ubuntu", "ubuntu"),
    ("debian", "debian"),
    ("fedora", "fedora"),
    ("arch", "arch"),
    ("manjaro", "manjaro"),
    ("linuxmint", "linuxmint"),
    ("pop", "pop"),
    ("kali", "kali"),
    ("alpine", "alpine"),
    ("centos", "centos"),
    ("rocky", "rocky"),
    ("alma", "alma"),
    ("rhel", "rhel"),
    ("amzn", "amazon"),
    ("opensuse", "opensuse"),
    ("opensuse-leap", "opensuse"),
    ("opensuse-tumbleweed", "opensuse"),
    ("sles", "sles"),
    ("nixos", "nixos"),
    ("gentoo", "gentoo"),
    ("zorin", "zorin"),
    ("elementary", "elementary"),
    ("ol", "oracle"),
    ("oraclelinux", "oracle"),
];

pub fn detect_os(uname: &str, os_release: &str) -> Option<&'static str> {
    let uname = uname.trim();
    if uname.contains("Darwin") {
        return Some("darwin");
    }
    if uname.contains("FreeBSD") || uname.contains("OpenBSD") || uname.contains("NetBSD") {
        return Some("bsd");
    }
    if uname.contains("SunOS") {
        return Some("solaris");
    }
    if uname.contains("MINGW") || uname.contains("MSYS") || uname.contains("CYGWIN") {
        return Some("windows");
    }
    if !uname.contains("Linux") {
        return None;
    }
    let id = os_release
        .lines()
        .find_map(|line| {
            let line = line.trim();
            let (key, value) = line.split_once('=')?;
            if key == "ID" {
                Some(value.trim_matches('"').trim().to_lowercase())
            } else {
                None
            }
        })
        .unwrap_or_default();
    if let Some(canonical) = canonical_os_id(&id) {
        return Some(canonical);
    }
    let id_like = os_release
        .lines()
        .find_map(|line| {
            let line = line.trim();
            let (key, value) = line.split_once('=')?;
            if key == "ID_LIKE" {
                Some(value.trim_matches('"').trim().to_lowercase())
            } else {
                None
            }
        })
        .unwrap_or_default();
    let first = id_like.split_whitespace().next().unwrap_or_default();
    if let Some(canonical) = canonical_os_id(first) {
        return Some(canonical);
    }
    Some("linux")
}

fn canonical_os_id(id: &str) -> Option<&'static str> {
    KNOWN_OS_IDS
        .iter()
        .find(|(raw, _)| *raw == id)
        .map(|(_, canonical)| *canonical)
}

pub fn fingerprint_of(server_public_key: &russh::keys::key::PublicKey) -> String {
    server_public_key.fingerprint(russh::keys::key::HashAlg::Sha256).to_string()
}

pub struct PendingHostKeyGuard {
    pending: std::sync::Arc<Mutex<Vec<tokio::sync::oneshot::Sender<bool>>>>,
}
```

- [ ] **Step 5: Register the module** — in `client/src-tauri/src/lib.rs` line 2-8 module block:

```rust
mod ssh;
```

(Add `mod ssh;` next to the other `mod` declarations.)

- [ ] **Step 6: Run tests to verify they pass**

Run: `cargo test --manifest-path Cargo.toml`
Expected: the 4 new tests pass; all 44 existing tests still pass (cargo may need to fetch/compile russh first).

- [ ] **Step 7: Commit**

```bash
git add src-tauri/Cargo.toml src-tauri/src/ssh.rs src-tauri/src/lib.rs
git commit -m "feat(ssh): known_hosts tofu store + os detection mapping"
```

---

### Task 2: Rust — russh session engine + command wiring

**Files:**
- Modify: `client/src-tauri/src/ssh.rs`
- Modify: `client/src-tauri/src/lib.rs`

**Interfaces:**
- Consumes: Task 1 (`KnownHosts`, `HostKeyStatus`, `detect_os`, `fingerprint_of`).
- Produces: `ssh::SshSessions::new(path)`, `ssh::SshConfig { host, port, username, password, private_key, passphrase, detect_os }`, commands `ssh::connect`, `ssh::disconnect`, `ssh::send_input`, `ssh::resize`, `ssh::accept_host_key`, `ssh::ping_host -> PingResult { reachable, latency_ms, os }`.

- [ ] **Step 1: Add the engine to `ssh.rs`** — append (replacing the module-level `PendingHostKeyGuard` sketch from Task 1 if present):

```rust
use serde::Deserialize;
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::{mpsc, oneshot};
use tauri::Emitter;

pub const KNOWN_HOSTS_FILE: &str = "known_hosts";

#[derive(Default, Clone, Deserialize)]
#[serde(default)]
pub struct SshConfig {
    pub host: String,
    pub port: u16,
    pub username: String,
    pub password: Option<String>,
    pub private_key: Option<String>,
    pub passphrase: Option<String>,
    pub detect_os: bool,
}

#[derive(serde::Serialize)]
pub struct PingResult {
    pub reachable: bool,
    pub latency_ms: Option<u64>,
    pub os: Option<String>,
}

enum SessionCmd {
    Input(Vec<u8>),
    Resize(u32, u32),
    Close,
}

pub struct SshSessions {
    pub sessions: Mutex<HashMap<String, mpsc::Sender<SessionCmd>>>,
    pub pending_keys: Arc<Mutex<Vec<oneshot::Sender<bool>>>>,
    pub known_hosts: Arc<Mutex<KnownHosts>>,
}

impl SshSessions {
    pub fn new(data_dir: PathBuf) -> Self {
        Self {
            sessions: Mutex::new(HashMap::new()),
            pending_keys: Arc::new(Mutex::new(Vec::new())),
            known_hosts: Arc::new(Mutex::new(KnownHosts::load(&data_dir.join(KNOWN_HOSTS_FILE)))),
        }
    }
}

struct SshHandler {
    host: String,
    port: u16,
    app: tauri::AppHandle,
    known_hosts: Arc<Mutex<KnownHosts>>,
    pending_keys: Arc<Mutex<Vec<oneshot::Sender<bool>>>>,
    auto_accept: bool,
}

impl russh::client::Handler for SshHandler {
    type Error = russh::Error;

    async fn check_server_key(
        &mut self,
        server_public_key: &russh::keys::key::PublicKey,
    ) -> Result<bool, Self::Error> {
        let fingerprint = fingerprint_of(server_public_key);
        let (host, port) = (self.host.clone(), self.port);
        let known = {
            let kh = self
                .known_hosts
                .lock()
                .map_err(|_| std::io::Error::other("known_hosts lock poisoned").into())?;
            kh.check(&host, port, &fingerprint)
        };
        match known {
            HostKeyStatus::Unknown => {
                self.known_hosts
                    .lock()
                    .map_err(|_| std::io::Error::other("known_hosts lock poisoned").into())?
                    .accept(&host, port, &fingerprint);
                return Ok(true);
            }
            HostKeyStatus::Known => return Ok(true),
            HostKeyStatus::Changed => {
                if self.auto_accept {
                    return Ok(false);
                }
            }
        }
        let old = self
            .known_hosts
            .lock()
            .map_err(|_| std::io::Error::other("known_hosts lock poisoned").into())?
            .get_fingerprint(&host, port);
        let (tx, rx) = oneshot::channel();
        self.pending_keys
            .lock()
            .map_err(|_| std::io::Error::other("pending_keys lock poisoned").into())?
            .push(tx);
        let _ = self.app.emit(
            "ssh-host-key-changed",
            serde_json::json!({
                "host": host,
                "port": port,
                "oldFingerprint": old.unwrap_or_default(),
                "newFingerprint": fingerprint,
            }),
        );
        match rx.await {
            Ok(true) => {
                self.known_hosts
                    .lock()
                    .map_err(|_| std::io::Error::other("known_hosts lock poisoned").into())?
                    .accept(&host, port, &fingerprint);
                Ok(true)
            }
            _ => Ok(false),
        }
    }
}

async fn resolve_addr(host: &str, port: u16) -> Result<std::net::SocketAddr, String> {
    tokio::net::lookup_host((host, port))
        .await
        .map_err(|e| format!("dns lookup {host}:{port}: {e}"))?
        .next()
        .ok_or_else(|| format!("no address for {host}:{port}"))
}

async fn connect_authenticated(
    handler: SshHandler,
    config: &SshConfig,
) -> Result<russh::client::Handle<SshHandler>, String> {
    let addr = resolve_addr(&config.host, config.port).await?;
    let client_config = russh::client::Config::default();
    let mut session = tokio::time::timeout(
        std::time::Duration::from_secs(10),
        russh::client::connect(client_config, addr, handler),
    )
    .await
    .map_err(|_| format!("connection timeout to {}:{}", config.host, config.port))?
    .map_err(|e| format!("connect {}:{}: {e}", config.host, config.port))?;

    if let Some(pem) = config.private_key.as_deref() {
        let key = russh::keys::decode_secret_key(pem, config.passphrase.as_deref())
            .map_err(|e| format!("decode private key: {e}"))?;
        let key_with_alg = russh::keys::key::PrivateKeyWithHashAlg::new(
            key,
            russh::keys::key::HashAlg::Sha256,
        )
        .map_err(|e| format!("prepare private key: {e}"))?;
        let accepted = session
            .authenticate_publickey(&config.username, key_with_alg)
            .await
            .map_err(|e| format!("publickey auth: {e}"))?;
        if !accepted {
            return Err("public key authentication rejected".to_string());
        }
    } else {
        let accepted = session
            .authenticate_password(
                &config.username,
                config.password.as_deref().unwrap_or(""),
            )
            .await
            .map_err(|e| format!("password auth: {e}"))?;
        if !accepted {
            return Err("password authentication rejected".to_string());
        }
    }
    Ok(session)
}

async fn probe_os(
    app: tauri::AppHandle,
    config: &SshConfig,
    known_hosts: Arc<Mutex<KnownHosts>>,
    pending_keys: Arc<Mutex<Vec<oneshot::Sender<bool>>>>,
) -> Option<String> {
    let handler = SshHandler {
        host: config.host.clone(),
        port: config.port,
        app,
        known_hosts,
        pending_keys,
        auto_accept: true,
    };
    let mut session = connect_authenticated(handler, config).await.ok()?;
    let mut channel = session.channel_open_session().await.ok()?;
    channel
        .exec(
            true,
            "uname -s; echo __TERMVAULT_OS_RELEASE__; cat /etc/os-release 2>/dev/null; cat /usr/lib/os-release 2>/dev/null",
        )
        .await
        .ok()?;
    let mut out = String::new();
    while let Some(msg) = channel.wait().await {
        match msg {
            russh::ChannelMsg::Data(data) => out.push_str(&String::from_utf8_lossy(&data)),
            russh::ChannelMsg::Eof | russh::ChannelMsg::Close => break,
            _ => {}
        }
    }
    let (uname, os_release) = match out.split_once("__TERMVAULT_OS_RELEASE__") {
        Some((a, b)) => (a, b),
        None => return None,
    };
    detect_os(uname, os_release).map(|os| os.to_string())
}

#[tauri::command]
pub async fn connect(
    app_handle: tauri::AppHandle,
    session_id: String,
    config: SshConfig,
    state: tauri::State<'_, SshSessions>,
) -> Result<(), String> {
    let known_hosts = Arc::clone(&state.known_hosts);
    let pending_keys = Arc::clone(&state.pending_keys);
    let sid = session_id.clone();
    tokio::spawn(async move {
        let emit = |app: &tauri::AppHandle, type_: &str, data: &str| {
            let _ = app.emit(
                "ssh-output",
                serde_json::json!({ "sessionId": sid.clone(), "type": type_, "data": data }),
            );
        };

        let os = if config.detect_os {
            probe_os(app_handle.clone(), &config, Arc::clone(&known_hosts), Arc::clone(&pending_keys)).await
        } else {
            None
        };

        let handler = SshHandler {
            host: config.host.clone(),
            port: config.port,
            app: app_handle.clone(),
            known_hosts: Arc::clone(&known_hosts),
            pending_keys: Arc::clone(&pending_keys),
            auto_accept: false,
        };

        let mut session = match connect_authenticated(handler, &config).await {
            Ok(s) => s,
            Err(e) => {
                emit(&app_handle, "error", &e);
                emit(&app_handle, "disconnected", "");
                return;
            }
        };

        let mut channel = match session.channel_open_session().await {
            Ok(c) => c,
            Err(e) => {
                emit(&app_handle, "error", &e.to_string());
                emit(&app_handle, "disconnected", "");
                return;
            }
        };
        if let Err(e) = channel
            .request_pty(
                true,
                &russh::Pty {
                    term: "xterm",
                    char_width: 80,
                    char_height: 24,
                    pix_width: 0,
                    pix_height: 0,
                },
            )
            .and_then(|()| channel.request_shell())
        {
            emit(&app_handle, "error", &e.to_string());
            emit(&app_handle, "disconnected", "");
            return;
        }

        let (tx, mut rx) = mpsc::channel::<SessionCmd>(32);
        {
            let mut sessions = match state.sessions.lock() {
                Ok(g) => g,
                Err(_) => return,
            };
            sessions.insert(session_id.clone(), tx);
        }

        let _ = app_handle.emit(
            "ssh-output",
            serde_json::json!({
                "sessionId": session_id.clone(),
                "type": "connected",
                "data": "",
                "os": os,
            }),
        );

        loop {
            tokio::select! {
                msg = channel.wait() => {
                    let Some(msg) = msg else { break };
                    match msg {
                        russh::ChannelMsg::Data(data) => {
                            let text = String::from_utf8_lossy(&data);
                            if !text.is_empty() {
                                emit(&app_handle, "output", &text);
                            }
                        }
                        russh::ChannelMsg::Eof | russh::ChannelMsg::Close => break,
                        _ => {}
                    }
                }
                cmd = rx.recv() => {
                    match cmd {
                        Some(SessionCmd::Input(bytes)) => {
                            let _ = channel.data(&bytes).await;
                        }
                        Some(SessionCmd::Resize(cols, rows)) => {
                            let _ = channel.request_pty_window_change(cols, rows, 0, 0);
                        }
                        Some(SessionCmd::Close) | None => break,
                    }
                }
            }
        }

        let _ = state.sessions.lock().map(|mut g| g.remove(&session_id));
        emit(&app_handle, "disconnected", "");
        // session handle drops here → connection closed
    });
    Ok(())
}

#[tauri::command]
pub async fn send_input(
    session_id: String,
    data: String,
    state: tauri::State<'_, SshSessions>,
) -> Result<(), String> {
    let sessions = state.sessions.lock().map_err(|e| e.to_string())?;
    if let Some(tx) = sessions.get(&session_id) {
        tx.send(SessionCmd::Input(data.into_bytes()))
            .await
            .map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
pub async fn resize(
    session_id: String,
    cols: u16,
    rows: u16,
    state: tauri::State<'_, SshSessions>,
) -> Result<(), String> {
    let sessions = state.sessions.lock().map_err(|e| e.to_string())?;
    if let Some(tx) = sessions.get(&session_id) {
        tx.send(SessionCmd::Resize(cols as u32, rows as u32))
            .await
            .map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
pub async fn disconnect(
    session_id: String,
    state: tauri::State<'_, SshSessions>,
) -> Result<(), String> {
    let tx = {
        let mut sessions = state.sessions.lock().map_err(|e| e.to_string())?;
        sessions.remove(&session_id)
    };
    if let Some(tx) = tx {
        let _ = tx.send(SessionCmd::Close).await;
    }
    Ok(())
}

#[tauri::command]
pub async fn accept_host_key(
    accepted: bool,
    state: tauri::State<'_, SshSessions>,
) -> Result<(), String> {
    let senders = std::mem::take(&mut *state.pending_keys.lock().map_err(|e| e.to_string())?);
    for tx in senders {
        let _ = tx.send(accepted);
    }
    Ok(())
}

#[tauri::command]
pub async fn ping_host(
    app_handle: tauri::AppHandle,
    config: SshConfig,
    timeout_ms: Option<u64>,
    state: tauri::State<'_, SshSessions>,
) -> Result<PingResult, String> {
    let timeout = std::time::Duration::from_millis(timeout_ms.unwrap_or(2000));
    let start = std::time::Instant::now();
    let addr = resolve_addr(&config.host, config.port).await?;
    let connected = tokio::time::timeout(timeout, tokio::net::TcpStream::connect(addr)).await;
    match connected {
        Ok(Ok(_)) => {}
        _ => {
            return Ok(PingResult { reachable: false, latency_ms: None, os: None });
        }
    }
    let latency_ms = start.elapsed().as_millis() as u64;
    let os = probe_os(
        app_handle,
        &config,
        Arc::clone(&state.known_hosts),
        Arc::clone(&state.pending_keys),
    )
    .await;
    Ok(PingResult { reachable: true, latency_ms: Some(latency_ms), os })
}
```

Compile-fallback notes (only if the pinned 0.54 API differs): `ChannelMsg::Data` holds `CryptoVec` (derefs to `[u8]`) — if the variant is `Data { data }`, match accordingly; if `request_pty_window_change` is async, await it; `request_pty`+`request_shell` — chain with `and_then` only if both are sync (`Result<(), E>`), otherwise call them as separate `if let Err` statements.

- [ ] **Step 2: Remove the stubs and wire the commands** in `client/src-tauri/src/lib.rs`

1. Delete the `SshConfig` struct (lines ~521-529), the four stub commands `connect`, `disconnect`, `send_input`, `resize`, `accept_host_key` (lines ~738-790), and `use std::process::{Child, Command, Stdio};` if it becomes unused (check first — `Child`/`Command`/`Stdio` were pre-existing warnings; keep the import only if still referenced, otherwise delete it).
2. In `run()`, register the state next to `.manage(LocalSessions {...})`:

```rust
.manage(ssh::SshSessions::new(
    dirs::data_local_dir()
        .unwrap_or_else(|| std::path::PathBuf::from("."))
        .join("termvault"),
))
```

3. In the `invoke_handler!` list, replace `connect, disconnect, send_input, resize, accept_host_key,` with:

```rust
ssh::connect,
ssh::disconnect,
ssh::send_input,
ssh::resize,
ssh::accept_host_key,
ssh::ping_host,
```

- [ ] **Step 3: Build and run existing tests**

Run: `cargo check --manifest-path Cargo.toml` then `cargo test --manifest-path Cargo.toml`
Expected: clean check; 48 tests pass (44 existing + 4 new).

- [ ] **Step 4: Commit**

```bash
git add src-tauri/src/ssh.rs src-tauri/src/lib.rs
git commit -m "feat(ssh): real russh sessions, tofu prompt, ping command"
```

---

### Task 3: Frontend — connect payload gets detect_os

**Files:**
- Modify: `client/src/lib/terminal/sessionManager.ts`

**Interfaces:**
- Consumes: `SshConfig.detect_os` from Task 2.
- Produces: `detect_os: boolean` inside the `connect` config (true only when the host row has no `os`).

- [ ] **Step 1: Edit `connectViaTauri`** — inside `connectViaTauri(session)`, after the credential blocks (after line 128), insert:

```ts
const hostOs = params.hostId
  ? useHostStore.getState().hosts.find((h) => h.id === params.hostId)?.os
  : undefined;
```

Then change the `config` object (lines 130-137) to:

```ts
const config = {
  host: hostAddress || "",
  port: hostPort || 22,
  username: hostUsername || "root",
  password,
  privateKey,
  passphrase,
  detectOs: !hostOs,
};
```

- [ ] **Step 2: Verify**

Run: `pnpm biome check src/lib/terminal/sessionManager.ts` and `pnpm vitest run` (must stay 133 pass; sessionManager is untested, this is a smoke check).
Expected: no biome errors, 133 passing.

- [ ] **Step 3: Commit**

```bash
git add src/lib/terminal/sessionManager.ts
git commit -m "feat(ssh): request os detection on connect when host os unknown"
```

---

### Task 4: Frontend — background OS probe after host save

**Files:**
- Modify: `client/src/stores/hosts/hostStore.ts`
- Modify: `client/src/stores/hosts/hostStore.test.ts`

**Interfaces:**
- Consumes: `ping_host` command from Task 2.
- Produces: module-private `probeHostOs(hostId: string): Promise<void>` (fire-and-forget, all errors swallowed).

- [ ] **Step 1: Write the failing tests** — append to `hostStore.test.ts`:

```ts
describe("post-save os probe", () => {
  it("createHost fires a background probe and persists the detected os", async () => {
    mockUpsert.mockResolvedValue({
      id: "h1",
      revision: 1,
      vault_id: "v1",
      created_at: 1000,
      updated_at: 1000,
      deleted_at: null,
      name: "x",
      os: null,
      sort_order: 0,
      data: "enc",
      tags: "[]",
    });
    mockDecrypt.mockResolvedValue({
      address: "1.2.3.4",
      port: 22,
      username: "root",
      password: "pw",
    });
    const { invoke } = await import("@tauri-apps/api/core");
    vi.mocked(invoke).mockResolvedValue({
      reachable: true,
      latency_ms: 12,
      os: "ubuntu",
    });
    useVaultStore.setState({ currentVaultId: "v1" });
    await useHostStore
      .getState()
      .createHost({ name: "x", address: "1.2.3.4", port: 22, username: "root", password: "pw" });
    await vi.waitFor(() => {
      expect(invoke).toHaveBeenCalledWith("ping_host", expect.anything());
    });
    const config = vi.mocked(invoke).mock.calls[0]?.[1] as { config: Record<string, unknown> };
    expect(config.config.host).toBe("1.2.3.4");
    expect(config.config.port).toBe(22);
    expect(config.config.username).toBe("root");
    expect(config.config.password).toBe("pw");
    await vi.waitFor(() => {
      expect(useHostStore.getState().hosts[0]?.os).toBe("ubuntu");
    });
  });

  it("swallows probe failures without setting an error", async () => {
    mockUpsert.mockResolvedValue({
      id: "h2",
      revision: 1,
      vault_id: "v1",
      created_at: 1000,
      updated_at: 1000,
      deleted_at: null,
      name: "y",
      os: null,
      sort_order: 0,
      data: "enc",
      tags: "[]",
    });
    mockDecrypt.mockResolvedValue({
      address: "9.9.9.9",
      port: 22,
      username: "root",
      password: "pw",
    });
    const { invoke } = await import("@tauri-apps/api/core");
    vi.mocked(invoke).mockRejectedValue(new Error("boom"));
    await useHostStore.getState().createHost({ name: "y", address: "9.9.9.9" });
    await vi.waitFor(() => {
      expect(invoke).toHaveBeenCalled();
    });
    expect(useHostStore.getState().error).toBeNull();
  });
});
```

Add the `@tauri-apps/api/core` mock at the top of the file (after the existing mocks):

```ts
vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm vitest run src/stores/hosts/hostStore.test.ts`
Expected: FAIL — `ping_host` never invoked (probe not implemented).

- [ ] **Step 3: Implement the probe** in `hostStore.ts`:

```ts
async function probeHostOs(hostId: string): Promise<void> {
  try {
    const { invoke } = await import("@tauri-apps/api/core");
    const hostStore = useHostStore.getState();
    const host = await hostStore.getDecryptedHost(hostId);
    if (!host || !host.address) return;
    const creds = await hostStore.getCredentialsForHost(hostId);
    const result = await invoke<{
      reachable: boolean;
      latency_ms: number | null;
      os: string | null;
    }>("ping_host", {
      config: {
        host: host.address,
        port: host.port,
        username: host.username ?? "root",
        password: creds.password,
        privateKey: creds.privateKey,
        passphrase: creds.passphrase,
      },
    });
    if (result.os) {
      await hostStore.updateHostOs(hostId, result.os);
    }
  } catch {
    // Silent — connect-time detection covers failures
  }
}
```

Call it after the `set({ hosts: [created, ...get().hosts], isLoading: false });` in `createHost` and after the `set({ hosts: ... map ... })` in `updateHost`:

```ts
void probeHostOs(created.id);
```

(respectively `void probeHostOs(id);` in `updateHost`).

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm vitest run` and `pnpm biome check src/stores/hosts/hostStore.ts src/stores/hosts/hostStore.test.ts`
Expected: 135 passing; no biome errors.

- [ ] **Step 5: Commit**

```bash
git add src/stores/hosts/hostStore.ts src/stores/hosts/hostStore.test.ts
git commit -m "feat(hosts): background os probe after create/update"
```

---

### Task 5: Frontend — hostPingStore

**Files:**
- Create: `client/src/stores/hosts/hostPingStore.ts`
- Create: `client/src/stores/hosts/hostPingStore.test.ts`

**Interfaces:**
- Consumes: `ping_host`, `useHostStore.getDecryptedHost/getCredentialsForHost/updateHostOs`.
- Produces: `useHostPingStore` with state `pings: Record<string, PingState>` and actions `ping(hostId)`, `clear(hostId?)`. `PingState = { status: "pinging" | "reachable" | "unreachable"; latencyMs?: number; os?: string }`.

- [ ] **Step 1: Write the failing test** — create `hostPingStore.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

const mockHostStore = {
  getDecryptedHost: vi.fn(),
  getCredentialsForHost: vi.fn(),
  updateHostOs: vi.fn(),
};

vi.mock("./hostStore", () => ({
  useHostStore: { getState: () => mockHostStore },
}));

import { useHostPingStore } from "./hostPingStore";

const mockInvoke = vi.mocked(
  (await import("@tauri-apps/api/core")).invoke as unknown as ReturnType<typeof vi.fn>,
);

describe("hostPingStore", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useHostPingStore.setState({ pings: {} });
    mockHostStore.getDecryptedHost.mockResolvedValue({
      address: "1.2.3.4",
      port: 22,
      username: "root",
    });
    mockHostStore.getCredentialsForHost.mockResolvedValue({
      password: "pw",
      privateKey: "",
      passphrase: "",
    });
  });

  it("reachable result stores latency, saves os, updates host", async () => {
    mockInvoke.mockResolvedValue({ reachable: true, latency_ms: 23, os: "ubuntu" });
    await useHostPingStore.getState().ping("h1");
    const ping = useHostPingStore.getState().pings.h1;
    expect(ping.status).toBe("reachable");
    expect(ping.latencyMs).toBe(23);
    expect(ping.os).toBe("ubuntu");
    expect(mockHostStore.updateHostOs).toHaveBeenCalledWith("h1", "ubuntu");
  });

  it("unreachable result never calls updateHostOs", async () => {
    mockInvoke.mockResolvedValue({ reachable: false, latency_ms: null, os: null });
    await useHostPingStore.getState().ping("h1");
    expect(useHostPingStore.getState().pings.h1.status).toBe("unreachable");
    expect(mockHostStore.updateHostOs).not.toHaveBeenCalled();
  });

  it("host without address is unreachable without invoking", async () => {
    mockHostStore.getDecryptedHost.mockResolvedValue(null);
    await useHostPingStore.getState().ping("h1");
    expect(useHostPingStore.getState().pings.h1.status).toBe("unreachable");
    expect(mockInvoke).not.toHaveBeenCalled();
  });

  it("invoke failure degrades to unreachable", async () => {
    mockInvoke.mockRejectedValue(new Error("boom"));
    await useHostPingStore.getState().ping("h1");
    expect(useHostPingStore.getState().pings.h1.status).toBe("unreachable");
  });
});
```

Note: `vi.mock("./hostStore")` is hoisted — reference `mockHostStore` via a factory that closes over it (use `vi.hoisted` if vitest complains: `const mockHostStore = vi.hoisted(() => ({ ... }))`).

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/stores/hosts/hostPingStore.test.ts`
Expected: FAIL — module does not exist.

- [ ] **Step 3: Implement the store** — create `hostPingStore.ts`:

```ts
import { create } from "zustand";
import { useHostStore } from "./hostStore";

export type PingStatus = "pinging" | "reachable" | "unreachable";

export interface PingState {
  status: PingStatus;
  latencyMs?: number;
  os?: string;
}

interface HostPingState {
  pings: Record<string, PingState>;
  ping: (hostId: string) => Promise<void>;
  clear: (hostId?: string) => void;
}

export const useHostPingStore = create<HostPingState>((set) => ({
  pings: {},
  ping: async (hostId) => {
    set((s) => ({ pings: { ...s.pings, [hostId]: { status: "pinging" } } }));
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      const hostStore = useHostStore.getState();
      const host = await hostStore.getDecryptedHost(hostId);
      if (!host || !host.address) {
        set((s) => ({ pings: { ...s.pings, [hostId]: { status: "unreachable" } } }));
        return;
      }
      const creds = await hostStore.getCredentialsForHost(hostId);
      const result = await invoke<{
        reachable: boolean;
        latency_ms: number | null;
        os: string | null;
      }>("ping_host", {
        config: {
          host: host.address,
          port: host.port,
          username: host.username ?? "root",
          password: creds.password,
          privateKey: creds.privateKey,
          passphrase: creds.passphrase,
        },
      });
      if (result.reachable) {
        if (result.os) {
          void hostStore.updateHostOs(hostId, result.os);
        }
        set((s) => ({
          pings: {
            ...s.pings,
            [hostId]: {
              status: "reachable",
              latencyMs: result.latency_ms ?? undefined,
              os: result.os ?? undefined,
            },
          },
        }));
      } else {
        set((s) => ({ pings: { ...s.pings, [hostId]: { status: "unreachable" } } }));
      }
    } catch {
      set((s) => ({ pings: { ...s.pings, [hostId]: { status: "unreachable" } } }));
    }
  },
  clear: (hostId) =>
    set((s) => {
      if (!hostId) return { pings: {} };
      const { [hostId]: _removed, ...rest } = s.pings;
      return { pings: rest };
    }),
}));
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run` and `pnpm biome check src/stores/hosts/hostPingStore.ts src/stores/hosts/hostPingStore.test.ts`
Expected: all pass (137 total); no biome errors.

- [ ] **Step 5: Commit**

```bash
git add src/stores/hosts/hostPingStore.ts src/stores/hosts/hostPingStore.test.ts
git commit -m "feat(hosts): ping store with transient reachability state"
```

---

### Task 6: Frontend — colored OS icon components

**Files:**
- Create: `client/src/components/icons/os/PlaceholderOsIcon.tsx`
- Create: one file per sourced icon in `client/src/components/icons/os/` (list in Step 2)
- Create: `client/src/components/icons/OsIcon.tsx`
- Create: `client/src/lib/constants/os.ts`
- Create: `client/src/components/icons/os/os.test.tsx`

**Interfaces:**
- Produces: default-exported icon components typed `FC<SVGProps<SVGElement>>` (renders `<svg {...props}>`), `OS_META: Record<string, OsMeta>` with `OsMeta = { name: string; Icon: FC<{ className?: string }> }`, `osMeta(os?: string): OsMeta` (unknown → placeholder + pretty name or "Unknown").

- [ ] **Step 1: Write the failing test** — create `client/src/components/icons/os/os.test.tsx`:

```tsx
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import PlaceholderOsIcon from "./PlaceholderOsIcon";
import { OS_META, osMeta } from "@/lib/constants/os";

describe("os icons", () => {
  it("every OS_META entry renders non-empty svg markup", () => {
    for (const [key, meta] of Object.entries(OS_META)) {
      const html = renderToStaticMarkup(createElement(meta.Icon, { className: "w-3" }));
      expect(html.length, `icon ${key} renders`).toBeGreaterThan(0);
    }
  });

  it("unknown os falls back to the placeholder", () => {
    expect(osMeta("truenas").Icon).toBe(PlaceholderOsIcon);
    expect(osMeta(undefined).name).toBe("Unknown");
    expect(osMeta("UBUNTU").Icon).toBe(OS_META.ubuntu.Icon);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/components/icons/os/os.test.tsx`
Expected: FAIL — module `@/lib/constants/os` does not exist.

- [ ] **Step 3: Fetch the colored SVG sources and generate the icon components**

Run this PowerShell script from the `client` directory (fetch from devicon master, extract inner SVG markup + `viewBox`/`width`/`height`, write TSX in the user-specified format):

```powershell
$icons = @{
  UbuntuIcon = "ubuntu/ubuntu-original.svg"
  DebianIcon = "debian/debian-original.svg"
  FedoraIcon = "fedora/fedora-original.svg"
  ArchLinuxIcon = "archlinux/archlinux-original.svg"
  ManjaroIcon = "manjaro/manjaro-original.svg"
  LinuxMintIcon = "linuxmint/linuxmint-original.svg"
  PopOsIcon = "popos/popos-original.svg"
  KaliLinuxIcon = "kali/kali-original.svg"
  AlpineLinuxIcon = "alpine/alpine-original.svg"
  CentosIcon = "centos/centos-original.svg"
  RedHatIcon = "redhat/redhat-original.svg"
  OpensuseIcon = "opensuse/opensuse-original.svg"
  GentooIcon = "gentoo/gentoo-original.svg"
  ElementaryIcon = "elementary/elementary-original.svg"
  AppleIcon = "apple/apple-original.svg"
  WindowsIcon = "windows8/windows8-original.svg"
  FreeBsdIcon = "freebsd/freebsd-original.svg"
}
$outDir = "src/components/icons/os"
New-Item -ItemType Directory -Force -Path $outDir | Out-Null
foreach ($entry in $icons.GetEnumerator()) {
  $url = "https://raw.githubusercontent.com/devicons/devicon/master/icons/$($entry.Value)"
  $tmp = Join-Path $env:TEMP "devicon-$($entry.Key).svg"
  try {
    Invoke-WebRequest -Uri $url -OutFile $tmp -ErrorAction Stop
  } catch {
    Write-Host "SKIP $($entry.Key): fetch failed"
    continue
  }
  [xml]$xml = Get-Content $tmp -Raw
  $svg = $xml.DocumentElement
  $inner = $svg.InnerXml
  $viewBox = $svg.GetAttribute("viewBox")
  $width = $svg.GetAttribute("width")
  $height = $svg.GetAttribute("height")
  $attrs = ""
  if ($width) { $attrs += "`n    width=`"$width`"" }
  if ($height) { $attrs += "`n    height=`"$height`"" }
  if ($viewBox) { $attrs += "`n    viewBox=`"$viewBox`"" }
  $indent = ($inner -split "`n" | ForEach-Object { "    $_" }) -join "`n"
  $tsx = @"
import type { FC, SVGProps } from "react";

const $($entry.Key): FC<SVGProps<SVGElement>> = (props) => (
  <svg
    {...props}
    xmlns="http://www.w3.org/2000/svg"$attrs
  >
$indent
  </svg>
);

export default $($entry.Key);
"@
  Set-Content -Path (Join-Path $outDir "$($entry.Key).tsx") -Value $tsx -Encoding utf8
  Remove-Item $tmp -Force
  Write-Host "OK $($entry.Key)"
}
```

Icon names whose fetch failed (404 → devicon lacks them): `RockyIcon`, `AmazonIcon` (sles/nixos/zorin/solaris/linux generic have no devicon asset at all) — those are covered by `PlaceholderOsIcon` in `OS_META`, populated later by the user. The script logs `SKIP` per missing file; note which were skipped and leave them out of `OS_META` (use the placeholder instead).

- [ ] **Step 4: Create the placeholder** — `client/src/components/icons/os/PlaceholderOsIcon.tsx`:

```tsx
import { DesktopIcon } from "@phosphor-icons/react";
import type { FC } from "react";

// Placeholder until real logos are provided
const PlaceholderOsIcon: FC<{ className?: string }> = ({ className }) => (
  <DesktopIcon className={className} weight="fill" />
);

export default PlaceholderOsIcon;
```

- [ ] **Step 5: Create the display map** — `client/src/lib/constants/os.ts`:

```ts
import type { FC } from "react";
import AlpineLinuxIcon from "@/components/icons/os/AlpineLinuxIcon";
import AppleIcon from "@/components/icons/os/AppleIcon";
import ArchLinuxIcon from "@/components/icons/os/ArchLinuxIcon";
import CentosIcon from "@/components/icons/os/CentosIcon";
import DebianIcon from "@/components/icons/os/DebianIcon";
import ElementaryIcon from "@/components/icons/os/ElementaryIcon";
import FedoraIcon from "@/components/icons/os/FedoraIcon";
import FreeBsdIcon from "@/components/icons/os/FreeBsdIcon";
import GentooIcon from "@/components/icons/os/GentooIcon";
import KaliLinuxIcon from "@/components/icons/os/KaliLinuxIcon";
import LinuxMintIcon from "@/components/icons/os/LinuxMintIcon";
import ManjaroIcon from "@/components/icons/os/ManjaroIcon";
import OpensuseIcon from "@/components/icons/os/OpensuseIcon";
import PlaceholderOsIcon from "@/components/icons/os/PlaceholderOsIcon";
import PopOsIcon from "@/components/icons/os/PopOsIcon";
import RedHatIcon from "@/components/icons/os/RedHatIcon";
import UbuntuIcon from "@/components/icons/os/UbuntuIcon";
import WindowsIcon from "@/components/icons/os/WindowsIcon";

export interface OsMeta {
  name: string;
  Icon: FC<{ className?: string }>;
}

export const OS_META: Record<string, OsMeta> = {
  ubuntu: { name: "Ubuntu", Icon: UbuntuIcon },
  debian: { name: "Debian", Icon: DebianIcon },
  fedora: { name: "Fedora", Icon: FedoraIcon },
  arch: { name: "Arch Linux", Icon: ArchLinuxIcon },
  manjaro: { name: "Manjaro", Icon: ManjaroIcon },
  linuxmint: { name: "Linux Mint", Icon: LinuxMintIcon },
  pop: { name: "Pop!_OS", Icon: PopOsIcon },
  kali: { name: "Kali Linux", Icon: KaliLinuxIcon },
  alpine: { name: "Alpine Linux", Icon: AlpineLinuxIcon },
  centos: { name: "CentOS", Icon: CentosIcon },
  rocky: { name: "Rocky Linux", Icon: PlaceholderOsIcon },
  rhel: { name: "Red Hat Enterprise Linux", Icon: RedHatIcon },
  amazon: { name: "Amazon Linux", Icon: PlaceholderOsIcon },
  opensuse: { name: "openSUSE", Icon: OpensuseIcon },
  sles: { name: "SUSE Linux Enterprise", Icon: PlaceholderOsIcon },
  nixos: { name: "NixOS", Icon: PlaceholderOsIcon },
  gentoo: { name: "Gentoo", Icon: GentooIcon },
  zorin: { name: "Zorin OS", Icon: PlaceholderOsIcon },
  elementary: { name: "elementary OS", Icon: ElementaryIcon },
  oracle: { name: "Oracle Linux", Icon: PlaceholderOsIcon },
  darwin: { name: "macOS", Icon: AppleIcon },
  windows: { name: "Windows", Icon: WindowsIcon },
  bsd: { name: "BSD", Icon: FreeBsdIcon },
  solaris: { name: "Solaris", Icon: PlaceholderOsIcon },
  linux: { name: "Linux", Icon: PlaceholderOsIcon },
};

export function osMeta(os?: string): OsMeta {
  const key = os?.trim().toLowerCase();
  return (
    (key && OS_META[key]) || {
      name: os && os.trim() ? os : "Unknown",
      Icon: PlaceholderOsIcon,
    }
  );
}
```

Remove imports of icon files whose fetch was SKIPPED (those `OS_META` entries keep `PlaceholderOsIcon`). If a generated icon component is flagged by biome for `width`/`height` attribute quoting, re-run with adjusted PowerShell quoting (attribute values are double-quoted inside a double-quoted string — use backtick escapes as shown).

- [ ] **Step 6: Create the selector** — `client/src/components/icons/OsIcon.tsx`:

```tsx
import { osMeta } from "@/lib/constants/os";

export function OsIcon({
  os,
  className,
}: {
  os?: string;
  className?: string;
}) {
  const { Icon } = osMeta(os);
  return <Icon className={className} />;
}
```

- [ ] **Step 7: Verify**

Run: `pnpm vitest run` (139 passing) and `pnpm biome check src/components/icons/os src/components/icons/OsIcon.tsx src/lib/constants/os.ts`
Expected: pass; no biome errors (auto-fix `--write` if the generated TSX has formatting diffs).

- [ ] **Step 8: Commit**

```bash
git add src/components/icons/os src/components/icons/OsIcon.tsx src/lib/constants/os.ts
git commit -m "feat(icons): colored os icon components + display map"
```

---

### Task 7: Frontend — ping button + OS icons in host surfaces

**Files:**
- Modify: `client/src/components/hosts/cards/DraggableHostCard.tsx`
- Modify: `client/src/components/hosts/panels/HostDetails.tsx`

**Interfaces:**
- Consumes: `OsIcon`, `osMeta`, `useHostPingStore`.

- [ ] **Step 1: Update `DraggableHostCard.tsx`**

1. Replace the Phosphor os-icon imports (`AppleLogo, LinuxLogo, WindowsLogo, DesktopIcon`) and the whole `osIconFor` function (lines 18-30) with:

```tsx
import { CircleNotchIcon, SignalIcon } from "@phosphor-icons/react";
import { OsIcon } from "@/components/icons/OsIcon";
import { osMeta } from "@/lib/constants/os";
import { useHostPingStore } from "@/stores/hosts/hostPingStore";
```

2. At the top of the component body (before `const deleteDialog = useModal();`):

```tsx
const pingState = useHostPingStore((s) => s.pings[host.id]);
const ping = useHostPingStore((s) => s.ping);
```

3. Subtitle (lines 71-83): replace the `(() => {...})()` block with:

```tsx
<OsIcon os={host.os} className="w-3 h-3 shrink-0" />
<span className="capitalize">{osMeta(host.os).name}</span>
```

4. Ping button — insert before the edit Button in the actions row:

```tsx
<Button
  type="button"
  onClick={(e) => {
    e.stopPropagation();
    void ping(host.id);
  }}
  variant="ghost"
  size="icon-xs"
  className="hover:text-primary-500"
  title="Ping host"
>
  <SignalIcon className="w-3 h-3" weight="bold" />
</Button>
```

5. Transient status line — insert between the subtitle `</p>` and the tags block:

```tsx
{pingState && (
  <p className="flex items-center gap-1.5 text-xs mt-1 ml-[18px]">
    {pingState.status === "pinging" && (
      <>
        <CircleNotchIcon className="w-3 h-3 animate-spin shrink-0" />
        <span className="text-dark-500">Checking…</span>
      </>
    )}
    {pingState.status === "reachable" && (
      <>
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
        <span className="text-emerald-400">
          {pingState.latencyMs != null ? `${pingState.latencyMs} ms` : "Reachable"}
        </span>
        {pingState.os && (
          <>
            <span className="text-dark-600">•</span>
            <OsIcon os={pingState.os} className="w-3 h-3 shrink-0" />
          </>
        )}
      </>
    )}
    {pingState.status === "unreachable" && (
      <>
        <span className="w-1.5 h-1.5 rounded-full bg-red-400 shrink-0" />
        <span className="text-red-400">Unreachable</span>
      </>
    )}
  </p>
)}
```

- [ ] **Step 2: Update `HostDetails.tsx`**

Line 60 renders `SSH • {host.os || "unknown"} •` — replace the os text with:

```tsx
SSH •{" "}
<span className="inline-flex items-center gap-1">
  <OsIcon os={host.os} className="w-3.5 h-3.5" />
  {osMeta(host.os).name}
</span>{" "}
•{" "}
```

Add the imports:

```tsx
import { OsIcon } from "@/components/icons/OsIcon";
import { osMeta } from "@/lib/constants/os";
```

- [ ] **Step 3: Verify**

Run: `pnpm biome check src/components/hosts` and `pnpm vitest run` and `pnpm build`
Expected: biome clean, 139 tests pass, `tsc` clean except the 2 pre-existing `authStore.test.ts` errors.

- [ ] **Step 4: Commit**

```bash
git add src/components/hosts/cards/DraggableHostCard.tsx src/components/hosts/panels/HostDetails.tsx
git commit -m "feat(hosts): ping button + colored os icons in host cards"
```

---

### Task 8: Full verification + superproject pointer

**Files:**
- Modify: (superproject) `gitmodules` pointer via `git add client`

- [ ] **Step 1: Full client verification**

Run (from `client/`):
1. `cargo test --manifest-path src-tauri/Cargo.toml` — 48 pass
2. `pnpm vitest run` — 139 pass
3. `pnpm biome check .` — only pre-existing CRLF baseline noise (Found 237 errors, unchanged)
4. `pnpm build` — tsc clean except the 2 pre-existing `authStore.test.ts` errors

- [ ] **Step 2: Manual smoke test** (in `client`, `pnpm tauri dev`):

1. Connect to a reachable host with password auth → shell works, typing echoes, resize keeps PTY sane.
2. Host with empty `os` → after connect, `os` is filled (e.g. `ubuntu`); connecting again does not re-probe (detect_os false).
3. Create a host with valid creds → `os` fills in shortly after save; create a host with bad creds → no error, `os` stays empty.
4. Ping button: reachable host → green `23 ms` line + os icon; stopped host → red `Unreachable`; relaunch clears the line.
5. Host-key changed: swap server key (e.g. regenerate sshd key or point at another server on same port) → dialog with old/new fingerprint → accept continues, reject closes with error.
6. New host (first contact) → connects without prompt (TOFU).
7. Private-key auth (with and without passphrase) — use a key added via Keys.

- [ ] **Step 3: Bump the superproject pointer**

From the repo root:

```bash
git add client
git commit -m "chore: advance client submodule (real ssh + os detection + ping)"
```
