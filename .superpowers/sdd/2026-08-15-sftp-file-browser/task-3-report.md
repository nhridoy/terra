# Task 3 Report: Basic file operations (list, stat, read)

## Status: DONE

## What I implemented

Three new Tauri commands in `client/src-tauri/src/sftp.rs`:

1. **`sftp_list`** — Lists directory contents, returning `Vec<SftpEntry>` with name, path, is_dir, is_symlink, size, mode, uid, gid, mtime, atime for each entry.

2. **`sftp_stat`** — Returns metadata for a single path as `SftpEntry`.

3. **`sftp_read`** — Reads bytes from a file at a given offset and length, returning `Vec<u8>` (supports partial/range reads).

Supporting changes:
- **`attrs_to_entry`** helper — converts `russh_sftp::client::fs::Metadata` (FileAttributes) to our `SftpEntry` struct. Uses raw `permissions`, `uid`, `gid`, `mtime`, `atime` fields directly from FileAttributes rather than the higher-level accessor methods (which return complex types like `FilePermissions`).
- **`get_sftp`** helper — locks the sessions map, clones the `Arc<russh_sftp::client::SftpSession>`, and drops the lock before any async work. This avoids the `MutexGuard`-not-`Send` issue with `std::sync::Mutex`.
- **`SftpSession.sftp`** changed from `russh_sftp::client::SftpSession` to `Arc<russh_sftp::client::SftpSession>` to enable cloning before dropping the lock.

## Adaptations from task brief to actual russh-sftp 2.4.0 API

- `read_dir()` returns a sync `ReadDir` iterator (not async) — used `.filter_map()` directly
- `DirEntry::metadata()` returns `FileAttributes` directly (not async)
- `SftpSession::metadata()` returns `FileAttributes` directly (not async)
- `FileAttributes.permissions` is `Option<u32>` (raw mode bits) — used directly instead of `permissions()` method which returns `FilePermissions` struct (no `Into<u32>` impl)
- `FileAttributes.mtime`/`atime` are `Option<u32>` (seconds since epoch) — used directly instead of `modified()`/`accessed()` which return `io::Result<SystemTime>`

## Commands registered in lib.rs

Added `sftp::sftp_list`, `sftp::sftp_stat`, `sftp::sftp_read` to the invoke_handler.

## Test results

- `cargo check`: Compiles cleanly (only pre-existing warnings)
- `cargo test`: 48/48 passing, output pristine

## Files changed

- `client/src-tauri/src/sftp.rs` — Added `attrs_to_entry`, `get_sftp`, `sftp_list`, `sftp_stat`, `sftp_read`; changed `SftpSession.sftp` to `Arc<SftpSession>`; updated two SftpSession construction sites
- `client/src-tauri/src/lib.rs` — Registered three new commands in invoke_handler

## Self-review findings

- All task requirements implemented
- Code follows existing patterns (error mapping with `.map_err()`, command signatures matching existing style)
- The `Arc` wrapping is necessary because `russh_sftp::client::SftpSession` doesn't implement `Clone`, and we need to release the `std::sync::Mutex` lock before async operations
- No overbuilding — implemented exactly the three commands and helpers specified
