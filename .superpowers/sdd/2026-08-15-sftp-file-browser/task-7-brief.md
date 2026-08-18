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
