# Task 4: Write operations (write, mkdir, rename, delete)

## What I implemented

Added four SFTP write operations to `client/src-tauri/src/sftp.rs`:

- **`sftp_write`** — Opens a file with CREATE|WRITE|TRUNCATE flags, seeks to offset, writes data, and calls sync_all (fsync). Follows the same pattern as `sftp_read` (uses `get_sftp` helper, `AsyncSeekExt`/`AsyncWriteExt`).
- **`sftp_mkdir`** — Creates a directory via `sftp.create_dir()`.
- **`sftp_rename`** — Renames/moves a file or directory via `sftp.rename()`.
- **`sftp_delete`** — Deletes a file or directory. Non-recursive: checks metadata to choose `remove_file` vs `remove_dir`. Recursive: uses a private `sftp_delete_recursive` helper that iterates directory contents, deletes children first (depth-first), then removes the parent.

All four commands registered in `lib.rs` invoke handler.

## Deviations from brief

The brief's `sftp_delete` tried to recursively call the `#[tauri::command] sftp_delete` function with `sftp_sessions.clone()`, but `tauri::State` can't be cloned or constructed inside a command. I extracted the recursive logic into a private `sftp_delete_recursive` helper that takes `&SftpSession` directly, avoiding this issue entirely. The public `sftp_delete` command delegates to it for the recursive case.

## Fixes needed vs brief

The brief had three compilation errors that I fixed:
1. **`metadata.attributes.is_dir()`** → `metadata.is_dir()` — `Metadata` has `is_dir()` as a direct method, not through `.attributes`.
2. **`read_dir.next().await`** → `for entry in read_dir` — `Dir` is a synchronous iterator, not an async stream.
3. **MutexGuard held across `.await`** — All four commands now use `get_sftp()` which returns `Arc<SftpSession>` and drops the lock before async work (matching the pattern of `sftp_list`, `sftp_stat`, `sftp_read`).

## Changes

- `client/src-tauri/src/sftp.rs` — Added `#[derive(Clone)]` to `SftpSessions`, added `sftp_write`, `sftp_mkdir`, `sftp_rename`, `sftp_delete` commands + `sftp_delete_recursive` helper (122 lines added)
- `client/src-tauri/src/lib.rs` — Registered 4 new commands in invoke handler

## Tests

No unit tests (task brief did not require TDD). Verified with `cargo check` — compiles cleanly. All warnings are pre-existing.

## Self-review

- All four spec commands implemented with correct signatures ✓
- Follows existing codebase patterns (`get_sftp`, error format `format!("{op}: {e}")`) ✓
- No overbuilding — each function is minimal and focused ✓
- Recursive delete handles nested directories correctly (depth-first traversal) ✓
- `sftp_write` properly flushes with `sync_all` for data durability ✓
