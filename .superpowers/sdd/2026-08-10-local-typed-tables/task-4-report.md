# Task T3 Report: Manage `LocalDb` + `db_*` Tauri commands

## Status: DONE

## What was implemented

All changes in `client/src-tauri/src/lib.rs` (only file modified; no db.rs changes needed — `Table::parse`, `db::open`, and all helpers already had the required names/signatures).

1. **Five new Tauri commands** (verbatim from brief, placed near `wipe_local_data`):
   - `db_upsert(db, table, row) -> Result<SyncRow, String>` — parses table via `db::Table::parse`, deserializes `row` from `serde_json::Value` into `SyncRow`, calls `db::upsert_sync_row`.
   - `db_get(db, table, id) -> Result<Option<SyncRow>, String>` — `db::get_sync_row`.
   - `db_list(db, table, vault_id, include_deleted: Option<bool>) -> Result<Vec<SyncRow>, String>` — `db::list_sync_rows`, defaults `include_deleted` to `false`.
   - `db_delete(db, table, id) -> Result<(), String>` — `db::tombstone_sync_row` (tombstone, outbox entry).
   - `db_outbox(db) -> Result<Vec<OutboxEntry>, String>` — `db::outbox_pending`.

2. **`wipe_local_data` rewritten** from `AppHandle` (re-opening the DB file and materializing an empty DB) to `State<'_, db::LocalDb>` + `db::wipe_all(&db)` — row wipe on the managed connection. T0's note (managed connection holds file open; Windows can't delete open files) is now satisfied by design.

3. **`LocalDb` managed in `.setup`** — after `window.set_title(...)`, before the `main-ready` listen:
   ```rust
   let data_dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
   let db_path = data_dir.join(db::DB_FILE_NAME);
   app.manage(db::open(&db_path.display().to_string())?);
   ```
   Opened once at setup, held for app lifetime.

4. **Commands registered** in the single existing `invoke_handler` via `tauri::generate_handler![...]` (merged, not a second handler — Tauri requires one macro). Added `db_upsert, db_get, db_list, db_delete, db_outbox` right after `wipe_local_data`.

## Field mapping / T4 contract notes

- Tauri camelCase ↔ snake_case auto-conversion is in effect: JS must pass `vaultId` → Rust `vault_id`, `includeDeleted` → `include_deleted`. `table`/`id`/`row` are already single words.
- `SyncRow` has `#[serde(rename_all = "snake_case")]` (db.rs:604) — the `row` object the UI sends must use snake_case keys (`vault_id`, `created_at`, `updated_at`, `deleted_at`, `sort_order`, `parent_id`, `group_id`, `key_id`), NOT camelCase. This is the one naming divergence to flag for T4: inside `row`, `vaultId`/`createdAt` would fail deserialization.
- Unknown `table` string → error from `Table::parse` (e.g. "unknown table: hosts; DROP TABLE groups") — injection-safe, single table names only.
- `db_upsert` returns the rewritten row (revision bumped, timestamps set) — the UI should use the returned row, not echo the input.
- `db_list` includes both live rows and tombstones when `includeDeleted` is true; default excludes tombstones.

## Files changed

- `client/src-tauri/src/lib.rs` (modified only — brief listed no db.rs helper changes and none were needed)

## Test/compile evidence

- `cargo check` (in `client/src-tauri`): **PASS** — `Finished dev profile` in ~2m56s. Only 27 warnings, all pre-existing (verified the `unused variable: table` warning is the pre-existing one at `db.rs:429` `row_from`, untouched by this task). No new warnings introduced.
- `cargo test` (in `client/src-tauri`): **PASS** — `39 passed; 0 failed` across all suites (13 db + 26 http). Output: `test result: ok. 39 passed; 0 failed; 0 ignored`.
- Tauri v2 command registration verified at compile time by `generate_handler!` macro expansion (would fail to compile on wrong state/arg types).

## Self-review findings

1. `State<'_, LocalDb>` requires `LocalDb: Send + Sync` — satisfied: `LocalDb { conn: Mutex<Connection> }`, `rusqlite::Connection` is `Send`, so `Mutex<Connection>` is `Send + Sync`. Compiler confirms.
2. `&db` where `db: tauri::State<LocalDb>` derefs to `&LocalDb` via `Deref` — all `db::*` calls take `&LocalDb`. Compiles.
3. `wipe_local_data` frontend contract unchanged (still `invoke("wipe_local_data")` → `()`), so no UI breakage; behavioral difference: wipes managed connection's rows instead of opening the file (no empty-file materialization).
4. DB opened lazily at setup — if `app_data_dir()`/open fails, the app fails setup with a `String` error surfaced by `?`. Acceptable per brief (same data_dir logic as before).
5. `OutboxEntry` is `Serialize` only (db.rs:514) — fine for a command return to JS.
6. No dead code introduced: all five commands are referenced in `generate_handler!` (first new warnings check confirms none point at lib.rs beyond pre-existing stubs).

## Concerns

- None blocking. Minor note for T4: sync-row field names inside `row` must be snake_case (see above); and `db_list`'s `includeDeleted` param is optional (`false` default) — the JS call layer must pass `vaultId` (camelCase) which Tauri maps to `vault_id`.