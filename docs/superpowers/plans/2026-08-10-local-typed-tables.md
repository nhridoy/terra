# Plan #2 — Local Typed Tables + Outbox + Store Wiring (Offline-First Phase 2)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The app's data operations (hosts, groups, keys, snippets, workspaces) persist to typed local SQLite tables with an encrypted payload, a durable outbox, and tombstone deletes — fully usable with the server down.

**Architecture:** Six typed synced tables (`groups`, `hosts`, `keys`, `snippets`, `workspaces`, `presets`) share one envelope (`id`, `revision`, `vault_id`, `created_at`, `updated_at`, `deleted_at`) plus spec-whitelisted plaintext columns and one opaque encrypted JSON blob `data` (AEAD, AAD = table name — spec §6). Every local write on a synced table also inserts an `outbox` row; deletes are tombstones. A managed `LocalDb` is opened at app setup; thin Tauri commands expose CRUD; a TS wrapper (`lib/db/db.ts`) + the four data stores wire the UI to it.

**Tech Stack:** Rust (rusqlite, serde, uuid), Tauri v2 commands, TypeScript (Zustand stores, vitest, biome).

**Spec:** `docs/superpowers/specs/2026-08-09-offline-first-design.md` (§3 schema, §6 whitelist, §9 rollout step 2). Plan #1: `docs/superpowers/plans/2026-08-09-http-proxy.md` (committed `bc38a4f`).

## Global Constraints

