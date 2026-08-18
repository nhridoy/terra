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
