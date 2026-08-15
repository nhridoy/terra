# SFTP File Browser Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement full-featured SFTP file browser by connecting the existing stubbed UI to a real Rust SFTP backend via russh-sftp.

**Architecture:** New `sftp.rs` module in Rust backend using `russh-sftp` crate. SFTP subsystem channels opened from existing or new SSH sessions. Streaming chunk-based transfers with progress events. Frontend `RemoteFileProvider` class implements existing `FileProvider` interface.

**Tech Stack:** russh 0.62, russh-sftp 2.4, tokio, Tauri IPC, React, Zustand

## Global Constraints

- russh 0.62 with features: ring, rsa, flate2
- russh-sftp 2.4 (new dependency)
- Tauri v2 with ACL-based capabilities
- TypeScript with strict mode
- Biome for linting (single quotes, space indent)
- pnpm only (never npm)
- All crypto: Argon2id + ChaCha20Poly1305
- SSH connections are direct client→remote (server does NOT proxy SSH)
- Server stores/syncs config only, never sees plaintext credentials

---

## Phase 1: Rust SFTP Foundation

### Task 1: Add russh-sftp dependency and create sftp.rs skeleton

**Files:**
- Modify: `client/src-tauri/Cargo.toml`
- Create: `client/src-tauri/src/sftp.rs`

**Interfaces:**
- Produces: `SftpEntry`, `SftpConnectResult`, `SftpSessions` types

- [ ] **Step 1: Add russh-sftp to Cargo.toml**

```toml
# In [dependencies] section, after russh line:
russh-sftp = "2.4"
```

- [ ] **Step 2: Create sftp.rs with type definitions**

```rust
// client/src-tauri/src/sftp.rs
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use tokio::sync::oneshot;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SftpEntry {
    pub name: String,
    pub path: String,
    pub is_dir: bool,
    pub is_symlink: bool,
    pub size: u64,
    pub mode: u32,
    pub uid: u32,
    pub gid: u32,
    pub mtime: i64,
    pub atime: i64,
    pub symlink_target: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SftpConnectResult {
    pub session_id: String,
    pub host: String,
    pub port: u16,
    pub username: String,
    pub reused: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SftpTransferProgress {
    pub session_id: String,
    pub transfer_id: String,
    pub transfer_type: String,
    pub path: String,
    pub bytes_transferred: u64,
    pub total_bytes: u64,
    pub speed: f64,
}

pub struct SftpSession {
    pub host_id: Option<String>,
    pub host: String,
    pub port: u16,
    pub username: String,
    pub sftp: russh_sftp::client::SftpSession,
    pub ssh_handle: Option<russh::client::Handle<crate::ssh::SshHandler>>,
    pub created_ourselves: bool,
}

pub struct SftpSessions {
    pub sessions: Arc<Mutex<HashMap<String, SftpSession>>>,
}

impl Default for SftpSessions {
    fn default() -> Self {
        Self {
            sessions: Arc::new(Mutex::new(HashMap::new())),
        }
    }
}

impl SftpSessions {
    pub fn new() -> Self {
        Self::default()
    }
}
```

- [ ] **Step 3: Register module in lib.rs**

Add at top of `client/src-tauri/src/lib.rs`:
```rust
mod sftp;
```

- [ ] **Step 4: Add SftpSessions to Tauri state**

In the `invoke_handler` builder in `lib.rs`, add `.manage(sftp::SftpSessions::new())` alongside existing `.manage(SshSessions::new())`.

- [ ] **Step 5: Run cargo check**

Run: `cd client/src-tauri && cargo check`
Expected: Compiles with warnings only (unused types)

- [ ] **Step 6: Commit**

```bash
cd client && git add -A && git commit -m "feat(sftp): add russh-sftp dependency and type skeleton"
```

---

### Task 2: SFTP connection manager

**Files:**
- Modify: `client/src-tauri/src/sftp.rs`

**Interfaces:**
- Consumes: `SshSessions` from `crate::ssh`, `SftpSessions`, `SshConfig`
- Produces: `sftp_connect`, `sftp_connect_saved`, `sftp_disconnect` commands

- [ ] **Step 1: Implement helper to get SFTP session from SSH handle**

```rust
use russh_sftp::client::SftpSession as RusshSftp;

async fn open_sftp_from_handle(
    handle: russh::client::Handle<crate::ssh::SshHandler>,
) -> Result<RusshSftp, String> {
    let channel = handle
        .channel_open_session()
        .await
        .map_err(|e| format!("open channel: {e}"))?;
    channel
        .request_subsystem(true, "sftp")
        .await
        .map_err(|e| format!("request sftp subsystem: {e}"))?;
    RusshSftp::new(channel.into_stream())
        .await
        .map_err(|e| format!("init sftp session: {e}"))
}
```

- [ ] **Step 2: Implement sftp_connect command**

