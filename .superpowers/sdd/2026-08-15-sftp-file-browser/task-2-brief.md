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
