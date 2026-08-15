# SFTP File Browser — Design Spec

## Overview

Full-featured SFTP file browser for TermVault. Builds on the existing dual-pane UI (already implemented) by connecting the stubbed remote operations to a real Rust SFTP backend via russh.

## Architecture

### Rust Backend — `sftp.rs`

New module in `client/src-tauri/src/sftp.rs`. Uses russh's SFTP subsystem feature.

**Enable in Cargo.toml:**
```toml
russh = { version = "0.62", default-features = false, features = ["ring", "rsa", "flate2", "sftp"] }
```

**Connection model:**
- Reuse existing SSH session from `SshSessions` if one exists for the target host
- Otherwise create a new SSH connection, authenticate, then open an SFTP subsystem channel
- SFTP connections persist in a `SftpSessions` state (similar to `SshSessions`) until user manually disconnects
- Reconnection reconnects to the same host using stored credentials

**SftpSessions state:**
```rust
pub struct SftpSessions {
    /// Active SFTP sessions keyed by session_id
    sessions: Arc<Mutex<HashMap<String, SftpSession>>>,
}

struct SftpSession {
    host_id: Option<String>,      // saved host ID (if any)
    host: String,
    port: u16,
    username: String,
    sftp: Mutex<russh::sftp::SftpSession>,  // the SFTP subsystem session
    ssh_handle: Option<russh::client::Handle<SshHandler>>,  // keep SSH alive
}
```

### IPC Commands

| Command | Request | Response | Notes |
|---------|---------|----------|-------|
| `sftp_connect_saved` | `{session_id, host_id}` | `SftpConnectResult` | Loads encrypted host from DB, reuses SSH if available |
| `sftp_connect` | `{session_id, config: SshConfig}` | `SftpConnectResult` | Direct connection with plaintext creds |
| `sftp_disconnect` | `{session_id}` | `()` | Tears down SFTP channel + SSH if we created it |
| `sftp_list` | `{session_id, path}` | `Vec<SftpEntry>` | List directory, returns entries with stats |
| `sftp_read` | `{session_id, path, offset, len}` | `Vec<u8>` | Read file chunk (streaming) |
| `sftp_write` | `{session_id, path, data, offset}` | `()` | Write file chunk |
| `sftp_write_init` | `{session_id, path, size}` | `transfer_id` | Initialize a write transfer (for progress tracking) |
| `sftp_mkdir` | `{session_id, path}` | `()` | Create directory |
| `sftp_rename` | `{session_id, old_path, new_path}` | `()` | Rename |
| `sftp_delete` | `{session_id, path, recursive}` | `()` | Delete file or directory |
| `sftp_chmod` | `{session_id, path, mode}` | `()` | Change permissions (octal) |
| `sftp_chown` | `{session_id, path, uid, gid}` | `()` | Change ownership |
| `sftp_symlink` | `{session_id, target, link_path}` | `()` | Create symlink |
| `sftp_readlink` | `{session_id, path}` | `String` | Read symlink target |
| `sftp_stat` | `{session_id, path}` | `SftpEntry` | Get file stats |
| `sftp_search` | `{session_id, path, query}` | `Vec<SftpEntry>` | Recursive search |
| `sftp_cancel_transfer` | `{session_id, transfer_id}` | `()` | Cancel in-progress transfer |

**SftpEntry struct:**
```rust
pub struct SftpEntry {
    pub name: String,
    pub path: String,
    pub is_dir: bool,
    pub is_symlink: bool,
    pub size: u64,
    pub mode: u32,           // Unix permissions (octal)
    pub uid: u32,
    pub gid: u32,
    pub mtime: i64,          // Unix timestamp ms
    pub atime: i64,          // Unix timestamp ms
    pub symlink_target: Option<String>,
}
```

**SftpConnectResult:**
```rust
pub struct SftpConnectResult {
    pub session_id: String,
    pub host: String,
    pub port: u16,
    pub username: String,
    pub reused: bool,  // true if reused existing SSH session
}
```