```rust
#[tauri::command]
pub async fn sftp_connect(
    session_id: String,
    config: crate::ssh::SshConfig,
    db: tauri::State<'_, crate::db::LocalDb>,
    crypto: tauri::State<'_, crate::CryptoState>,
    ssh_sessions: tauri::State<'_, crate::ssh::SshSessions>,
    sftp_sessions: tauri::State<'_, SftpSessions>,
    app_handle: tauri::AppHandle,
) -> Result<SftpConnectResult, String> {
    // Check if we already have an SFTP session for this session_id
    {
        let sessions = sftp_sessions.sessions.lock().map_err(|e| e.to_string())?;
        if let Some(existing) = sessions.get(&session_id) {
            return Ok(SftpConnectResult {
                session_id,
                host: existing.host.clone(),
                port: existing.port,
                username: existing.username.clone(),
                reused: true,
            });
        }
    }

    // Try to reuse existing SSH session
    let (sftp, ssh_handle, created_ourselves) = {
        let ssh_map = ssh_sessions.sessions.lock().map_err(|e| e.to_string())?;
        if let Some(ssh_session) = ssh_map.get(&session_id) {
            let sftp = open_sftp_from_handle(ssh_session.clone()).await?;
            (sftp, None, false)
        } else {
            drop(ssh_map);
            // Create new SSH connection
            let handler = crate::ssh::SshHandler {
                host: config.host.clone(),
                port: config.port,
                session_id: session_id.clone(),
                app: app_handle.clone(),
                known_hosts: Arc::clone(&ssh_sessions.known_hosts),
                pending_keys: Arc::clone(&ssh_sessions.pending_keys),
                auto_accept: false,
            };
            let client_config = Arc::new(russh::client::Config::default());
            let mut ssh = russh::client::connect_stream(
                client_config,
                tokio::net::TcpStream::connect(format!("{}:{}", config.host, config.port))
                    .await
                    .map_err(|e| format!("tcp connect: {e}"))?,
                handler,
            )
            .await
            .map_err(|e| format!("ssh handshake: {e}"))?;

            // Authenticate
            if let Some(ref key) = config.private_key {
                let key = russh::keys::decode_secret_key(key, config.passphrase.as_deref())
                    .map_err(|e| format!("decode key: {e}"))?;
                let key_with_alg = russh::keys::key::PrivateKeyWithHashAlg::new(
                    Arc::new(key),
                    Some(russh::keys::HashAlg::Sha256),
                );
                let auth = ssh
                    .authenticate_publickey(config.username.clone(), key_with_alg)
                    .await
                    .map_err(|e| format!("publickey auth: {e}"))?;
                if !auth.success() {
                    return Err("public key authentication rejected".to_string());
                }
            } else if let Some(ref password) = config.password {
                let auth = ssh
                    .authenticate_password(config.username.clone(), password.clone())
                    .await
                    .map_err(|e| format!("password auth: {e}"))?;
                if !auth.success() {
                    return Err("password authentication rejected".to_string());
                }
            } else {
                let auth = ssh
                    .authenticate_none(config.username.clone())
                    .await
                    .map_err(|e| format!("none auth: {e}"))?;
                if !auth.success() {
                    return Err("authentication required".to_string());
                }
            }

            let sftp = open_sftp_from_handle(ssh.clone()).await?;
            (sftp, Some(ssh), true)
        }
    };

    let result = SftpConnectResult {
        session_id: session_id.clone(),
        host: config.host.clone(),
        port: config.port,
        username: config.username.clone(),
        reused: false,
    };

    let sftp_session = SftpSession {
        host_id: None,
        host: config.host,
        port: config.port,
        username: config.username,
        sftp,
        ssh_handle,
        created_ourselves,
    };

    let mut sessions = sftp_sessions.sessions.lock().map_err(|e| e.to_string())?;
    sessions.insert(session_id, sftp_session);

    Ok(result)
}
```

- [ ] **Step 3: Implement sftp_connect_saved command**

```rust
#[tauri::command]
pub async fn sftp_connect_saved(
    session_id: String,
    host_id: String,
    db: tauri::State<'_, crate::db::LocalDb>,
    crypto: tauri::State<'_, crate::CryptoState>,
    ssh_sessions: tauri::State<'_, crate::ssh::SshSessions>,
    sftp_sessions: tauri::State<'_, SftpSessions>,
    app_handle: tauri::AppHandle,
) -> Result<SftpConnectResult, String> {
    // Load host config from DB (reuse load_host_config from ssh.rs)
    let config = crate::ssh::load_host_config(&db, &crypto, &host_id)?;

    let mut result = sftp_connect(
        session_id.clone(),
        config.clone(),
        db,
        crypto,
        ssh_sessions,
        sftp_sessions.clone(),
        app_handle,
    )
    .await?;

    result.host_id = Some(host_id.clone());

    // Update the session's host_id
    {
        let mut sessions = sftp_sessions.sessions.lock().map_err(|e| e.to_string())?;
        if let Some(session) = sessions.get_mut(&session_id) {
            session.host_id = Some(host_id);
        }
    }

    Ok(result)
}
```

- [ ] **Step 4: Implement sftp_disconnect command**

```rust
#[tauri::command]
pub async fn sftp_disconnect(
    session_id: String,
    sftp_sessions: tauri::State<'_, SftpSessions>,
) -> Result<(), String> {
    let mut sessions = sftp_sessions.sessions.lock().map_err(|e| e.to_string())?;
    if let Some(session) = sessions.remove(&session_id) {
        // Close SFTP session
        let _ = session.sftp.close().await;
        // If we created the SSH connection, drop it too
        if session.created_ourselves {
            drop(session.ssh_handle);
        }
    }
    Ok(())
}
```

- [ ] **Step 5: Make load_host_config public in ssh.rs**

In `client/src-tauri/src/ssh.rs`, change `fn load_host_config` to `pub fn load_host_config`.

- [ ] **Step 6: Register commands in lib.rs invoke_handler**

Add to the invoke_handler in `lib.rs`:
```rust
sftp::sftp_connect,
sftp::sftp_connect_saved,
sftp::sftp_disconnect,
```

- [ ] **Step 7: Run cargo check**

Run: `cd client/src-tauri && cargo check`
Expected: Compiles (may have warnings about unused variables)

- [ ] **Step 8: Commit**

```bash
cd client && git add -A && git commit -m "feat(sftp): implement connection manager with SSH reuse"
```

---

### Task 3: Basic file operations (list, stat, read)

**Files:**
- Modify: `client/src-tauri/src/sftp.rs`

**Interfaces:**
- Consumes: `SftpSessions`
- Produces: `sftp_list`, `sftp_stat`, `sftp_read` commands

- [ ] **Step 1: Implement helper to get SFTP session**

