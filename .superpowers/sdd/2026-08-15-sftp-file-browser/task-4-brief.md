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
