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