```rust
fn get_sftp_session(
    sessions: &SftpSessions,
    session_id: &str,
) -> Result<std::sync::MutexGuard<'_, SftpSession>, String> {
    let map = sessions.sessions.lock().map_err(|e| e.to_string())?;
    // We need to return the guard, but this won't work with MutexGuard
    // Instead, we'll lock/unlock per operation
    Ok(map)  // This won't compile - see actual implementation below
}
```

Actually, use this pattern for each command:

```rust
// Helper macro or function to get SFTP session reference
macro_rules! with_sftp {
    ($sessions:expr, $id:expr, |$sftp:ident| $body:expr) => {{
        let map = $sessions.sessions.lock().map_err(|e| e.to_string())?;
        let session = map.get($id).ok_or_else(|| "SFTP session not found".to_string())?;
        let $sftp = &session.sftp;
        $body
    }};
}
```

- [ ] **Step 2: Implement sftp_list command**

```rust
#[tauri::command]
pub async fn sftp_list(
    session_id: String,
    path: String,
    sftp_sessions: tauri::State<'_, SftpSessions>,
) -> Result<Vec<SftpEntry>, String> {
    let entries = {
        let map = sftp_sessions.sessions.lock().map_err(|e| e.to_string())?;
        let session = map.get(&session_id).ok_or("SFTP session not found")?;
        let sftp = &session.sftp;

        let mut entries = Vec::new();
        let mut read_dir = sftp.read_dir(&path).await.map_err(|e| format!("list: {e}"))?;

        for entry in read_dir {
            let entry = entry.map_err(|e| format!("read entry: {e}"))?;
            let metadata = entry.metadata().await.map_err(|e| format!("metadata: {e}"))?;

            let attrs = metadata.attributes;
            entries.push(SftpEntry {
                name: entry.file_name(),
                path: format!("{}/{}", path.trim_end_matches('/'), entry.file_name()),
                is_dir: attrs.is_dir(),
                is_symlink: attrs.is_symlink(),
                size: attrs.len().unwrap_or(0),
                mode: attrs.permissions().unwrap_or(0),
                uid: 0,
                gid: 0,
                mtime: attrs.modified().map(|t| t.as_secs_millis() as i64).unwrap_or(0),
                atime: attrs.accessed().map(|t| t.as_secs_millis() as i64).unwrap_or(0),
                symlink_target: None,
            });
        }
        entries
    };
    Ok(entries)
}
```

- [ ] **Step 3: Implement sftp_stat command**

```rust
#[tauri::command]
pub async fn sftp_stat(
    session_id: String,
    path: String,
    sftp_sessions: tauri::State<'_, SftpSessions>,
) -> Result<SftpEntry, String> {
    let map = sftp_sessions.sessions.lock().map_err(|e| e.to_string())?;
    let session = map.get(&session_id).ok_or("SFTP session not found")?;
    let sftp = &session.sftp;

    let metadata = sftp.metadata(&path).await.map_err(|e| format!("stat: {e}"))?;
    let attrs = metadata.attributes;
    let name = path.split('/').last().unwrap_or("").to_string();

    Ok(SftpEntry {
        name,
        path: path.clone(),
        is_dir: attrs.is_dir(),
        is_symlink: attrs.is_symlink(),
        size: attrs.len().unwrap_or(0),
        mode: attrs.permissions().unwrap_or(0),
        uid: 0,
        gid: 0,
        mtime: attrs.modified().map(|t| t.as_secs_millis() as i64).unwrap_or(0),
        atime: attrs.accessed().map(|t| t.as_secs_millis() as i64).unwrap_or(0),
        symlink_target: None,
    })
}
```

- [ ] **Step 4: Implement sftp_read command**

```rust
#[tauri::command]
pub async fn sftp_read(
    session_id: String,
    path: String,
    offset: u64,
    len: u32,
    sftp_sessions: tauri::State<'_, SftpSessions>,
) -> Result<Vec<u8>, String> {
    let map = sftp_sessions.sessions.lock().map_err(|e| e.to_string())?;
    let session = map.get(&session_id).ok_or("SFTP session not found")?;
    let sftp = &session.sftp;

    use tokio::io::{AsyncReadExt, AsyncSeekExt};

    let mut file = sftp.open(&path).await.map_err(|e| format!("open: {e}"))?;
    file.seek(std::io::SeekFrom::Start(offset))
        .await
        .map_err(|e| format!("seek: {e}"))?;

    let mut buf = vec![0u8; len as usize];
    let n = file.read(&mut buf).await.map_err(|e| format!("read: {e}"))?;
    buf.truncate(n);
    Ok(buf)
}
```

- [ ] **Step 5: Register commands in lib.rs**

Add to invoke_handler:
```rust
sftp::sftp_list,
sftp::sftp_stat,
sftp::sftp_read,
```

- [ ] **Step 6: Run cargo check**

Run: `cd client/src-tauri && cargo check`
Expected: Compiles

- [ ] **Step 7: Commit**

```bash
cd client && git add -A && git commit -m "feat(sftp): implement list, stat, read operations"
```

---

## Phase 2: File Operations

### Task 4: Write operations (write, mkdir, rename, delete)

**Files:**
- Modify: `client/src-tauri/src/sftp.rs`

**Interfaces:**
- Consumes: `SftpSessions`
- Produces: `sftp_write`, `sftp_mkdir`, `sftp_rename`, `sftp_delete` commands

- [ ] **Step 1: Implement sftp_write command**