- Plaintext whitelist (spec §6) is exactly: `vaults.name`, `groups.name`, `hosts.name/os`, `keys.name/description`, `snippets.name/description`, `workspaces/presets.name`, structural ids/`sort_order`. Everything else lives inside the encrypted `data` blob for that row.
- AEAD AAD = table name (spec §6); reuse the existing `encrypt_secret`/`decrypt_secret` Rust commands unchanged — the payload envelope already embeds and re-verifies the AAD, so no crypto code changes.
- No new npm or Go dependencies; no new Rust crate — `rusqlite`, `serde`, `uuid` already present.
- `table` command arguments are validated against a Rust enum before touching SQL — no polymorphic SQL, no SQLi (spec §3 conventions).
- The server is NOT touched in this plan (sync endpoints are Plan #3). Zero-knowledge: the server never receives plaintext; nothing in this plan sends data anywhere.
- pnpm only; biome enforces single quotes + space indent; no new comments unless they carry meaning (AGENTS.md, biome.json).
- Stores keep their current public interfaces (components import them unchanged); store actions resolve `vaultId` from `host.vaultId`/`vaultId` arg, falling back to `useVaultStore.getState().currentVaultId`.
- Gates per task: `cargo check`+`cargo test`; `pnpm vitest run <file>`; `pnpm biome check <touched files>` (no new warnings).

## Design decisions (deviations from the spec — flag to user at review)

1. **Encrypted payload is one JSON blob per row, not named encrypted columns.** Spec §3 draws named encrypted columns (e.g. `hosts.password`), but §6's whitelist rule makes them unworkable as shown — `hosts.port INTEGER` cannot hold an encrypted blob. Instead each synced table stores the whitelisted plaintext columns + one `data TEXT NOT NULL` = AEAD(JSON of everything else, AAD = table name). UI fields absent from spec §3 (`hosts.tags`, `hosts.color`, `keys.key_type`, `keys.fingerprint`, `workspaces.host_ids`) live in the blob; new UI fields never require schema migrations. Plan #3's server mirror uses the same shape (opaque `data`).
2. **`records` table is dropped.** It was never written at runtime (no commands call it; the DB is only opened in tests). No data migration needed; `RecordRow` + its functions/tests are deleted.
3. **`LocalDb` becomes a managed Tauri state** (opened in setup at `app_data_dir()/termvault.db`), and `wipe_local_data` switches to row-deletion (`wipe_all`) because the open connection locks the file on Windows.

## File structure

```
client/src-tauri/
  src/db.rs        # MODIFY: new DDL, Table enum, SyncRow, generic CRUD, outbox, wipe_all; drops records
  src/lib.rs       # MODIFY: manage LocalDb in setup, 5 db_* commands, wipe_local_data rewrite
client/src/
  lib/db/db.ts     # MODIFY: + listRows/getRow/upsertRow/deleteRow/getOutbox (wipeLocalData stays)
  lib/db/db.test.ts        # NEW
  lib/crypto/crypto.ts     # MODIFY: + encryptRowData/decryptRowData
  lib/crypto/crypto.test.ts# MODIFY: + 2 tests
  stores/hosts/hostStore.ts        # MODIFY: real CRUD via db.ts
  stores/hosts/hostStore.test.ts   # NEW
  stores/keys/keyStore.ts          # MODIFY
  stores/keys/keyStore.test.ts     # NEW
  stores/snippets/snippetStore.ts  # MODIFY
  stores/snippets/snippetStore.test.ts  # NEW
  stores/workspaces/workspaceStore.ts  # MODIFY
  stores/workspaces/workspaceStore.test.ts  # NEW
```

`presets` gets a table + CRUD coverage in T1/T2 but no store (none exists; spec §3 keeps same shape as `workspaces`).

---

### Task T0: Schema — typed tables + sync plumbing, drop `records`, `wipe_all`

**Files:**
- Modify: `client/src-tauri/src/db.rs`
- Test: same file `#[cfg(test)] mod tests`

**Interfaces:**
- Produces: `pub fn wipe_all(db: &LocalDb) -> Result<(), String>` (used by the `wipe_local_data` command in T3); `open()` DDL now creates the 6 synced tables + `outbox` + `sync_conflicts` + `__sync_meta` and no longer creates `records`.

- [ ] **Step 1: Write the failing tests**

Append to `#[cfg(test)] mod tests` in `db.rs`:

```rust
    #[test]
    fn test_open_creates_synced_tables() {
        let db = test_db();
        let conn = db.conn.lock().unwrap();
        let tables: Vec<String> = conn
            .prepare("SELECT name FROM sqlite_master WHERE type='table'")
            .unwrap()
            .query_map([], |row| row.get(0))
            .unwrap()
            .filter_map(|r| r.ok())
            .collect();
        for t in ["user_profiles", "user_keys", "vaults", "groups", "hosts", "keys",
                  "snippets", "workspaces", "presets", "outbox", "sync_conflicts", "__sync_meta"] {
            assert!(tables.contains(&t.to_string()), "missing table {t}");
        }
        assert!(!tables.contains(&"records".to_string()));
    }

    #[test]
    fn test_wipe_all_clears_every_row() {
        let db = test_db();
        let conn = db.conn.lock().unwrap();
        conn.execute(
            "INSERT INTO hosts (id, revision, vault_id, created_at, updated_at, name, sort_order, data)
             VALUES ('h1', 1, 'v1', 1, 1, 'box', 0, '{}')", [],
        ).unwrap();
        conn.execute(
            "INSERT INTO outbox (table_name, record_id, queued_at) VALUES ('hosts', 'h1', 1)", [],
        ).unwrap();
        drop(conn);
        wipe_all(&db).unwrap();
        let conn = db.conn.lock().unwrap();
        assert_eq!(conn.query_row("SELECT COUNT(*) FROM hosts", [], |r| r.get::<_, i64>(0)).unwrap(), 0);
        assert_eq!(conn.query_row("SELECT COUNT(*) FROM outbox", [], |r| r.get::<_, i64>(0)).unwrap(), 0);
    }
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd client/src-tauri && cargo test db::tests::test_open_creates_synced_tables`
Expected: FAIL (`wipe_all` not found; `records` still exists).

- [ ] **Step 3: Implement**

In `db.rs`:

- Replace the `records` DDL block (`CREATE TABLE IF NOT EXISTS records ...` up to index `idx_records_user_id`) with:

```rust
        // --- Synced tables: shared envelope (id, revision, vault_id, created_at,
        // updated_at, deleted_at) + plaintext whitelist columns + opaque encrypted
        // `data` blob (AEAD with AAD = table name). No SQL FK constraints: rows can
        // arrive via sync in any order (hydration without transient failures).
        CREATE TABLE IF NOT EXISTS groups (
            id TEXT PRIMARY KEY,
            revision INTEGER NOT NULL DEFAULT 1,
            vault_id TEXT NOT NULL,
            created_at INTEGER NOT NULL,
            updated_at INTEGER NOT NULL,
            deleted_at INTEGER,
            name TEXT NOT NULL,
            parent_id TEXT,
            sort_order INTEGER NOT NULL DEFAULT 0,
            data TEXT NOT NULL DEFAULT '{}'
        );
        CREATE INDEX IF NOT EXISTS idx_groups_vault_parent ON groups(vault_id, parent_id, sort_order);

        CREATE TABLE IF NOT EXISTS hosts (
            id TEXT PRIMARY KEY,
            revision INTEGER NOT NULL DEFAULT 1,
            vault_id TEXT NOT NULL,
            created_at INTEGER NOT NULL,
            updated_at INTEGER NOT NULL,
            deleted_at INTEGER,
            name TEXT NOT NULL,
            os TEXT,
            group_id TEXT,
            key_id TEXT,
            sort_order INTEGER NOT NULL DEFAULT 0,
            data TEXT NOT NULL DEFAULT '{}'
        );
        CREATE INDEX IF NOT EXISTS idx_hosts_vault_group ON hosts(vault_id, group_id, sort_order);

        CREATE TABLE IF NOT EXISTS keys (
            id TEXT PRIMARY KEY,
            revision INTEGER NOT NULL DEFAULT 1,
            vault_id TEXT NOT NULL,
            created_at INTEGER NOT NULL,
            updated_at INTEGER NOT NULL,
            deleted_at INTEGER,
            name TEXT NOT NULL,
            description TEXT,
            sort_order INTEGER NOT NULL DEFAULT 0,
            data TEXT NOT NULL DEFAULT '{}'
        );
        CREATE INDEX IF NOT EXISTS idx_keys_vault ON keys(vault_id, sort_order);

        CREATE TABLE IF NOT EXISTS snippets (
            id TEXT PRIMARY KEY,
            revision INTEGER NOT NULL DEFAULT 1,
            vault_id TEXT NOT NULL,
            created_at INTEGER NOT NULL,
            updated_at INTEGER NOT NULL,
            deleted_at INTEGER,
            name TEXT NOT NULL,
            description TEXT,
            sort_order INTEGER NOT NULL DEFAULT 0,
            data TEXT NOT NULL DEFAULT '{}'
        );
        CREATE INDEX IF NOT EXISTS idx_snippets_vault ON snippets(vault_id, sort_order);

        CREATE TABLE IF NOT EXISTS workspaces (
            id TEXT PRIMARY KEY,
            revision INTEGER NOT NULL DEFAULT 1,
            vault_id TEXT NOT NULL,
            created_at INTEGER NOT NULL,
            updated_at INTEGER NOT NULL,
            deleted_at INTEGER,
            name TEXT NOT NULL,
            sort_order INTEGER NOT NULL DEFAULT 0,
            data TEXT NOT NULL DEFAULT '{}'
        );
        CREATE INDEX IF NOT EXISTS idx_workspaces_vault ON workspaces(vault_id, sort_order);

        CREATE TABLE IF NOT EXISTS presets (
            id TEXT PRIMARY KEY,
            revision INTEGER NOT NULL DEFAULT 1,
            vault_id TEXT NOT NULL,
            created_at INTEGER NOT NULL,
            updated_at INTEGER NOT NULL,
            deleted_at INTEGER,
            name TEXT NOT NULL,
            sort_order INTEGER NOT NULL DEFAULT 0,
            data TEXT NOT NULL DEFAULT '{}'
        );
        CREATE INDEX IF NOT EXISTS idx_presets_vault ON presets(vault_id, sort_order);

        CREATE TABLE IF NOT EXISTS outbox (
            table_name TEXT NOT NULL,
            record_id TEXT NOT NULL,
            queued_at INTEGER NOT NULL,
            PRIMARY KEY (table_name, record_id)
        );
        CREATE INDEX IF NOT EXISTS idx_outbox_queued_at ON outbox(queued_at);

        CREATE TABLE IF NOT EXISTS sync_conflicts (
            table_name TEXT NOT NULL,
            record_id TEXT NOT NULL,
            remote_rev INTEGER NOT NULL,
            remote_payload TEXT NOT NULL,
            created_at INTEGER NOT NULL,
            PRIMARY KEY (table_name, record_id)
        );

        CREATE TABLE IF NOT EXISTS __sync_meta (
            vault_id TEXT PRIMARY KEY,
            watermark INTEGER NOT NULL DEFAULT 0,
            last_sync_at INTEGER,
            last_device_id TEXT
        );
```

- Delete the `RecordRow` struct, `upsert_record`, `query_records`, `delete_record`, `hard_delete_record`, and the `test_upsert_record_and_query_roundtrip`, `test_delete_record_marks_deleted`, `test_query_records_excludes_deleted_by_default` tests.
- Replace `wipe_database` (and its two tests `test_wipe_database_removes_db_and_sidecars`, `test_wipe_database_is_noop_when_missing`) with:

```rust
/// Reset the local database contents to pristine state. Row-deletion is used
/// instead of file removal because the managed connection holds the DB file
/// open (Windows cannot delete an open file). Does not VACUUM — file size is
/// retained, data is gone.
pub fn wipe_all(db: &LocalDb) -> Result<(), String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    for table in [
        "user_profiles", "user_keys", "vaults", "groups", "hosts", "keys",
        "snippets", "workspaces", "presets", "outbox", "sync_conflicts", "__sync_meta",
    ] {
        conn.execute_batch(&format!("DELETE FROM {table};"))
            .map_err(|e| format!("wipe_all: {table}: {e}"))?;
    }
    Ok(())
}
```

- [ ] **Step 4: Run tests**

Run: `cargo test db::`
Expected: PASS (both new tests; `records` tests gone).

- [ ] **Step 5: Commit**

```bash
git add client/src-tauri/src/db.rs
git commit -m "feat: typed synced tables schema, outbox/conflicts/sync-meta, wipe_all"
```

### Task T1: `Table` enum, `SyncRow`, generic upsert/get/list — groups + hosts tests

**Files:**
- Modify: `client/src-tauri/src/db.rs`
- Test: same file

**Interfaces:**
- Consumes: T0 DDL.
- Produces (T2, T3 consume):

```rust
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Table { Groups, Hosts, Keys, Snippets, Workspaces, Presets }

impl Table {
    pub fn parse(s: &str) -> Result<Table, String>;   // lowercase name, else Err
    pub fn as_str(self) -> &'static str;
}

pub struct OutboxEntry { pub table_name: String, pub record_id: String, pub queued_at: i64 }

pub struct SyncRow { /* snake_case fields below */ }

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "snake_case")]
pub struct SyncRow {
    pub id: String,
    pub revision: i64,
    pub vault_id: String,
    pub created_at: i64,
    pub updated_at: i64,
    pub deleted_at: Option<i64>,
    pub name: Option<String>,
    pub os: Option<String>,
    pub description: Option<String>,
    pub sort_order: i64,
    pub parent_id: Option<String>,
    pub group_id: Option<String>,
    pub key_id: Option<String>,
    pub data: String,
}

pub fn upsert_sync_row(db: &LocalDb, table: Table, row: &SyncRow) -> Result<SyncRow, String>
pub fn get_sync_row(db: &LocalDb, table: Table, id: &str) -> Result<Option<SyncRow>, String>
pub fn list_sync_rows(db: &LocalDb, table: Table, vault_id: &str, include_deleted: bool) -> Result<Vec<SyncRow>, String>
pub fn tombstone_sync_row(db: &LocalDb, table: Table, id: &str) -> Result<(), String>  // T2
pub fn outbox_pending(db: &LocalDb) -> Result<Vec<OutboxEntry>, String>                // T2
pub fn outbox_remove(db: &LocalDb, table: Table, id: &str) -> Result<(), String>       // T2
```

Semantics: `upsert_sync_row` ignores any caller-supplied `revision` — existing row → `revision+1`, `created_at` preserved; new row → `revision=1`, `created_at=updated_at=now`. Always `updated_at=now`, and always inserts the outbox entry. The row write and the outbox insert happen in ONE transaction (`conn.transaction()`), so a crash or mid-write error can never leave a data write without its outbox entry (a lost outbox row would permanently strand a local write — it would never sync). `list_sync_rows` with `include_deleted=false` excludes `deleted_at IS NOT NULL`, ordered by `sort_order, created_at`.

- [ ] **Step 1: Write the failing tests**

```rust
    #[test]
    fn test_upsert_group_roundtrip_and_revision_bump() {
        let db = test_db();
        let g1 = SyncRow { id: "g1".into(), revision: 99, vault_id: "v1".into(),
            created_at: 0, updated_at: 0, deleted_at: None, name: Some("Servers".into()),
            os: None, description: None, sort_order: 0, parent_id: None, group_id: None,
            key_id: None, data: "{}".into() };
        let saved = upsert_sync_row(&db, Table::Groups, &g1).unwrap();
        assert_eq!(saved.revision, 1);                       // caller revision ignored
        assert_eq!(saved.vault_id, "v1");
        assert_eq!(saved.name.as_deref(), Some("Servers"));
        assert!(saved.created_at > 0 && saved.updated_at >= saved.created_at);

        let updated = upsert_sync_row(&db, Table::Groups, &g1).unwrap();
        assert_eq!(updated.revision, 2);                     // bump on update
        assert_eq!(updated.created_at, saved.created_at);    // preserved
    }

    #[test]
    fn test_upsert_host_roundtrip() {
        let db = test_db();
        let h = SyncRow { id: "h1".into(), revision: 1, vault_id: "v1".into(),
            created_at: 0, updated_at: 0, deleted_at: None, name: Some("prod".into()),
            os: Some("linux".into()), description: None, sort_order: 3,
            parent_id: None, group_id: Some("g1".into()), key_id: Some("k1".into()),
            data: "encrypted".into() };
        upsert_sync_row(&db, Table::Hosts, &h).unwrap();
        let loaded = get_sync_row(&db, Table::Hosts, "h1").unwrap().unwrap();
        assert_eq!(loaded.name.as_deref(), Some("prod"));
        assert_eq!(loaded.group_id.as_deref(), Some("g1"));
        assert_eq!(loaded.data, "encrypted");                // opaque passthrough
        assert_eq!(list_sync_rows(&db, Table::Hosts, "v1", false).unwrap().len(), 1);
    }

    #[test]
    fn test_list_scoped_to_vault_and_sorted() {
        let db = test_db();
        for (id, vault, order) in [("h1", "v1", 2), ("h2", "v1", 1), ("h3", "v2", 9)] {
            let h = SyncRow { id: id.into(), revision: 1, vault_id: vault.into(),
                created_at: 1, updated_at: 1, deleted_at: None, name: Some(id.into()),
                os: None, description: None, sort_order: order, parent_id: None,
                group_id: None, key_id: None, data: "{}".into() };
            upsert_sync_row(&db, Table::Hosts, &h).unwrap();
        }
        let v1 = list_sync_rows(&db, Table::Hosts, "v1", false).unwrap();
        assert_eq!(v1.iter().map(|r| r.id.as_str()).collect::<Vec<_>>(), vec!["h2", "h1"]);
    }
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cargo test db::tests::test_upsert_group_roundtrip_and_revision_bump`
Expected: FAIL (`SyncRow`/`upsert_sync_row` not found).

- [ ] **Step 3: Implement**

Add to `db.rs` (above `#[cfg(test)]`):

```rust
const ENVELOPE_COLS: &str = "id, revision, vault_id, created_at, updated_at, deleted_at";

#[rustfmt::skip]
fn table_cols(table: Table) -> &'static str {
    match table {
        Table::Groups     => "name, parent_id, sort_order, data",
        Table::Hosts      => "name, os, group_id, key_id, sort_order, data",
        Table::Keys       => "name, description, sort_order, data",
        Table::Snippets   => "name, description, sort_order, data",
        Table::Workspaces => "name, sort_order, data",
        Table::Presets    => "name, sort_order, data",
    }
}

fn now_ms() -> i64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_millis() as i64)
        .unwrap_or(0)
}

fn row_vals(row: &SyncRow, cols: &str) -> Vec<rusqlite::types::Value> {
    let mut v = vec![
        row.id.clone().into(),
        row.revision.into(),
        row.vault_id.clone().into(),
        row.created_at.into(),
        row.updated_at.into(),
        row.deleted_at.into(),
    ];
    let add = |v: &mut Vec<rusqlite::types::Value>, val: Option<&String>| {
        v.push(val.map(|s| s.clone().into()).unwrap_or(rusqlite::types::Value::Null));
    };
    match cols {
        "name, parent_id, sort_order, data" => {
            add(&mut v, row.name.as_ref());
            add(&mut v, row.parent_id.as_ref());
            v.push(row.sort_order.into());
            v.push(row.data.clone().into());
        }
        "name, os, group_id, key_id, sort_order, data" => {
            add(&mut v, row.name.as_ref());
            add(&mut v, row.os.as_ref());
            add(&mut v, row.group_id.as_ref());
            add(&mut v, row.key_id.as_ref());
            v.push(row.sort_order.into());
            v.push(row.data.clone().into());
        }
        "name, description, sort_order, data" => {
            add(&mut v, row.name.as_ref());
            add(&mut v, row.description.as_ref());
            v.push(row.sort_order.into());
            v.push(row.data.clone().into());
        }
        _ => {
            add(&mut v, row.name.as_ref());
            v.push(row.sort_order.into());
            v.push(row.data.clone().into());
        }
    }
    v
}

fn row_from(table: Table, row: &rusqlite::Row<'_>) -> rusqlite::Result<SyncRow> {
    // Envelope by position (0-5); whitelist columns by name — rusqlite resolves
    // named columns at query time, so optional columns absent from a table are
    // read as None via .ok() (get by name errors when the name is not in the
    // result set).
    let opt = |name: &str| -> Option<String> { row.get::<_, Option<String>>(name).ok().flatten() };
    Ok(SyncRow {
        id: row.get(0)?,
        revision: row.get(1)?,
        vault_id: row.get(2)?,
        created_at: row.get(3)?,
        updated_at: row.get(4)?,
        deleted_at: row.get(5)?,
        name: opt("name"),
        os: opt("os"),
        description: opt("description"),
        group_id: opt("group_id"),
        parent_id: opt("parent_id"),
        key_id: opt("key_id"),
        sort_order: row.get::<_, Option<i64>>("sort_order").ok().flatten().unwrap_or(0),
        data: row.get("data")?,
    })
}

impl Table {
    pub fn parse(s: &str) -> Result<Table, String> {
        match s {
            "groups" => Ok(Table::Groups),
            "hosts" => Ok(Table::Hosts),
            "keys" => Ok(Table::Keys),
            "snippets" => Ok(Table::Snippets),
            "workspaces" => Ok(Table::Workspaces),
            "presets" => Ok(Table::Presets),
            other => Err(format!("unknown table: {other}")),
        }
    }
    pub fn as_str(self) -> &'static str {
        match self {
            Table::Groups => "groups",
            Table::Hosts => "hosts",
            Table::Keys => "keys",
            Table::Snippets => "snippets",
            Table::Workspaces => "workspaces",
            Table::Presets => "presets",
        }
    }
}

pub fn upsert_sync_row(db: &LocalDb, table: Table, row: &SyncRow) -> Result<SyncRow, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    let existing = get_sync_row_unlocked(&conn, table, &row.id)?;
    let rev = match &existing {
        Some(e) => e.revision + 1,
        None => 1,
    };
    let now = now_ms();
    let mut out = row.clone();
    out.revision = rev;
    if let Some(e) = &existing {
        out.created_at = e.created_at;
    } else {
        out.created_at = now;
    }
    out.updated_at = now;
    out.deleted_at = None; // upsert of a tombstoned row resurrects it (LWW create/update wins)
    let cols = table_cols(table);
    let sql = format!(
        "INSERT OR REPLACE INTO {t} ({envelope}, {cols}) VALUES ({q})",
        t = table.as_str(),
        envelope = ENVELOPE_COLS,
        cols = cols,
        q = (1..=6 + cols.split(',').count()).map(|i| format!("?{i}")).collect::<Vec<_>>().join(", "),
    );
    let tx = conn.transaction().map_err(|e| format!("upsert_sync_row tx: {e}"))?;
    tx.execute(&sql, rusqlite::params_from_iter(row_vals(&out, cols)))
        .map_err(|e| format!("upsert_sync_row({}): {e}", table.as_str()))?;
    tx.execute(
        "INSERT OR REPLACE INTO outbox (table_name, record_id, queued_at) VALUES (?1, ?2, ?3)",
        rusqlite::params![table.as_str(), out.id, now],
    )
    .map_err(|e| format!("upsert_sync_row outbox: {e}"))?;
    tx.commit().map_err(|e| format!("upsert_sync_row commit: {e}"))?;
    Ok(out)
}

pub fn get_sync_row(db: &LocalDb, table: Table, id: &str) -> Result<Option<SyncRow>, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    get_sync_row_unlocked(&conn, table, id)
}

fn get_sync_row_unlocked(conn: &Connection, table: Table, id: &str) -> Result<Option<SyncRow>, String> {
    let cols = table_cols(table);
    let sql = format!(
        "SELECT {envelope}, {cols} FROM {t} WHERE id = ?1",
        envelope = ENVELOPE_COLS, t = table.as_str(), cols = cols,
    );
    let mut stmt = conn.prepare(&sql).map_err(|e| e.to_string())?;
    let mut rows = stmt.query_map(rusqlite::params![id], |r| row_from(table, r)).map_err(|e| e.to_string())?;
    Ok(rows.next().transpose().map_err(|e| e.to_string())?)
}

pub fn list_sync_rows(db: &LocalDb, table: Table, vault_id: &str, include_deleted: bool) -> Result<Vec<SyncRow>, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    let cols = table_cols(table);
    let deleted_filter = if include_deleted { "" } else { "deleted_at IS NULL AND" };
    let sql = format!(
        "SELECT {envelope}, {cols} FROM {t} WHERE {filter} vault_id = ?1 ORDER BY sort_order, created_at",
        envelope = ENVELOPE_COLS, t = table.as_str(), cols = cols, filter = deleted_filter,
    );
    let mut stmt = conn.prepare(&sql).map_err(|e| e.to_string())?;
    let rows = stmt.query_map(rusqlite::params![vault_id], |r| row_from(table, r))
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect::<Vec<_>>();
    Ok(rows)
}
```

`row_from(table, r)` is defined in the code block above; `get_sync_row_unlocked` is the lock-free variant used inside `upsert_sync_row` to compute revisions.

- [ ] **Step 4: Run tests**

Run: `cargo test db::`
Expected: PASS for the three new tests + T0 tests; pre-existing tests still green.

- [ ] **Step 5: Commit**

```bash
git add client/src-tauri/src/db.rs
git commit -m "feat: Table enum, SyncRow, generic upsert/get/list with revision clock and outbox"
```

### Task T2: tombstone + outbox ops + remaining tables' tests

**Files:**
- Modify: `client/src-tauri/src/db.rs`
- Test: same file

**Interfaces:**
- Consumes: T1 `SyncRow`/`Table`/`upsert_sync_row`/`get_sync_row`/`list_sync_rows`.
- Produces (T3 consumes): `pub fn tombstone_sync_row(db: &LocalDb, table: Table, id: &str) -> Result<(), String>`, `pub fn outbox_pending(db: &LocalDb) -> Result<Vec<OutboxEntry>, String>`, `pub fn outbox_remove(db: &LocalDb, table: Table, id: &str) -> Result<(), String>`, `pub struct OutboxEntry { table_name, record_id, queued_at }` (serde Serialize).

- [ ] **Step 0: Retrofit atomicity fix into T1's `upsert_sync_row`** (plan amendment 2026-08-10, see Amendments section)

T1 shipped with the row write and outbox insert as two separate auto-commit statements. If the process crashes between them, the data write has no outbox entry → that write never syncs (permanent offline-first divergence). Make the committed `upsert_sync_row` in `db.rs` atomic, exactly like T2's `tombstone_sync_row` below: create a transaction before the first `execute`, route both `execute`s through the `Transaction` handle, and `commit()` at the end (a dropped, uncommitted `Transaction` rolls back — no explicit rollback needed). Include this fix in the T2 commit.

- [ ] **Step 1: Write the failing tests**

```rust
    #[test]
    fn test_tombstone_hides_row_and_bumps_outbox() {
        let db = test_db();
        let k = SyncRow { id: "k1".into(), revision: 1, vault_id: "v1".into(), created_at: 1,
            updated_at: 1, deleted_at: None, name: Some("key".into()), os: None,
            description: None, sort_order: 0, parent_id: None, group_id: None, key_id: None,
            data: "enc".into() };
        upsert_sync_row(&db, Table::Keys, &k).unwrap();
        assert_eq!(list_sync_rows(&db, Table::Keys, "v1", false).unwrap().len(), 1);

        tombstone_sync_row(&db, Table::Keys, "k1").unwrap();
        let all = list_sync_rows(&db, Table::Keys, "v1", true).unwrap();
        assert_eq!(all.len(), 1);
        assert!(all[0].deleted_at.is_some() && all[0].revision == 2);
        assert_eq!(list_sync_rows(&db, Table::Keys, "v1", false).unwrap().len(), 0);

        // idempotent: second tombstone does not bump again
        tombstone_sync_row(&db, Table::Keys, "k1").unwrap();
        let all2 = list_sync_rows(&db, Table::Keys, "v1", true).unwrap();
        assert_eq!(all2[0].revision, 2);

        let pending = outbox_pending(&db).unwrap();
        assert!(pending.iter().any(|o| o.table_name == "keys" && o.record_id == "k1"));
    }

    #[test]
    fn test_outbox_remove_and_remaining_tables_roundtrip() {
        let db = test_db();
        for (table, id) in [(Table::Snippets, "s1"), (Table::Workspaces, "w1"), (Table::Presets, "p1")] {
            let row = SyncRow { id: id.into(), revision: 1, vault_id: "v1".into(), created_at: 1,
                updated_at: 1, deleted_at: None, name: Some("n".into()), os: None, description: None,
                sort_order: 0, parent_id: None, group_id: None, key_id: None, data: "enc".into() };
            upsert_sync_row(&db, table, &row).unwrap();
        }
        assert_eq!(list_sync_rows(&db, Table::Snippets, "v1", false).unwrap().len(), 1);
        assert_eq!(list_sync_rows(&db, Table::Workspaces, "v1", false).unwrap().len(), 1);
        assert_eq!(list_sync_rows(&db, Table::Presets, "v1", false).unwrap().len(), 1);
        assert_eq!(outbox_pending(&db).unwrap().len(), 3);

        outbox_remove(&db, Table::Snippets, "s1").unwrap();
        let pending = outbox_pending(&db).unwrap();
        assert!(!pending.iter().any(|o| o.record_id == "s1"));
        assert_eq!(pending.len(), 2);
    }

    #[test]
    fn test_table_parse_rejects_unknown() {
        assert_eq!(Table::parse("hosts").unwrap(), Table::Hosts);
        assert!(Table::parse("hosts; DROP TABLE groups").is_err());
        assert!(Table::parse("HOSTS").is_err());
    }
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cargo test db::tests::test_tombstone_hides_row_and_bumps_outbox`
Expected: FAIL (`tombstone_sync_row` not found).

- [ ] **Step 3: Implement**

```rust
pub fn tombstone_sync_row(db: &LocalDb, table: Table, id: &str) -> Result<(), String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    let Some(existing) = get_sync_row_unlocked(&conn, table, id)? else {
        return Ok(()); // idempotent: nothing to tombstone
    };
    if existing.deleted_at.is_some() {
        return Ok(()); // already a tombstone — no revision bump
    }
    let now = now_ms();
    let sql = format!(
        "UPDATE {t} SET revision = ?1, updated_at = ?2, deleted_at = ?2 WHERE id = ?3",
        t = table.as_str(),
    );
    let tx = conn.transaction().map_err(|e| format!("tombstone_sync_row tx: {e}"))?;
    tx.execute(&sql, rusqlite::params![existing.revision + 1, now, id])
        .map_err(|e| format!("tombstone_sync_row({}): {e}", table.as_str()))?;
    tx.execute(
        "INSERT OR REPLACE INTO outbox (table_name, record_id, queued_at) VALUES (?1, ?2, ?3)",
        rusqlite::params![table.as_str(), id, now],
    )
    .map_err(|e| format!("tombstone_sync_row outbox: {e}"))?;
    tx.commit().map_err(|e| format!("tombstone_sync_row commit: {e}"))?;
    Ok(())
}

pub fn outbox_pending(db: &LocalDb) -> Result<Vec<OutboxEntry>, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare("SELECT table_name, record_id, queued_at FROM outbox ORDER BY queued_at")
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map([], |r| {
            Ok(OutboxEntry { table_name: r.get(0)?, record_id: r.get(1)?, queued_at: r.get(2)? })
        })
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect::<Vec<_>>();
    Ok(rows)
}

pub fn outbox_remove(db: &LocalDb, table: Table, id: &str) -> Result<(), String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM outbox WHERE table_name = ?1 AND record_id = ?2", rusqlite::params![table.as_str(), id])
        .map_err(|e| format!("outbox_remove: {e}"))?;
    Ok(())
}
```

`OutboxEntry` derives `Debug, Clone, serde::Serialize`.

- [ ] **Step 4: Run tests**

Run: `cargo test db::`
Expected: PASS (all db tests incl. T0/T1), no new warnings.

- [ ] **Step 5: Commit**

```bash
git add client/src-tauri/src/db.rs
git commit -m "feat: tombstone deletes and outbox pending/remove with tests"
```

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

### Task T4: TS wrapper `lib/db/db.ts` (TDD)

**Files:**
- Modify: `client/src/lib/db/db.ts`, Create: `client/src/lib/db/db.test.ts`

**Interfaces:**
- Consumes: T3 invoke names.
- Produces (T6–T8 consume):

```ts
export type TableName = "groups" | "hosts" | "keys" | "snippets" | "workspaces" | "presets";
export interface SyncRow { id: string; revision: number; vault_id: string;
  created_at: number; updated_at: number; deleted_at: number | null;
  name?: string; os?: string | null; description?: string | null; sort_order: number;
  parent_id?: string | null; group_id?: string | null; key_id?: string | null; data: string; }
export interface OutboxEntry { table_name: string; record_id: string; queued_at: number; }
export function listRows(table: TableName, vaultId: string): Promise<SyncRow[]>;
export function getRow(table: TableName, id: string): Promise<SyncRow | null>;
export function upsertRow(table: TableName, row: { id: string; vault_id: string; data: string } & Partial<SyncRow>): Promise<SyncRow>;
export function deleteRow(table: TableName, id: string): Promise<void>;
export function getOutbox(): Promise<OutboxEntry[]>;
export function wipeLocalData(): Promise<void>; // existing, unchanged
```

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }));

