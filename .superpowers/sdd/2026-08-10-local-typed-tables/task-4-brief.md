### Task T3: Manage `LocalDb` + `db_*` Tauri commands

**Files:**
- Modify: `client/src-tauri/src/lib.rs` (`.setup` ~line 887, manage block ~907, `invoke_handler` ~927, `wipe_local_data` ~50)

**Interfaces:**
- Consumes: T0–T2 `db::*`.
- Produces (T4 consumes as invoke names — Tauri converts args/returns camelCase ↔ snake_case automatically; JS in T4 must pass `table`/`id`/`vaultId`/`row`):

```
invoke("db_upsert", { table, row })            -> SyncRow
invoke("db_get", { table, id })                -> SyncRow | null
invoke("db_list", { table, vaultId, includeDeleted? }) -> SyncRow[]
invoke("db_delete", { table, id })             -> null (tombstone)
invoke("db_outbox")                            -> OutboxEntry[]
wipe_local_data (existing) -> now wipes rows
```

- [ ] **Step 1: Write the command functions**

In `lib.rs`, near the other db command (`wipe_local_data`), add:

```rust
#[tauri::command]
fn db_upsert(db: tauri::State<'_, db::LocalDb>, table: String, row: serde_json::Value) -> Result<db::SyncRow, String> {
    let table = db::Table::parse(&table)?;
    let row: db::SyncRow = serde_json::from_value(row).map_err(|e| format!("db_upsert: bad row: {e}"))?;
    db::upsert_sync_row(&db, table, &row)
}

#[tauri::command]
fn db_get(db: tauri::State<'_, db::LocalDb>, table: String, id: String) -> Result<Option<db::SyncRow>, String> {
    let table = db::Table::parse(&table)?;
    db::get_sync_row(&db, table, &id)
}

#[tauri::command]
fn db_list(db: tauri::State<'_, db::LocalDb>, table: String, vault_id: String, include_deleted: Option<bool>) -> Result<Vec<db::SyncRow>, String> {
    let table = db::Table::parse(&table)?;
    db::list_sync_rows(&db, table, &vault_id, include_deleted.unwrap_or(false))
}

#[tauri::command]
fn db_delete(db: tauri::State<'_, db::LocalDb>, table: String, id: String) -> Result<(), String> {
    let table = db::Table::parse(&table)?;
    db::tombstone_sync_row(&db, table, &id)
}

#[tauri::command]
fn db_outbox(db: tauri::State<'_, db::LocalDb>) -> Result<Vec<db::OutboxEntry>, String> {
    db::outbox_pending(&db)
}
```

- [ ] **Step 2: Rewrite `wipe_local_data` and manage the DB**

```rust
#[tauri::command]
fn wipe_local_data(db: tauri::State<'_, db::LocalDb>) -> Result<(), String> {
    db::wipe_all(&db)
}
```

In `setup` (after `window.set_title(...)`, before the `main-ready` listen):

```rust
let data_dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
let db_path = data_dir.join(db::DB_FILE_NAME);
app.manage(db::open(&db_path.display().to_string())?);
```

Register the five commands in `invoke_handler`.

- [ ] **Step 3: Verify compile + full suite**

Run: `cargo check && cargo test`
Expected: PASS (all cargo tests — http suite keeps its own state, untouched).

- [ ] **Step 4: Commit**

```bash
git add client/src-tauri/src/lib.rs
git commit -m "feat: manage LocalDb at setup, db_* crud commands, wipe_local_data row-wipe"
```