```rust
#[tauri::command]
pub async fn sftp_write(
    session_id: String,
    path: String,
    data: Vec<u8>,
    offset: u64,
    sftp_sessions: tauri::State<'_, SftpSessions>,
) -> Result<(), String> {
    let map = sftp_sessions.sessions.lock().map_err(|e| e.to_string())?;
    let session = map.get(&session_id).ok_or("SFTP session not found")?;
    let sftp = &session.sftp;

    use tokio::io::{AsyncSeekExt, AsyncWriteExt};

    let mut file = sftp
        .open_with_flags(
            &path,
            russh_sftp::protocol::OpenFlags::CREATE
                | russh_sftp::protocol::OpenFlags::WRITE
                | russh_sftp::protocol::OpenFlags::TRUNCATE,
        )
        .await
        .map_err(|e| format!("open: {e}"))?;

    file.seek(std::io::SeekFrom::Start(offset))
        .await
        .map_err(|e| format!("seek: {e}"))?;
    file.write_all(&data).await.map_err(|e| format!("write: {e}"))?;
    file.sync_all().await.map_err(|e| format!("fsync: {e}"))?;

    Ok(())
}
```

- [ ] **Step 2: Implement sftp_mkdir command**

```rust
#[tauri::command]
pub async fn sftp_mkdir(
    session_id: String,
    path: String,
    sftp_sessions: tauri::State<'_, SftpSessions>,
) -> Result<(), String> {
    let map = sftp_sessions.sessions.lock().map_err(|e| e.to_string())?;
    let session = map.get(&session_id).ok_or("SFTP session not found")?;
    let sftp = &session.sftp;

    sftp.create_dir(&path).await.map_err(|e| format!("mkdir: {e}"))
}
```

- [ ] **Step 3: Implement sftp_rename command**

```rust
#[tauri::command]
pub async fn sftp_rename(
    session_id: String,
    old_path: String,
    new_path: String,
    sftp_sessions: tauri::State<'_, SftpSessions>,
) -> Result<(), String> {
    let map = sftp_sessions.sessions.lock().map_err(|e| e.to_string())?;
    let session = map.get(&session_id).ok_or("SFTP session not found")?;
    let sftp = &session.sftp;

    sftp.rename(&old_path, &new_path)
        .await
        .map_err(|e| format!("rename: {e}"))
}
```

- [ ] **Step 4: Implement sftp_delete command**

```rust
#[tauri::command]
pub async fn sftp_delete(
    session_id: String,
    path: String,
    recursive: bool,
    sftp_sessions: tauri::State<'_, SftpSessions>,
) -> Result<(), String> {
    let map = sftp_sessions.sessions.lock().map_err(|e| e.to_string())?;
    let session = map.get(&session_id).ok_or("SFTP session not found")?;
    let sftp = &session.sftp;

    // Check if it's a directory
    let metadata = sftp.metadata(&path).await.map_err(|e| format!("stat: {e}"))?;
    if metadata.attributes.is_dir() {
        if recursive {
            // Recursive delete - list and delete contents first
            let mut read_dir = sftp.read_dir(&path).await.map_err(|e| format!("readdir: {e}"))?;
            while let Some(entry) = read_dir.next().await {
                let entry = entry.map_err(|e| format!("entry: {e}"))?;
                let entry_path = format!("{}/{}", path.trim_end_matches('/'), entry.file_name());
                Box::pin(sftp_delete(session_id.clone(), entry_path, true, sftp_sessions.clone())).await?;
            }
        }
        sftp.remove_dir(&path).await.map_err(|e| format!("rmdir: {e}"))
    } else {
        sftp.remove_file(&path).await.map_err(|e| format!("rm: {e}"))
    }
}
```

- [ ] **Step 5: Register commands in lib.rs**

Add to invoke_handler:
```rust
sftp::sftp_write,
sftp::sftp_mkdir,
sftp::sftp_rename,
sftp::sftp_delete,
```

- [ ] **Step 6: Run cargo check**

Run: `cd client/src-tauri && cargo check`
Expected: Compiles

- [ ] **Step 7: Commit**

```bash
cd client && git add -A && git commit -m "feat(sftp): implement write, mkdir, rename, delete"
```

---

### Task 5: Permissions (chmod, chown) and symlinks

**Files:**
- Modify: `client/src-tauri/src/sftp.rs`

**Interfaces:**
- Consumes: `SftpSessions`
- Produces: `sftp_chmod`, `sftp_chown`, `sftp_symlink`, `sftp_readlink` commands

- [ ] **Step 1: Implement sftp_chmod command**

```rust
#[tauri::command]
pub async fn sftp_chmod(
    session_id: String,
    path: String,
    mode: u32,
    sftp_sessions: tauri::State<'_, SftpSessions>,
) -> Result<(), String> {
    let map = sftp_sessions.sessions.lock().map_err(|e| e.to_string())?;
    let session = map.get(&session_id).ok_or("SFTP session not found")?;
    let sftp = &session.sftp;

    let mut attrs = russh_sftp::protocol::FileAttributes::default();
    attrs.permissions = Some(mode);

    sftp.set_metadata(&path, attrs)
        .await
        .map_err(|e| format!("chmod: {e}"))
}
```

- [ ] **Step 2: Implement sftp_chown command**

```rust
#[tauri::command]
pub async fn sftp_chown(
    session_id: String,
    path: String,
    uid: u32,
    gid: u32,
    sftp_sessions: tauri::State<'_, SftpSessions>,
) -> Result<(), String> {
    let map = sftp_sessions.sessions.lock().map_err(|e| e.to_string())?;
    let session = map.get(&session_id).ok_or("SFTP session not found")?;
    let sftp = &session.sftp;

    let mut attrs = russh_sftp::protocol::FileAttributes::default();
    attrs.uid = Some(uid);
    attrs.gid = Some(gid);

    sftp.set_metadata(&path, attrs)
        .await
        .map_err(|e| format!("chown: {e}"))
}
```

- [ ] **Step 3: Implement sftp_symlink command**

