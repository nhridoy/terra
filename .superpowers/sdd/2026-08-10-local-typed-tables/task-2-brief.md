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