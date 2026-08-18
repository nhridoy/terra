# Task 1 Report: Add russh-sftp dependency and create sftp.rs skeleton

## What I implemented

- Added `russh-sftp = "2.4"` to `client/src-tauri/Cargo.toml`
- Created `client/src-tauri/src/sftp.rs` with type definitions:
  - `SftpEntry` — file/directory listing entry
  - `SftpConnectResult` — connection result metadata
  - `SftpTransferProgress` — transfer progress event
  - `SftpSession` — holds an active SFTP session + SSH handle
  - `SftpSessions` — thread-safe session map (Arc<Mutex<HashMap>>)
- Registered `mod sftp` in `lib.rs`
- Added `.manage(sftp::SftpSessions::new())` to Tauri state
- Made `SshHandler` public in `ssh.rs` (required for `SftpSession::ssh_handle` type)

## Test results

- `cargo check` passes. Only warnings: unused import `tokio::sync::oneshot` (expected for skeleton) and pre-existing warnings in `crypto.rs`.

## Files changed

- `client/src-tauri/Cargo.toml` — added russh-sftp dependency
- `client/src-tauri/Cargo.lock` — updated lockfile
- `client/src-tauri/src/sftp.rs` — new file with type skeleton
- `client/src-tauri/src/lib.rs` — added `mod sftp` + state management
- `client/src-tauri/src/ssh.rs` — made `SshHandler` pub

## Self-review

- All types from the spec are present
- `SshHandler` visibility change is minimal and necessary
- No overbuilding — just the skeleton as specified
- Follows existing patterns (similar to `SshSessions` in `ssh.rs`)

## Commit

`8dda298` — feat(sftp): add russh-sftp dependency and type skeleton