```rust
#[tauri::command]
pub async fn sftp_symlink(
    session_id: String,
    target: String,
    link_path: String,
    sftp_sessions: tauri::State<'_, SftpSessions>,
) -> Result<(), String> {
    let map = sftp_sessions.sessions.lock().map_err(|e| e.to_string())?;
    let session = map.get(&session_id).ok_or("SFTP session not found")?;
    let sftp = &session.sftp;

    sftp.symlink(&target, &link_path)
        .await
        .map_err(|e| format!("symlink: {e}"))
}
```

- [ ] **Step 4: Implement sftp_readlink command**

```rust
#[tauri::command]
pub async fn sftp_readlink(
    session_id: String,
    path: String,
    sftp_sessions: tauri::State<'_, SftpSessions>,
) -> Result<String, String> {
    let map = sftp_sessions.sessions.lock().map_err(|e| e.to_string())?;
    let session = map.get(&session_id).ok_or("SFTP session not found")?;
    let sftp = &session.sftp;

    sftp.read_link(&path)
        .await
        .map_err(|e| format!("readlink: {e}"))
}
```

- [ ] **Step 5: Register commands in lib.rs**

Add to invoke_handler:
```rust
sftp::sftp_chmod,
sftp::sftp_chown,
sftp::sftp_symlink,
sftp::sftp_readlink,
```

- [ ] **Step 6: Run cargo check**

Run: `cd client/src-tauri && cargo check`
Expected: Compiles

- [ ] **Step 7: Commit**

```bash
cd client && git add -A && git commit -m "feat(sftp): implement chmod, chown, symlink, readlink"
```

---

## Phase 3: Transfer System

### Task 6: Streaming transfers with progress events

**Files:**
- Modify: `client/src-tauri/src/sftp.rs`

**Interfaces:**
- Consumes: `SftpSessions`, Tauri AppHandle for events
- Produces: `sftp_download`, `sftp_upload` commands, `sftp-transfer-progress` events

- [ ] **Step 1: Implement sftp_download command with progress**

```rust
#[tauri::command]
pub async fn sftp_download(
    session_id: String,
    remote_path: String,
    local_path: String,
    transfer_id: String,
    sftp_sessions: tauri::State<'_, SftpSessions>,
    app_handle: tauri::AppHandle,
) -> Result<(), String> {
    let map = sftp_sessions.sessions.lock().map_err(|e| e.to_string())?;
    let session = map.get(&session_id).ok_or("SFTP session not found")?;
    let sftp = &session.sftp;

    use tokio::io::{AsyncReadExt, AsyncWriteExt};

    let metadata = sftp.metadata(&remote_path).await.map_err(|e| format!("stat: {e}"))?;
    let total_bytes = metadata.attributes.len().unwrap_or(0);

    let mut remote_file = sftp.open(&remote_path).await.map_err(|e| format!("open: {e}"))?;
    let mut local_file = tokio::fs::File::create(&local_path)
        .await
        .map_err(|e| format!("create local: {e}"))?;

    let mut buf = vec![0u8; 64 * 1024]; // 64KB chunks
    let mut transferred = 0u64;
    let start = std::time::Instant::now();

    loop {
        let n = remote_file.read(&mut buf).await.map_err(|e| format!("read: {e}"))?;
        if n == 0 {
            break;
        }
        local_file.write_all(&buf[..n]).await.map_err(|e| format!("write: {e}"))?;
        transferred += n as u64;

        let elapsed = start.elapsed().as_secs_f64();
        let speed = if elapsed > 0.0 { transferred as f64 / elapsed } else { 0.0 };

        let _ = app_handle.emit(
            "sftp-transfer-progress",
            SftpTransferProgress {
                session_id: session_id.clone(),
                transfer_id: transfer_id.clone(),
                transfer_type: "download".to_string(),
                path: remote_path.clone(),
                bytes_transferred: transferred,
                total_bytes,
                speed,
            },
        );
    }

    Ok(())
}
```

- [ ] **Step 2: Implement sftp_upload command with progress**

```rust
#[tauri::command]
pub async fn sftp_upload(
    session_id: String,
    local_path: String,
    remote_path: String,
    transfer_id: String,
    sftp_sessions: tauri::State<'_, SftpSessions>,
    app_handle: tauri::AppHandle,
) -> Result<(), String> {
    let map = sftp_sessions.sessions.lock().map_err(|e| e.to_string())?;
    let session = map.get(&session_id).ok_or("SFTP session not found")?;
    let sftp = &session.sftp;

    use tokio::io::{AsyncReadExt, AsyncWriteExt};

    let local_metadata = tokio::fs::metadata(&local_path)
        .await
        .map_err(|e| format!("stat local: {e}"))?;
    let total_bytes = local_metadata.len();

    let mut local_file = tokio::fs::File::open(&local_path)
        .await
        .map_err(|e| format!("open local: {e}"))?;
    let mut remote_file = sftp
        .create(&remote_path)
        .await
        .map_err(|e| format!("create remote: {e}"))?;

    let mut buf = vec![0u8; 64 * 1024];
    let mut transferred = 0u64;
    let start = std::time::Instant::now();

    loop {
        let n = local_file.read(&mut buf).await.map_err(|e| format!("read: {e}"))?;
        if n == 0 {
            break;
        }
        remote_file.write_all(&buf[..n]).await.map_err(|e| format!("write: {e}"))?;
        transferred += n as u64;

        let elapsed = start.elapsed().as_secs_f64();
        let speed = if elapsed > 0.0 { transferred as f64 / elapsed } else { 0.0 };

        let _ = app_handle.emit(
            "sftp-transfer-progress",
            SftpTransferProgress {
                session_id: session_id.clone(),
                transfer_id: transfer_id.clone(),
                transfer_type: "upload".to_string(),
                path: remote_path.clone(),
                bytes_transferred: transferred,
                total_bytes,
                speed,
            },
        );
    }

    remote_file.sync_all().await.map_err(|e| format!("fsync: {e}"))?;
    Ok(())
}
```

