# Task 6: Streaming Transfers with Progress Events — Report

## What Was Implemented

Added two new Tauri commands to `client/src-tauri/src/sftp.rs`:

- **`sftp_download`** — Streams a remote file to a local path in 64KB chunks, emitting `sftp-transfer-progress` events via Tauri's `Emitter` trait with session ID, transfer ID, bytes transferred, total bytes, and speed.
- **`sftp_upload`** — Streams a local file to a remote path in 64KB chunks with the same progress event model. Calls `sync_all()` after the transfer completes.

Both commands:
- Clone the `Arc<SftpSession>` under the mutex lock and drop the guard before any `.await` to avoid holding a `MutexGuard` across await points (which would violate `Send`).
- Accept a `transfer_id` parameter for frontend to correlate progress events.
- Emit progress on every chunk read/write.
- Are registered in `lib.rs` invoke handler.

## Deviations from Task Brief

1. **Lock strategy**: The task brief held the mutex guard across the entire async function. This caused a compile error (`future is not Send`). Fixed by cloning the `Arc<SftpSession>` inside a block and dropping the lock before async work — the same pattern used by `get_sftp()` in other commands.

2. **Metadata API**: The task brief used `metadata.attributes.len().unwrap_or(0)`. The actual `russh_sftp` API exposes `metadata.len()` directly (returns `u64`, not `Option<u64>`). Fixed accordingly.

3. **Emitter import**: Added `use tauri::Emitter;` to `sftp.rs` (the trait must be in scope for `app_handle.emit()`).

## Files Changed

- `client/src-tauri/src/sftp.rs` — Added `sftp_download`, `sftp_upload`, and `use tauri::Emitter`
- `client/src-tauri/src/lib.rs` — Registered `sftp::sftp_download` and `sftp::sftp_upload` in invoke handler

## Verification

- `cargo check` passes with zero new warnings (17 pre-existing warnings, all unrelated).

## Commit

- `645537f` feat(sftp): implement streaming transfers with progress events
