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