- [ ] **Step 3: Register commands in lib.rs**

Add to invoke_handler:
```rust
sftp::sftp_download,
sftp::sftp_upload,
```

- [ ] **Step 4: Run cargo check**

Run: `cd client/src-tauri && cargo check`
Expected: Compiles

- [ ] **Step 5: Commit**

```bash
cd client && git add -A && git commit -m "feat(sftp): implement streaming transfers with progress events"
```

---

### Task 7: Search functionality

**Files:**
- Modify: `client/src-tauri/src/sftp.rs`

**Interfaces:**
- Consumes: `SftpSessions`
- Produces: `sftp_search` command

- [ ] **Step 1: Implement sftp_search command**

```rust
#[tauri::command]
pub async fn sftp_search(
    session_id: String,
    path: String,
    query: String,
    sftp_sessions: tauri::State<'_, SftpSessions>,
) -> Result<Vec<SftpEntry>, String> {
    let map = sftp_sessions.sessions.lock().map_err(|e| e.to_string())?;
    let session = map.get(&session_id).ok_or("SFTP session not found")?;
    let sftp = &session.sftp;

    let mut results = Vec::new();
    let query_lower = query.to_lowercase();

    async fn search_recursive(
        sftp: &russh_sftp::client::SftpSession,
        current_path: &str,
        query: &str,
        results: &mut Vec<SftpEntry>,
        max_results: usize,
    ) -> Result<(), String> {
        if results.len() >= max_results {
            return Ok(());
        }

        let mut read_dir = sftp.read_dir(current_path).await.map_err(|e| format!("readdir: {e}"))?;
        while let Some(entry) = read_dir.next().await {
            if results.len() >= max_results {
                break;
            }

            let entry = entry.map_err(|e| format!("entry: {e}"))?;
            let name = entry.file_name();
            let entry_path = format!("{}/{}", current_path.trim_end_matches('/'), name);

            if name.to_lowercase().contains(query) {
                let metadata = entry.metadata().await.map_err(|e| format!("metadata: {e}"))?;
                let attrs = metadata.attributes;
                results.push(SftpEntry {
                    name,
                    path: entry_path.clone(),
                    is_dir: attrs.is_dir(),
                    is_symlink: attrs.is_symlink(),
                    size: attrs.len().unwrap_or(0),
                    mode: attrs.permissions().unwrap_or(0),
                    uid: 0,
                    gid: 0,
                    mtime: attrs.modified().map(|t| t.as_secs_millis() as i64).unwrap_or(0),
                    atime: attrs.accessed().map(|t| t.as_secs_millis() as i64).unwrap_or(0),
                    symlink_target: None,
                });
            }

            // Recurse into directories
            if attrs.is_dir() {
                Box::pin(search_recursive(sftp, &entry_path, query, results, max_results)).await?;
            }
        }
        Ok(())
    }

    search_recursive(sftp, &path, &query_lower, &mut results, 1000).await?;
    Ok(results)
}
```

- [ ] **Step 2: Register command in lib.rs**

Add to invoke_handler:
```rust
sftp::sftp_search,
```

- [ ] **Step 3: Run cargo check**

Run: `cd client/src-tauri && cargo check`
Expected: Compiles

- [ ] **Step 4: Commit**

```bash
cd client && git add -A && git commit -m "feat(sftp): implement recursive search"
```

---

## Phase 4: Frontend Integration

### Task 8: RemoteFileProvider implementation

**Files:**
- Create: `client/src/lib/sftp/remoteFs.ts`

**Interfaces:**
- Consumes: Tauri `invoke` for SFTP IPC commands
- Produces: `RemoteFileProvider` class implementing `FileProvider`

- [ ] **Step 1: Create remoteFs.ts**

