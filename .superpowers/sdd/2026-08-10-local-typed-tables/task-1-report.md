# Task T0 Report — Typed synced tables schema, drop `records`, `wipe_all`

- **Date:** 2026-08-10
- **Branch:** `ai` (base commit bc38a4f)
- **Status:** DONE
- **Commit:** `e131c39` — `feat: typed synced tables schema, outbox/conflicts/sync-meta, wipe_all`

## What I implemented

In `client/src-tauri/src/db.rs` (per brief, verbatim except noted):

1. **DDL**: Replaced the `records` table + 3 `records` indexes with the 6 typed synced tables (`groups`, `hosts`, `keys`, `snippets`, `workspaces`, `presets`) each with the shared envelope (id, revision, vault_id, created_at, updated_at, deleted_at) + whitelist columns + opaque `data` blob + per-table index, plus `outbox`, `sync_conflicts`, and `__sync_meta`. No FK constraints (hydration order independence). `user_profiles`, `user_keys`, `vaults` untouched.
2. **Removed**: `RecordRow` struct, `upsert_record`, `query_records`, `delete_record`, `hard_delete_record`, and their 3 tests. Removed now-unused `use std::path::{Path, PathBuf}` import.
3. **Added**: `pub fn wipe_all(db: &LocalDb) -> Result<(), String>` — row-deletion of all 12 tables (no VACUUM); replaces `wipe_database` (file deletion) and its 2 tests, which were deleted.
4. **Tests**: Replaced `test_open_creates_tables` with `test_open_creates_synced_tables` (asserts the 12 tables exist, `records` does not); added `test_wipe_all_clears_every_row`.
5. **Preserved verbatim** (as required): `upsert_user_profile`, `get_user_profile`, `upsert_keyring`, `get_keyring`, `upsert_vault` and their 5 tests, plus `open()`, `LocalDb`, `chrono_utc_now`.
6. **lib.rs (minimal, required)**: `db::wipe_database` no longer exists, so `wipe_local_data` (lib.rs:50-53) would not compile. Adjusted it to open the DB and call `wipe_all`:
   ```rust
   let local_db = db::open(&dir.join(db::DB_FILE_NAME).to_string_lossy())?;
   db::wipe_all(&local_db)
   ```
   Only 2 lines changed; the command's signature and semantics (wipe on demand) are unchanged apart from the implementation detail. T3 rewrites it when the DB becomes managed state.

## TDD evidence

### RED

Command: `cargo test db::tests::test_open_creates_synced_tables` (tests added, implementation absent)

```
error[E0425]: cannot find function `wipe_all` in this scope
   --> src\db.rs:428:9
428 |         wipe_all(&db).unwrap();
    |         ^^^^^^^^ not found in this scope
error: could not compile `termvault` (lib test) due to 1 previous error
```

### GREEN

Command: `cargo test db::` (after implementation)

```
running 7 tests
test db::tests::test_upsert_user_profile_roundtrip ... ok
test db::tests::test_upsert_keyring_roundtrip ... ok
test db::tests::test_upsert_keyring_updates ... ok
test db::tests::test_open_creates_synced_tables ... ok
test db::tests::test_upsert_vault_roundtrip ... ok
test db::tests::test_upsert_user_profile_updates ... ok
test db::tests::test_wipe_all_clears_every_row ... ok
test result: ok. 7 passed; 0 failed; 0 ignored; 0 measured; 26 filtered out
```

### Full suite

Command: `cargo test`

```
test result: ok. 33 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out
```

## Files changed

- `client/src-tauri/src/db.rs` — schema + wipe_all + tests (144 insertions, 228 deletions across both files)
- `client/src-tauri/src/lib.rs` — `wipe_local_data` body (2 lines, see above)

## Self-review findings

1. **Brief deviation (required)**: the brief's DDL block starts with a `// --- Synced tables:` comment block *inside* the SQL string passed to `execute_batch`. `//` is not a valid SQLite comment → `near "/": syntax error`. I converted those 4 lines to SQL `--` comments (text preserved). Without this the DDL cannot execute.
2. **lib.rs had to be touched**: the brief mandates removing `wipe_database`, which lib.rs referenced; leaving it untouched breaks the build. Change is minimal and flagged here. Side effect: the command now creates the DB file (empty, schema-initialized) if missing before wiping — acceptable stopgap until T3.
3. **Pre-existing flaky test** (not caused by this task): `http::tests::test_single_flight_concurrent_401s` failed on 2 of 3 full-suite runs, but also fails at base commit bc38a4f with my changes stashed (reproduced: `assertion failed: matches!(r1, Err(HttpErrorKind::SessionExpired))` at http.rs:510). Passes in isolation every time (3/3). It's a timing-sensitive initiator/waiter race between two concurrent requests. Suggested fix for a later task: assert `{SessionExpired, Http(401)}` set membership or poll until both complete, or serialize the two requests. Out of scope here.
4. Cleanup: removed the now-dead `Path`/`PathBuf` import; collapsed surplus blank lines left by the deletions. No new crates; warnings in the build are all pre-existing (lib.rs/crypto.rs).
5. `records`-related items (DDL, functions, tests) were confirmed contained in `db.rs` before removal (grepped whole `client/` tree).

## Concerns

- `test_single_flight_concurrent_401s` is flaky on this machine under full-suite load (pre-existing; reproduced at base). Not blocking T0, but CI would be intermittently red. Recommend a follow-up fix in the http.rs task area.
- `wipe_all` does not clear `sqlite_sequence` or VACUUM — per brief, intentional (file size retained).
- No migration for existing user DBs containing `records` data: old `records` table rows are simply orphaned (the table is not dropped in this task — `CREATE TABLE IF NOT EXISTS` leaves it in place). Plan says a later task handles hydration; flagging that the stale `records` table persists on disk for existing installs and its data is not migrated.
