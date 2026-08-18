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