```typescript
// client/src/lib/sftp/remoteFs.ts
import type { FileItem, ProgressCallback } from "./fileTransfer";

export interface RemoteFileProvider {
  type: "remote";
  id: string;
  listFiles(path: string): Promise<FileItem[]>;
  readFile(path: string): Promise<Uint8Array>;
  writeFile(
    path: string,
    data: Uint8Array,
    onProgress?: ProgressCallback,
  ): Promise<void>;
  moveFile(source: string, dest: string): Promise<void>;
  copyFile(source: string, dest: string): Promise<void>;
  exists(path: string): Promise<boolean>;
  mkdir(path: string): Promise<void>;
  chmod(path: string, mode: number): Promise<void>;
  chown(path: string, uid: number, gid: number): Promise<void>;
  symlink(target: string, linkPath: string): Promise<void>;
  readlink(path: string): Promise<string>;
  stat(path: string): Promise<FileItem>;
  search(path: string, query: string): Promise<FileItem[]>;
  download(
    remotePath: string,
    localPath: string,
    onProgress?: ProgressCallback,
  ): Promise<void>;
  upload(
    localPath: string,
    remotePath: string,
    onProgress?: ProgressCallback,
  ): Promise<void>;
}

export class RemoteFileProviderImpl implements RemoteFileProvider {
  type = "remote" as const;
  private invoke: typeof import("@tauri-apps/api/core").invoke;

  constructor(
    public id: string,
    private sessionId: string,
  ) {
    this.invoke = null as any; // Lazy load
  }

  private async getInvoke() {
    if (!this.invoke) {
      const mod = await import("@tauri-apps/api/core");
      this.invoke = mod.invoke;
    }
    return this.invoke;
  }

  async listFiles(path: string): Promise<FileItem[]> {
    const invoke = await this.getInvoke();
    const entries = await invoke<
      Array<{
        name: string;
        path: string;
        is_dir: boolean;
        is_symlink: boolean;
        size: number;
        mode: number;
        uid: number;
        gid: number;
        mtime: number;
        atime: number;
        symlink_target: string | null;
      }>
    >("sftp_list", { sessionId: this.sessionId, path });

    return entries.map((e) => ({
      name: e.name,
      path: e.path,
      isDirectory: e.is_dir,
      isSymlink: e.is_symlink,
      size: e.size,
      mode: e.mode,
      uid: e.uid,
      gid: e.gid,
      mtime: e.mtime,
      atime: e.atime,
      symlinkTarget: e.symlink_target,
    }));
  }

  async readFile(path: string): Promise<Uint8Array> {
    const invoke = await this.getInvoke();
    // Read in chunks for large files
    const chunkSize = 64 * 1024;
    const chunks: Uint8Array[] = [];
    let offset = 0;

    while (true) {
      const chunk = await invoke<number[]>("sftp_read", {
        sessionId: this.sessionId,
        path,
        offset,
        len: chunkSize,
      });
      if (chunk.length === 0) break;
      chunks.push(new Uint8Array(chunk));
      offset += chunk.length;
    }

    // Combine chunks
    const total = chunks.reduce((sum, c) => sum + c.length, 0);
    const result = new Uint8Array(total);
    let pos = 0;
    for (const chunk of chunks) {
      result.set(chunk, pos);
      pos += chunk.length;
    }
    return result;
  }

  async writeFile(
    path: string,
    data: Uint8Array,
    onProgress?: ProgressCallback,
  ): Promise<void> {
    const invoke = await this.getInvoke();
    const chunkSize = 64 * 1024;
    const total = data.length;

    for (let offset = 0; offset < total; offset += chunkSize) {
      const chunk = data.slice(offset, offset + chunkSize);
      await invoke("sftp_write", {
        sessionId: this.sessionId,
        path,
        data: Array.from(chunk),
        offset,
      });
      onProgress?.(Math.min(offset + chunkSize, total), total);
    }
  }

  async moveFile(source: string, dest: string): Promise<void> {
    const invoke = await this.getInvoke();
    await invoke("sftp_rename", {
      sessionId: this.sessionId,
      oldPath: source,
      newPath: dest,
    });
  }

  async copyFile(source: string, dest: string): Promise<void> {
    // SFTP doesn't have native copy - read then write
    const data = await this.readFile(source);
    await this.writeFile(dest, data);
  }

  async exists(path: string): Promise<boolean> {
    try {
      await this.stat(path);
      return true;
    } catch {
      return false;
    }
  }

  async mkdir(path: string): Promise<void> {
    const invoke = await this.getInvoke();
    await invoke("sftp_mkdir", { sessionId: this.sessionId, path });
  }

  async chmod(path: string, mode: number): Promise<void> {
    const invoke = await this.getInvoke();
    await invoke("sftp_chmod", { sessionId: this.sessionId, path, mode });
  }

  async chown(path: string, uid: number, gid: number): Promise<void> {
    const invoke = await this.getInvoke();
    await invoke("sftp_chown", { sessionId: this.sessionId, path, uid, gid });
  }

  async symlink(target: string, linkPath: string): Promise<void> {
    const invoke = await this.getInvoke();
    await invoke("sftp_symlink", {
      sessionId: this.sessionId,
      target,
      linkPath,
    });
  }

  async readlink(path: string): Promise<string> {
    const invoke = await this.getInvoke();
    return invoke("sftp_readlink", { sessionId: this.sessionId, path });
  }

  async stat(path: string): Promise<FileItem> {
    const invoke = await this.getInvoke();
    const e = await invoke<{
      name: string;
      path: string;
      is_dir: boolean;
      is_symlink: boolean;
      size: number;
      mode: number;
      uid: number;
      gid: number;
      mtime: number;
      atime: number;
      symlink_target: string | null;
    }>("sftp_stat", { sessionId: this.sessionId, path });

    return {
      name: e.name,
      path: e.path,
      isDirectory: e.is_dir,
      isSymlink: e.is_symlink,
      size: e.size,
      mode: e.mode,
      uid: e.uid,
      gid: e.gid,
      mtime: e.mtime,
      atime: e.atime,
      symlinkTarget: e.symlink_target,
    };
  }

  async search(path: string, query: string): Promise<FileItem[]> {
    const invoke = await this.getInvoke();
    const entries = await invoke<
      Array<{
        name: string;
        path: string;
        is_dir: boolean;
        is_symlink: boolean;
        size: number;
        mode: number;
        uid: number;
        gid: number;
        mtime: number;
        atime: number;
        symlink_target: string | null;
      }>
    >("sftp_search", { sessionId: this.sessionId, path, query });

    return entries.map((e) => ({
      name: e.name,
      path: e.path,
      isDirectory: e.is_dir,
      isSymlink: e.is_symlink,
      size: e.size,
      mode: e.mode,
      uid: e.uid,
      gid: e.gid,
      mtime: e.mtime,
      atime: e.atime,
      symlinkTarget: e.symlink_target,
    }));
  }

  async download(
    remotePath: string,
    localPath: string,
    onProgress?: ProgressCallback,
  ): Promise<void> {
    const invoke = await this.getInvoke();
    const transferId = crypto.randomUUID();

    // Start download in Rust (runs in background)
    await invoke("sftp_download", {
      sessionId: this.sessionId,
      remotePath,
      localPath,
      transferId,
    });
  }

  async upload(
    localPath: string,
    remotePath: string,
    onProgress?: ProgressCallback,
  ): Promise<void> {
    const invoke = await this.getInvoke();
    const transferId = crypto.randomUUID();

    await invoke("sftp_upload", {
      sessionId: this.sessionId,
      localPath,
      remotePath,
      transferId,
    });
  }
}
```

- [ ] **Step 2: Run biome check**

Run: `cd client && pnpm biome check src/lib/sftp/remoteFs.ts`
Expected: Passes (or auto-fixable issues)

- [ ] **Step 3: Commit**