### Transfer System

**Streaming:** Data flows in chunks (64KB default). Rust reads/writes chunks, emits progress events.

**Progress events:** `sftp-transfer-progress` event emitted per chunk:
```json
{
  "sessionId": "...",
  "transferId": "...",
  "type": "upload|download",
  "path": "/remote/path",
  "bytesTransferred": 12345,
  "totalBytes": 100000,
  "speed": 1024.5
}
```

**Resume support:** `sftp_write_init` returns a `transfer_id`. Subsequent `sftp_write` calls include `offset` parameter. If interrupted, frontend can resume from last offset.

**Parallel transfers:** Multiple concurrent transfers supported. Each transfer has its own `transfer_id`. Rust manages them as independent tokio tasks.

### Frontend

**RemoteFileProvider class** — Implements `FileProvider` interface from `lib/sftp/fileTransfer.ts`:
```typescript
class RemoteFileProvider implements FileProvider {
  type = "remote" as const;
  constructor(private sessionId: string, private hostId?: string) {}
  
  async listFiles(path: string): Promise<FileItem[]> { ... }
  async readFile(path: string): Promise<Uint8Array> { ... }
  async writeFile(path: string, data: Uint8Array, onProgress?: ProgressCallback): Promise<void> { ... }
  async moveFile(source: string, dest: string): Promise<void> { ... }
  async copyFile(source: string, dest: string): Promise<void> { ... }
  async exists(path: string): Promise<boolean> { ... }
  async mkdir(path: string): Promise<void> { ... }
  // + chmod, chown, symlink, search
}
```

**Wire into stubs** — Replace all `// TODO: SSH ...` comments in `useFileOperations.ts` with actual `RemoteFileProvider` calls.

**FileBrowser.tsx** — Already passes `hostId`/`hostAddress`/`hostPort`/`hostUsername`. Connect these to `sftp_connect_saved` or `sftp_connect` on mount.

**Transfer panel** — Already built. Wire `useSftpStore.transfers` to Rust progress events.

### Error Handling

| Error type | Display |
|-----------|---------|
| Connection failure | Modal dialog with retry |
| Operation failure (rename, delete, etc.) | Inline error in file browser |
| Transfer failure | Toast notification + error in transfer panel |
| Permission denied | Toast with specific message |

## File Inventory

### New Rust files
- `client/src-tauri/src/sftp.rs` — SFTP connection manager + all IPC commands

### Modified Rust files
- `client/src-tauri/src/lib.rs` — Register SFTP commands in invoke_handler, add `SftpSessions` state
- `client/src-tauri/Cargo.toml` — Add `"sftp"` feature to russh

### New TypeScript files
- `client/src/lib/sftp/remoteFs.ts` — `RemoteFileProvider` implementation

### Modified TypeScript files
- `client/src/hooks/sftp/useFileOperations.ts` — Replace TODO stubs with real operations
- `client/src/components/sftp/browser/FileBrowser.tsx` — Connect to SFTP on mount
- `client/src/stores/sftp/sftpStore.ts` — Add SFTP connection state, progress event listener
- `client/src/lib/sftp/fileTransfer.ts` — Register `RemoteFileProvider`

## Security

- SFTP connections to saved hosts load + decrypt credentials entirely in Rust (zero-knowledge)
- Direct connections carry plaintext creds in IPC (same model as terminal QuickConnect)
- No credentials stored in SFTP session state — only SSH handle + host metadata
- Transfer data streams through Rust, never stored at rest

## Testing

- Unit tests for `sftp.rs` functions (list, stat, rename, etc.) using mock SFTP server
- Integration tests for connection lifecycle (connect, reuse, disconnect)
- Frontend tests for `RemoteFileProvider` (mock IPC)
- Manual test matrix: saved host + direct connect × password + key auth × upload + download