import { invoke } from "@tauri-apps/api/core";
import { deleteRow, getOutbox, getRow, listRows, upsertRow } from "./db";

const mockInvoke = vi.mocked(invoke);

beforeEach(() => { mockInvoke.mockReset(); });

describe("db wrapper", () => {
  it("listRows maps invoke args", async () => {
    mockInvoke.mockResolvedValue([{ id: "h1", revision: 1, vault_id: "v1" }]);
    const rows = await listRows("hosts", "v1");
    expect(mockInvoke).toHaveBeenCalledWith("db_list", { table: "hosts", vaultId: "v1", includeDeleted: false });
    expect(rows[0].id).toBe("h1");
  });

  it("getRow returns null when absent", async () => {
    mockInvoke.mockResolvedValue(null);
    expect(await getRow("keys", "k1")).toBeNull();
    expect(mockInvoke).toHaveBeenCalledWith("db_get", { table: "keys", id: "k1" });
  });

  it("upsertRow passes row object", async () => {
    const row = { id: "h1", vault_id: "v1", data: "enc", name: "prod" };
    mockInvoke.mockResolvedValue({ ...row, revision: 2 });
    const saved = await upsertRow("hosts", row);
    expect(mockInvoke).toHaveBeenCalledWith("db_upsert", { table: "hosts", row });
    expect(saved.revision).toBe(2);
  });

  it("deleteRow tombstones via db_delete", async () => {
    mockInvoke.mockResolvedValue(null);
    await deleteRow("snippets", "s1");
    expect(mockInvoke).toHaveBeenCalledWith("db_delete", { table: "snippets", id: "s1" });
  });

  it("getOutbox returns entries", async () => {
    mockInvoke.mockResolvedValue([{ table_name: "hosts", record_id: "h1", queued_at: 1 }]);
    const out = await getOutbox();
    expect(out[0].record_id).toBe("h1");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd client && pnpm vitest run src/lib/db/db.test.ts`
Expected: FAIL (module functions missing).

- [ ] **Step 3: Implement**

```ts
import { invoke } from "@tauri-apps/api/core";

export type TableName =
  | "groups"
  | "hosts"
  | "keys"
  | "snippets"
  | "workspaces"
  | "presets";

export interface SyncRow {
  id: string;
  revision: number;
  vault_id: string;
  created_at: number;
  updated_at: number;
  deleted_at: number | null;
  name?: string;
  os?: string | null;
  description?: string | null;
  sort_order: number;
  parent_id?: string | null;
  group_id?: string | null;
  key_id?: string | null;
  data: string;
}

export interface OutboxEntry {
  table_name: string;
  record_id: string;
  queued_at: number;
}

export async function listRows(
  table: TableName,
  vaultId: string,
  includeDeleted = false,
): Promise<SyncRow[]> {
  return invoke<SyncRow[]>("db_list", { table, vaultId, includeDeleted });
}

export async function getRow(
  table: TableName,
  id: string,
): Promise<SyncRow | null> {
  return invoke<SyncRow | null>("db_get", { table, id });
}

export async function upsertRow(
  table: TableName,
  row: { id: string; vault_id: string; data: string } & Partial<SyncRow>,
): Promise<SyncRow> {
  return invoke<SyncRow>("db_upsert", { table, row });
}

export async function deleteRow(table: TableName, id: string): Promise<void> {
  await invoke("db_delete", { table, id });
}

export async function getOutbox(): Promise<OutboxEntry[]> {
  return invoke<OutboxEntry[]>("db_outbox");
}

// Reset the on-device SQLite cache to a pristine, fresh-install state. ... (keep existing doc)
export async function wipeLocalData(): Promise<void> {
  await invoke("wipe_local_data");
}
```

- [ ] **Step 4: Run tests + lint**

Run: `pnpm vitest run src/lib/db/db.test.ts && pnpm biome check src/lib/db/db.ts src/lib/db/db.test.ts`
Expected: PASS, no new warnings.

- [ ] **Step 5: Commit**

```bash
git add client/src/lib/db/db.ts client/src/lib/db/db.test.ts
git commit -m "feat: ts db wrapper — list/get/upsert/deleteRow, getOutbox"
```

### Task T5: `crypto.ts` row-data helpers (TDD)

**Files:**
- Modify: `client/src/lib/crypto/crypto.ts`, `client/src/lib/crypto/crypto.test.ts`

**Interfaces:**
- Consumes: existing `encryptSecret(plaintext, recordType)` / `decryptSecret(payload)`.
- Produces (T6–T8 consume):

```ts
export async function encryptRowData(table: string, value: unknown): Promise<string>;
export async function decryptRowData(encrypted: string): Promise<unknown>;
```

- [ ] **Step 1: Write the failing test**

Append to `crypto.test.ts`:

```ts
  it("encryptRowData uses table name as AAD", async () => {
    const secret = "secret";
    const encrypted = await encryptRowData("hosts", { address: "1.2.3.4" });
    expect(mockInvoke).toHaveBeenCalledWith("encrypt_secret", {
      plaintext: JSON.stringify({ address: "1.2.3.4" }),
      recordType: "hosts",
    });
    expect(encrypted).toBe(secret);
  });

  it("decryptRowData parses payload json", async () => {
    mockInvoke.mockResolvedValueOnce('{"port":22}');
    expect(await decryptRowData("enc")).toEqual({ port: 22 });
  });
```

Adjust to the existing mock setup in that file (reuse its `mockInvoke`).

- [ ] **Step 2: Run test to verify it fails**

Run: `cd client && pnpm vitest run src/lib/crypto/crypto.test.ts`

- [ ] **Step 3: Implement**

```ts
export async function encryptRowData(
  table: string,
  value: unknown,
): Promise<string> {
  return encryptSecret(JSON.stringify(value), table);
}

export async function decryptRowData(encrypted: string): Promise<unknown> {
  return JSON.parse(await decryptSecret(encrypted)) as unknown;
}
```

- [ ] **Step 4: Run tests + lint**

Run: `pnpm vitest run src/lib/crypto && pnpm biome check src/lib/crypto`

- [ ] **Step 5: Commit**

```bash
git add client/src/lib/crypto/crypto.ts client/src/lib/crypto/crypto.test.ts
git commit -m "feat: encryptRowData/decryptRowData row payload helpers"
```

### Task T6: Wire `hostStore` (TDD)

**Files:**
- Modify: `client/src/stores/hosts/hostStore.ts`
- Create: `client/src/stores/hosts/hostStore.test.ts`

**Interfaces:**
- Consumes: T4 `db.ts` (`listRows`/`getRow`/`upsertRow`/`deleteRow`), T5 helpers, existing `useVaultStore.getState().currentVaultId`, existing `useKeyStore.getState().getCredentialsForKey`.
- Produces: same public store interface as today (components unchanged). Host payload mapping:

```ts
// payload (encrypted JSON, AAD "hosts"): { address, port, username, authType, password, tags, color }
// payload (encrypted JSON, AAD "groups"): { }  (groups have no encrypted fields)
```

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("../../lib/db/db");
vi.mock("../../lib/crypto/crypto");
vi.mock("../vault/vaultStore");
vi.mock("../keys/keyStore", () => ({
  useKeyStore: { getState: () => ({ getCredentialsForKey: vi.fn(async () => "PRIVATE") }) },
}));

import { deleteRow, getRow, listRows, upsertRow } from "../../lib/db/db";
import { decryptRowData, encryptRowData } from "../../lib/crypto/crypto";
import { useVaultStore } from "../vault/vaultStore";
import { useHostStore } from "./hostStore";

const mockList = vi.mocked(listRows);
const mockGet = vi.mocked(getRow);
const mockUpsert = vi.mocked(upsertRow);
const mockDelete = vi.mocked(deleteRow);
const mockDecrypt = vi.mocked(decryptRowData);
const mockEncrypt = vi.mocked(encryptRowData);

beforeEach(() => useHostStore.setState({ hosts: [], groups: [], selectedHost: null, isLoading: false, error: null }));

describe("hostStore", () => {
  it("fetchHosts decrypts payloads into the Host model", async () => {
    mockList.mockResolvedValue([{
      id: "h1", revision: 1, vault_id: "v1", created_at: 1000, updated_at: 1000,
      deleted_at: null, name: "prod", os: "linux", group_id: "g1", key_id: null,
      sort_order: 0, data: "enc",
    }]);
    mockDecrypt.mockResolvedValue({ address: "1.2.3.4", port: 22, username: "root", authType: "password", password: "pw", tags: ["prod"], color: "#f00" });
    await useHostStore.getState().fetchHosts("v1");
    expect(mockList).toHaveBeenCalledWith("hosts", "v1");
    const host = useHostStore.getState().hosts[0];
    expect(host.address).toBe("1.2.3.4");
    expect(host.port).toBe(22);
    expect(host.groupId).toBe("g1");
    expect(host.tags).toEqual(["prod"]);
  });

  it("createHost encrypts payload with AAD hosts and upserts", async () => {
    mockEncrypt.mockResolvedValue("enc");
    mockUpsert.mockResolvedValue({ id: "new", revision: 1, vault_id: "v1", created_at: 1, updated_at: 1, deleted_at: null, data: "enc" });
    useVaultStore.setState({ currentVaultId: "v1" });
    await useHostStore.getState().createHost({ name: "prod", address: "1.2.3.4" });
    expect(mockEncrypt).toHaveBeenCalledWith("hosts", expect.objectContaining({ address: "1.2.3.4", port: 22, username: "root", authType: "password" }));
    expect(mockUpsert).toHaveBeenCalledWith("hosts", expect.objectContaining({ name: "prod", vault_id: "v1" }));
    expect(useHostStore.getState().hosts.length).toBe(1);
  });

  it("updateHost preserves unpatched encrypted fields", async () => {
    mockGet.mockResolvedValue({ id: "h1", revision: 1, vault_id: "v1", created_at: 1, updated_at: 1, deleted_at: null, name: "prod", group_id: null, key_id: null, sort_order: 0, data: "enc" });
    mockDecrypt.mockResolvedValue({ address: "1.2.3.4", port: 22, username: "root", authType: "password", password: "pw", tags: [], color: "#64748b" });
    mockEncrypt.mockResolvedValue("enc2");
    await useHostStore.getState().updateHost("h1", { name: "prod2" });
    expect(mockEncrypt).toHaveBeenCalledWith("hosts", expect.objectContaining({ address: "1.2.3.4", password: "pw" }));
  });

  it("deleteHost tombstones and clears selection", async () => {
    useHostStore.setState({ hosts: [{ id: "h1", name: "x", address: "a", port: 22, tags: [], sortOrder: 0, createdAt: "", updatedAt: "" }], selectedHost: { id: "h1" } });
    await useHostStore.getState().deleteHost("h1");
    expect(mockDelete).toHaveBeenCalledWith("hosts", "h1");
    expect(useHostStore.getState().hosts).toEqual([]);
    expect(useHostStore.getState().selectedHost).toBeNull();
  });

  it("getCredentialsForHost resolves key auth via keyStore", async () => {
    mockGet.mockResolvedValue({ id: "h1", revision: 1, vault_id: "v1", created_at: 1, updated_at: 1, deleted_at: null, name: "prod", key_id: "k1", sort_order: 0, data: "enc" });
    mockDecrypt.mockResolvedValue({ address: "1.2.3.4", port: 22, username: "root", authType: "key", password: null, tags: [], color: "#64748b" });
    const creds = await useHostStore.getState().getCredentialsForHost("h1");
    expect(creds.privateKey).toBe("PRIVATE");
  });
});
```

(Adjust the keyStore mock to the file's real import path; alternatively stub `useKeyStore.setState`) as the file's existing conventions dictate. Existing tests for groups follow the same patterns — add: `fetchGroups` decrypts `{}` payload into Group; `createGroup` upserts with `data` encrypted `"{}"`; `deleteGroup` tombstones.)

- [ ] **Step 2: Run test to verify it fails**

Run: `cd client && pnpm vitest run src/stores/hosts/hostStore.test.ts`
Expected: FAIL — stores are no-ops.

- [ ] **Step 3: Implement**

Replace the store body in `hostStore.ts` with the real implementation (keep `Host`, `Group`, and the `HostState` interface verbatim):

```ts
import { create } from "zustand";
import { decryptRowData, encryptRowData } from "@/lib/crypto/crypto";
import { deleteRow, getRow, listRows, upsertRow } from "@/lib/db/db";
import { useKeyStore } from "@/stores/keys/keyStore";
import { useVaultStore } from "@/stores/vault/vaultStore";

// ... Host / Group interfaces unchanged ...

function newId(): string {
  return crypto.randomUUID();
}

interface HostPayload {
  address: string;
  port: number;
  username: string;
  authType: "password" | "key";
  password?: string;
  tags: string[];
  color?: string;
}

async function hostFromRow(row: SyncRowLike): Promise<Host> {
  const payload = (await decryptRowData(row.data)) as Partial<HostPayload>;
  return {
    id: row.id,
    name: row.name ?? "",
    address: payload.address ?? "",
    port: payload.port ?? 22,
    username: payload.username ?? "root",
    groupId: row.group_id ?? null,
    tags: payload.tags ?? [],
    color: payload.color ?? "#64748b",
    sortOrder: row.sort_order,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
    vaultId: row.vault_id,
    authType: payload.authType ?? "password",
    password: payload.password,
    keyId: row.key_id ?? undefined,
  };
}
```

Implement the rest with this shape: `fetchHosts(vaultId)` → `listRows("hosts", vaultId)` → map+decrypt → `set({ hosts, isLoading: false })`; `createHost(host)` → `const vaultId = host.vaultId ?? useVaultStore.getState().currentVaultId; await upsertRow("hosts", { id: newId(), vault_id: vaultId!, name, group_id: host.groupId ?? null, key_id: host.keyId ?? null, sort_order: host.sortOrder ?? 0, data: await encryptRowData("hosts", { address: host.address, port: host.port ?? 22, username: host.username ?? "root", authType: host.authType ?? "password", password: host.password, tags: host.tags ?? [], color: host.color }) })` then reload into state; `updateHost(id, patch)` → `getRow`, decrypt, merge (patch wins, preserving unknown payload fields), re-encrypt, upsert; `deleteHost(id)` → `deleteRow("hosts", id)` + state removal; `getCredentialsForHost(hostId)` → password auth returns `{ password, privateKey: "", passphrase: "" }`; key auth → `const keyCreds = await useKeyStore.getState().getCredentialsForKey(keyId)` → `{ password: "", privateKey: keyCreds, passphrase: "" }`. Groups: same against `"groups"` with `data: await encryptRowData("groups", {})`. Errors set `error` and rethrow-free state reset (`set({ isLoading: false, error })`); `clearError` unchanged.

- [ ] **Step 4: Run tests + lint**

Run: `pnpm vitest run src/stores/hosts && pnpm biome check src/stores/hosts`
Expected: PASS, no new warnings.

- [ ] **Step 5: Commit**

```bash
git add client/src/stores/hosts/
git commit -m "feat: hostStore local-first persistence (hosts+groups via db layer)"
```

### Task T7: Wire `keyStore` (TDD)

**Files:**
- Modify: `client/src/stores/keys/keyStore.ts`
- Create: `client/src/stores/keys/keyStore.test.ts`

**Interfaces:**
- Consumes: T4/T5.
- Produces: public interface unchanged. Payload (AAD `"keys"`): `{ keyType, publicKey, fingerprint, privateKey, passphrase }`.

- [ ] **Step 1: Write the failing tests**

Model the hostStore tests: (1) `fetchKeys` decrypts payload into `Key` (name from column, keyType/publicKey/fingerprint from payload, `encryptedPrivateKey` = payload.privateKey for compatibility, createdAt from `created_at`); (2) `importKey` builds id with `crypto.randomUUID()` when missing, encrypts payload, upserts with vault fallback; (3) `deleteKey` tombstones + state removal; (4) `getCredentialsForKey` decrypts and returns `privateKey`.

- [ ] **Step 2: Run test to verify it fails**

Run: `cd client && pnpm vitest run src/stores/keys/keyStore.test.ts`

- [ ] **Step 3: Implement**

```ts
import { create } from "zustand";
import { decryptRowData, encryptRowData } from "@/lib/crypto/crypto";
import { deleteRow, getRow, listRows, upsertRow } from "@/lib/db/db";
import { useVaultStore } from "@/stores/vault/vaultStore";

// Key interface / KeyState interface unchanged.

interface KeyPayload {
  keyType: string;
  publicKey: string;
  privateKey: string;
  passphrase?: string;
  fingerprint?: string;
}
```

`fetchKeys(vaultId)` → `listRows("keys", vaultId)` → `{ id, name, description, keyType: payload.keyType ?? "ed25519", publicKey: payload.publicKey, encryptedPrivateKey: payload.privateKey, fingerprint: payload.fingerprint, createdAt: String(row.created_at) }`. `importKey(key)` → id fallback `crypto.randomUUID()`, vault fallback like hostStore, `data: await encryptRowData("keys", { keyType: key.keyType ?? "ed25519", publicKey: key.publicKey ?? "", privateKey: key.encryptedPrivateKey ?? "", passphrase: undefined, fingerprint: key.fingerprint })`. `generateKey(name, keyType)` → same as importKey with empty keys. `deleteKey` / `selectKey` / `clearError` as before. `getCredentialsForKey(keyId)` → `getRow("keys", keyId)` → decrypt → `payload.privateKey`.

- [ ] **Step 4: Run tests + lint**

Run: `pnpm vitest run src/stores/keys && pnpm biome check src/stores/keys`

- [ ] **Step 5: Commit**

```bash
git add client/src/stores/keys/
git commit -m "feat: keyStore local-first persistence"
```

### Task T8: Wire `snippetStore` + `workspaceStore` (TDD)

**Files:**
- Modify: `client/src/stores/snippets/snippetStore.ts`, `client/src/stores/workspaces/workspaceStore.ts`
- Create: `client/src/stores/snippets/snippetStore.test.ts`, `client/src/stores/workspaces/workspaceStore.test.ts`

**Interfaces:**
- Consumes: T4/T5.
- Produces: public interfaces unchanged. Payloads: snippets (AAD `"snippets"`) `{ command, tags }`; workspaces (AAD `"workspaces"`) `{ layout, hostIds }`.

- [ ] **Step 1: Write the failing tests**

Snippets: (1) `fetchSnippets` decrypts into `Snippet` (name column, command/tags from payload, description from column); (2) `createSnippet` encrypts payload + upserts (vault fallback) + state; (3) `updateSnippet` preserves unpatched `command`/`tags`; (4) `deleteSnippet` tombstones. Workspaces: (1) `fetchWorkspaces` maps layout string from payload; (2) `createWorkspace(name, layout, vaultId?)` upserts with `data = encrypt("workspaces", { layout: JSON.stringify(layout), hostIds: undefined })`; (3) `renameWorkspace` re-encrypts with unchanged layout; (4) `deleteWorkspace` tombstones.

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm vitest run src/stores/snippets src/stores/workspaces`

- [ ] **Step 3: Implement**

Follow the hostStore pattern exactly (same vault fallback helper inline; same error/state handling; keep `setSearchQuery`/`getFilteredSnippets` for snippets and `isLoading` handling for workspaces). Workspace model mapping: `Workspace { id, name, layout: (payload.layout as string) ?? "{}", vaultId: row.vault_id, hostIds: payload.hostIds, createdAt: String(row.created_at), updatedAt: String(row.updated_at) }`.

- [ ] **Step 4: Run tests + lint**

Run: `pnpm vitest run src/stores/snippets src/stores/workspaces && pnpm biome check src/stores/snippets src/stores/workspaces`

- [ ] **Step 5: Commit**

```bash
git add client/src/stores/snippets/ client/src/stores/workspaces/
git commit -m "feat: snippet and workspace stores local-first persistence"
```

### Task T9: Gate pass (plan-level)

- [ ] **Step 1: Full Rust suite**

Run: `cd client/src-tauri && cargo check && cargo test`
Expected: PASS (T0–T3 added ~10 tests).

- [ ] **Step 2: Full TS suite + lint**

Run: `cd client && pnpm vitest run && pnpm biome check .`
Expected: PASS (78 prior + ~15 new; biome only pre-existing warnings — none new).

- [ ] **Step 3: Server untouched**

Run: `cd server && go vet ./... && go test ./...`
Expected: PASS (no server changes in this plan).

- [ ] **Step 4: Manual smoke (`pnpm tauri dev` + dev server)**

1. Boot, login, and: create a group, a host (password auth), an SSH key, a snippet, a workspace. Restart the app → all five persist (hosts/groups/snippets visible in panels, key in list, workspace in list).
2. Delete the host → restart → gone. Devtools: `await invoke("db_outbox")` → entry `{ table_name: "hosts", record_id: ... }` still present (tombstone awaiting sync).
3. Stop the server → create + delete hosts and snippets → all work locally, no error surfaces; restart server → login flows still work.
4. Logout → login again → all previously created data is gone (`wipe_all`); a fresh host you create on the new session persists across app restarts.

## Plan-level gates and definitions of done

- All tasks' unit tests pass; existing suites green (cargo, vitest, biome, go).
- `grep -c fetch` in `client/src` unchanged (no new HTTP anywhere — all data is local).
- No `record_type` / `records` references remain in `client/src-tauri/src` (grep-verify).
- Store interfaces (`Host`, `Group`, `Key`, `Snippet`, `Workspace`, + action signatures) byte-identical to today — components compile untouched.
- Outbox grows on every local write/tombstone; `db_outbox` returns pending entries; nothing ever contacts the server for data.

## Follow-up plans (phases 3–6, separate docs)

- **Plan #3** — Server `/sync/pull` + `/sync/push` (CAS `WHERE revision < :new`, fate enum, per-vault watermark, owner/member AuthZ, encrypted-payload passthrough) + go tests.
- **Plan #4** — Sync engine (TS): pull/merge/push, 3s debounce, launch/reconnect/manual triggers, conflict parking into `sync_conflicts`, tombstones, offline banner + badges + sync status (uses T3 `db_outbox`/`db_list` include_deleted and T4 wrappers).
- **Plan #5** — History table + record writes for activity; keychain custody cleanup (delete JS `loadRefreshToken` read path).

## Open questions (none blocking)

- `port` lives inside the encrypted payload (spec §3's `hosts.port INTEGER` is unworkable under the §6 whitelist). Plan #3's server mirror must use an opaque TEXT payload column, never typed integers.
- `row_from` may need a small pivot if plan code's column-name reads deviate from the landed SQL; the contract to preserve: envelope positions 0–5, then whitelist columns by name, `data` last.

## Amendments

- **2026-08-10 — Atomicity of row write + outbox insert (Affects T1 code + T2):** T1's `upsert_sync_row` originally issued the row `INSERT OR REPLACE` and the `outbox` insert as two separate auto-commit statements. A crash in between would leave a data write with no outbox entry — that write would never sync (permanent offline-first divergence). Amended: both writes now run inside a single `conn.transaction()`; `tombstone_sync_row` (T2) uses the same pattern. T2 gained a Step 0 to retrofit the fix into the shipped T1 code (included in the T2 commit). No test changes required — behavior under success is identical; the transaction is invisible to the existing tests. Raised by T1 task-reviewer (Important, plan-mandated).