```bash
cd client && git add -A && git commit -m "feat(sftp): implement RemoteFileProvider"
```

---

### Task 9: Wire into useFileOperations stubs

**Files:**
- Modify: `client/src/hooks/sftp/useFileOperations.ts`

**Interfaces:**
- Consumes: `RemoteFileProviderImpl`
- Produces: All file operations now call real SFTP commands

- [ ] **Step 1: Replace TODO stubs in useFileOperations.ts**

Find and replace each `// TODO: SSH ...` block with actual `RemoteFileProvider` calls. The exact implementation depends on the existing code structure.

- [ ] **Step 2: Run biome check**

Run: `cd client && pnpm biome check src/hooks/sftp/useFileOperations.ts`

- [ ] **Step 3: Run tests**

Run: `cd client && pnpm vitest run`
Expected: All tests pass

- [ ] **Step 4: Commit**

```bash
cd client && git add -A && git commit -m "feat(sftp): wire RemoteFileProvider into useFileOperations"
```

---

### Task 10: SFTP connection UI integration

**Files:**
- Modify: `client/src/components/sftp/browser/FileBrowser.tsx`
- Modify: `client/src/stores/sftp/sftpStore.ts`

**Interfaces:**
- Consumes: `sftp_connect_saved`, `sftp_connect`, `sftp_disconnect` IPC commands
- Produces: SFTP connection state management

- [ ] **Step 1: Add SFTP connection state to sftpStore.ts**

Add to `sftpStore.ts`:
```typescript
interface SftpConnectionState {
  sessionId: string | null;
  hostId: string | null;
  host: string;
  port: number;
  username: string;
  connected: boolean;
  connecting: boolean;
  error: string | null;
}

// Add to SftpState:
sftpConnection: SftpConnectionState;
connectSftp: (hostId: string) => Promise<void>;
connectSftpDirect: (config: SshConfig) => Promise<void>;
disconnectSftp: () => Promise<void>;
```

- [ ] **Step 2: Implement connection methods in sftpStore.ts**

```typescript
connectSftp: async (hostId: string) => {
  set({ sftpConnection: { ...get().sftpConnection, connecting: true, error: null } });
  try {
    const { invoke } = await import("@tauri-apps/api/core");
    const sessionId = `sftp-${hostId}-${Date.now()}`;
    const result = await invoke<SftpConnectResult>("sftp_connect_saved", {
      sessionId,
      hostId,
    });
    set({
      sftpConnection: {
        sessionId: result.session_id,
        hostId,
        host: result.host,
        port: result.port,
        username: result.username,
        connected: true,
        connecting: false,
        error: null,
      },
    });
  } catch (err) {
    set({
      sftpConnection: {
        ...get().sftpConnection,
        connecting: false,
        error: String(err),
      },
    });
  }
},
```

- [ ] **Step 3: Wire FileBrowser.tsx to connect on mount**

In `FileBrowser.tsx`, add effect to connect SFTP when component mounts with hostId.

- [ ] **Step 4: Add progress event listener**

In `sftpStore.ts`, add Tauri event listener for `sftp-transfer-progress` to update transfer state.

- [ ] **Step 5: Run tests**

Run: `cd client && pnpm vitest run`
Expected: All tests pass

- [ ] **Step 6: Commit**

```bash
cd client && git add -A && git commit -m "feat(sftp): wire SFTP connection UI and progress events"
```

---

## Phase 5: Polish

### Task 11: Error handling

**Files:**
- Modify: `client/src/hooks/sftp/useFileOperations.ts`
- Modify: `client/src/stores/sftp/sftpStore.ts`

**Interfaces:**
- Consumes: All SFTP operations
- Produces: Proper error display (inline, toast, modal)

- [ ] **Step 1: Add error handling to all SFTP operations**

Wrap each operation in try/catch with appropriate error display:
- Connection failures → modal
- Operation failures → inline error
- Transfer failures → toast

- [ ] **Step 2: Add error state to sftpStore**

```typescript
interface SftpErrorState {
  lastError: string | null;
  errorType: "connection" | "operation" | "transfer" | null;
}
```

- [ ] **Step 3: Run tests**

Run: `cd client && pnpm vitest run`

- [ ] **Step 4: Commit**

```bash
cd client && git add -A && git commit -m "feat(sftp): add comprehensive error handling"
```

---

### Task 12: Final testing and cleanup

- [ ] **Step 1: Run full test suite**

Run: `cd client && pnpm vitest run`
Expected: All 141+ tests pass

- [ ] **Step 2: Run Rust tests**

Run: `cd client/src-tauri && cargo test`
Expected: All tests pass

- [ ] **Step 3: Manual testing checklist**

- [ ] Connect to saved host via SFTP
- [ ] Connect to direct host via SFTP
- [ ] List files in root directory
- [ ] Navigate into subdirectory
- [ ] Upload a file (check progress)
- [ ] Download a file (check progress)
- [ ] Create new directory
- [ ] Rename a file
- [ ] Delete a file
- [ ] Change permissions (chmod)
- [ ] Create symlink
- [ ] Search for files
- [ ] Disconnect and reconnect

- [ ] **Step 4: Final commit**

```bash
cd client && git add -A && git commit -m "feat(sftp): complete SFTP file browser implementation"
cd .. && git add client && git commit -m "client: SFTP file browser feature"
```

---

## Summary

| Phase | Tasks | Deliverable |
|-------|-------|-------------|
| 1: Rust Foundation | 1-3 | SFTP connection + basic operations |
| 2: File Operations | 4-5 | Full CRUD + permissions |
| 3: Transfer System | 6-7 | Streaming + search |
| 4: Frontend Integration | 8-10 | RemoteFileProvider + UI wiring |
| 5: Polish | 11-12 | Error handling + testing |

**Total:** 12 tasks, ~176 steps
