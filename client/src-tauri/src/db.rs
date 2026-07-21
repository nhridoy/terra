use rusqlite::{params, Connection};
use std::sync::Mutex;

static DB: Mutex<Option<Connection>> = Mutex::new(None);

pub fn init(path: &str) -> Result<(), String> {
    let conn = Connection::open(path).map_err(|e| e.to_string())?;
    conn.execute_batch("PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;")
        .map_err(|e| e.to_string())?;

    conn.execute_batch(
        "CREATE TABLE IF NOT EXISTS hosts (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            vault_id TEXT DEFAULT '',
            group_id TEXT DEFAULT '',
            name TEXT NOT NULL,
            address TEXT NOT NULL,
            port INTEGER DEFAULT 22,
            username TEXT DEFAULT '',
            password TEXT DEFAULT '',
            private_key TEXT DEFAULT '',
            passphrase TEXT DEFAULT '',
            color TEXT DEFAULT '',
            tags TEXT DEFAULT '[]',
            icon TEXT DEFAULT '',
            sort_order INTEGER DEFAULT 0,
            auth_type TEXT DEFAULT 'password',
            key_id TEXT DEFAULT '',
            synced INTEGER DEFAULT 1,
            is_deleted INTEGER DEFAULT 0,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS groups (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            vault_id TEXT DEFAULT '',
            parent_id TEXT DEFAULT '',
            name TEXT NOT NULL,
            sort_order INTEGER DEFAULT 0,
            synced INTEGER DEFAULT 1,
            is_deleted INTEGER DEFAULT 0,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS vaults (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            name TEXT NOT NULL,
            description TEXT DEFAULT '',
            is_default INTEGER DEFAULT 0,
            is_system INTEGER DEFAULT 0,
            synced INTEGER DEFAULT 1,
            is_deleted INTEGER DEFAULT 0,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS keychain (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            vault_id TEXT DEFAULT '',
            name TEXT NOT NULL,
            key_type TEXT DEFAULT 'ed25519',
            description TEXT DEFAULT '',
            fingerprint TEXT DEFAULT '',
            public_key TEXT DEFAULT '',
            encrypted_private_key TEXT DEFAULT '',
            data TEXT DEFAULT '',
            synced INTEGER DEFAULT 1,
            is_deleted INTEGER DEFAULT 0,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS snippets (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            vault_id TEXT DEFAULT '',
            name TEXT NOT NULL,
            command TEXT NOT NULL,
            description TEXT DEFAULT '',
            tags TEXT DEFAULT '[]',
            synced INTEGER DEFAULT 1,
            is_deleted INTEGER DEFAULT 0,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS workspaces (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            vault_id TEXT DEFAULT '',
            name TEXT NOT NULL,
            layout TEXT DEFAULT '',
            host_ids TEXT DEFAULT '[]',
            synced INTEGER DEFAULT 1,
            is_deleted INTEGER DEFAULT 0,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS tab_groups (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            vault_id TEXT DEFAULT '',
            name TEXT NOT NULL,
            tabs TEXT DEFAULT '',
            synced INTEGER DEFAULT 1,
            is_deleted INTEGER DEFAULT 0,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS settings (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            theme TEXT DEFAULT 'dark',
            font_family TEXT DEFAULT 'JetBrains Mono',
            font_size INTEGER DEFAULT 14,
            cursor_style TEXT DEFAULT 'block',
            synced INTEGER DEFAULT 1,
            is_deleted INTEGER DEFAULT 0,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        );",
    )
    .map_err(|e| e.to_string())?;

    // Migration: add synced column to existing tables
    let tables = ["hosts", "groups", "vaults", "keychain", "snippets", "workspaces", "tab_groups", "settings"];
    for table in &tables {
        let sql = format!("ALTER TABLE {} ADD COLUMN synced INTEGER DEFAULT 1", table);
        let _ = conn.execute_batch(&sql); // ignore error if column already exists
    }

    // Migration: add is_deleted column to existing tables
    for table in &tables {
        let sql = format!("ALTER TABLE {} ADD COLUMN is_deleted INTEGER DEFAULT 0", table);
        let _ = conn.execute_batch(&sql); // ignore error if column already exists
    }

    // Migration: add auth_type and key_id columns to hosts table
    let _ = conn.execute_batch("ALTER TABLE hosts ADD COLUMN auth_type TEXT DEFAULT 'password'");
    let _ = conn.execute_batch("ALTER TABLE hosts ADD COLUMN key_id TEXT DEFAULT ''");

    // Indexes for common query patterns
    let tables = ["hosts", "groups", "vaults", "keychain", "snippets", "workspaces", "tab_groups", "settings"];
    for table in &tables {
        let _ = conn.execute_batch(&format!(
            "CREATE INDEX IF NOT EXISTS idx_{}_user_synced ON {}(user_id, synced);",
            table, table
        ));
    }
    let _ = conn.execute_batch("CREATE INDEX IF NOT EXISTS idx_hosts_vault_id ON hosts(vault_id);");
    let _ = conn.execute_batch("CREATE INDEX IF NOT EXISTS idx_groups_vault_id ON groups(vault_id);");
    let _ = conn.execute_batch("CREATE INDEX IF NOT EXISTS idx_keychain_vault_id ON keychain(vault_id);");
    let _ = conn.execute_batch("CREATE INDEX IF NOT EXISTS idx_snippets_vault_id ON snippets(vault_id);");
    let _ = conn.execute_batch("CREATE INDEX IF NOT EXISTS idx_workspaces_vault_id ON workspaces(vault_id);");
    let _ = conn.execute_batch("CREATE INDEX IF NOT EXISTS idx_tab_groups_vault_id ON tab_groups(vault_id);");

    // Let SQLite analyze tables for query planner optimization
    let _ = conn.execute_batch("PRAGMA optimize;");

    // Run VACUUM in background to reclaim space from deleted rows
    // Uses a separate connection since VACUUM needs exclusive file access
    let vacuum_path = path.to_string();
    std::thread::spawn(move || {
        if let Ok(vacuum_conn) = Connection::open(&vacuum_path) {
            let _ = vacuum_conn.execute_batch("VACUUM;");
        }
    });

    let mut db_guard = DB.lock().map_err(|e| e.to_string())?;
    *db_guard = Some(conn);
    Ok(())
}

fn conn() -> Result<std::sync::MutexGuard<'static, Option<Connection>>, String> {
    DB.lock().map_err(|e| e.to_string())
}

const ALLOWED_TABLES: &[&str] = &[
    "hosts", "groups", "vaults", "keychain",
    "snippets", "workspaces", "tab_groups", "settings",
];

fn validate_table(table: &str) -> Result<(), String> {
    if ALLOWED_TABLES.contains(&table) {
        Ok(())
    } else {
        Err(format!("Unknown table: {}", table))
    }
}

fn upsert_with_conn(connection: &Connection, table: &str, records: &[serde_json::Value]) -> Result<(), String> {
    validate_table(table)?;

    for record in records {
        let obj = match record.as_object() {
            Some(o) => o,
            None => continue,
        };

        let _id = match obj.get("id").and_then(|v| v.as_str()) {
            Some(id) => id,
            None => continue,
        };

        let columns: Vec<String> = obj.keys().cloned().collect();
        let placeholders: Vec<String> = columns.iter().map(|_| "?".to_string()).collect();
        let values: Vec<Box<dyn rusqlite::types::ToSql>> = obj
            .values()
            .map(|v| {
                let boxed: Box<dyn rusqlite::types::ToSql> = match v {
                    serde_json::Value::String(s) => Box::new(s.clone()),
                    serde_json::Value::Number(n) => {
                        if let Some(i) = n.as_i64() {
                            Box::new(i)
                        } else {
                            Box::new(n.as_f64().unwrap_or(0.0))
                        }
                    }
                    serde_json::Value::Bool(b) => Box::new(*b as i32),
                    serde_json::Value::Null => Box::new(Option::<String>::None),
                    _ => Box::new(v.to_string()),
                };
                boxed
            })
            .collect();

        let sql = format!(
            "INSERT OR REPLACE INTO {} ({}) VALUES ({})",
            table,
            columns.join(", "),
            placeholders.join(", ")
        );

        let param_refs: Vec<&dyn rusqlite::types::ToSql> =
            values.iter().map(|v| v.as_ref()).collect();
        connection
            .execute(&sql, param_refs.as_slice())
            .map_err(|e| format!("upsert {}: {}", table, e))?;
    }

    Ok(())
}

pub fn upsert_records(table: &str, records: &[serde_json::Value]) -> Result<(), String> {
    let db_guard = conn()?;
    let connection = db_guard.as_ref().ok_or("DB not initialized")?;
    upsert_with_conn(connection, table, records)
}

pub fn delete_record(table: &str, id: &str) -> Result<(), String> {
    let db_guard = conn()?;
    let connection = db_guard.as_ref().ok_or("DB not initialized")?;

    validate_table(table)?;

    let sql = format!("UPDATE {} SET is_deleted = 1, synced = 0 WHERE id = ?1", table);
    connection
        .execute(&sql, params![id])
        .map_err(|e| format!("delete {}: {}", table, e))?;
    Ok(())
}

pub fn fetch_all(table: &str) -> Result<Vec<serde_json::Value>, String> {
    let db_guard = conn()?;
    let connection = db_guard.as_ref().ok_or("DB not initialized")?;

    validate_table(table)?;

    let pragma = format!("PRAGMA table_info({})", table);
    let mut stmt = connection
        .prepare(&pragma)
        .map_err(|e| e.to_string())?;
    let columns: Vec<String> = stmt
        .query_map([], |row| row.get::<_, String>(1))
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();

    if columns.is_empty() {
        return Ok(vec![]);
    }

    let sql = format!("SELECT * FROM {}", table);
    let mut stmt = connection
        .prepare(&sql)
        .map_err(|e| e.to_string())?;

    let rows = stmt
        .query_map([], |row| {
            let mut obj = serde_json::Map::new();
            for (i, col) in columns.iter().enumerate() {
                let val: Result<String, _> = row.get(i);
                match val {
                    Ok(v) => {
                        if let Ok(n) = v.parse::<i64>() {
                            obj.insert(col.clone(), serde_json::Value::Number(n.into()));
                        } else if v == "1" || v == "0" {
                            obj.insert(col.clone(), serde_json::Value::Bool(v == "1"));
                        } else {
                            obj.insert(col.clone(), serde_json::Value::String(v));
                        }
                    }
                    Err(_) => {
                        obj.insert(col.clone(), serde_json::Value::Null);
                    }
                }
            }
            Ok(serde_json::Value::Object(obj))
        })
        .map_err(|e| e.to_string())?;

    let mut results = Vec::new();
    for row in rows {
        if let Ok(val) = row {
            results.push(val);
        }
    }

    Ok(results)
}

pub fn fetch_filtered(table: &str, user_id: &str, vault_id: Option<&str>) -> Result<Vec<serde_json::Value>, String> {
    let db_guard = conn()?;
    let connection = db_guard.as_ref().ok_or("DB not initialized")?;

    validate_table(table)?;

    let pragma = format!("PRAGMA table_info({})", table);
    let mut stmt = connection
        .prepare(&pragma)
        .map_err(|e| e.to_string())?;
    let columns: Vec<String> = stmt
        .query_map([], |row| row.get::<_, String>(1))
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();

    if columns.is_empty() {
        return Ok(vec![]);
    }

    let mut where_clauses = vec!["user_id = ?1".to_string(), "is_deleted = 0".to_string()];
    if vault_id.is_some() {
        where_clauses.push("vault_id = ?2".to_string());
    }
    let sql = format!("SELECT * FROM {} WHERE {}", table, where_clauses.join(" AND "));

    let mut stmt = connection
        .prepare(&sql)
        .map_err(|e| e.to_string())?;

    let row_mapper = |row: &rusqlite::Row| {
        let mut obj = serde_json::Map::new();
        for (i, col) in columns.iter().enumerate() {
            let val: Result<String, _> = row.get(i);
            match val {
                Ok(v) => {
                    if let Ok(n) = v.parse::<i64>() {
                        obj.insert(col.clone(), serde_json::Value::Number(n.into()));
                    } else if v == "1" || v == "0" {
                        obj.insert(col.clone(), serde_json::Value::Bool(v == "1"));
                    } else {
                        obj.insert(col.clone(), serde_json::Value::String(v));
                    }
                }
                Err(_) => {
                    obj.insert(col.clone(), serde_json::Value::Null);
                }
            }
        }
        Ok(serde_json::Value::Object(obj))
    };

    let rows = if let Some(vid) = vault_id {
        stmt.query_map(params![user_id, vid], row_mapper)
            .map_err(|e| e.to_string())?
    } else {
        stmt.query_map(params![user_id], row_mapper)
            .map_err(|e| e.to_string())?
    };

    let mut results = Vec::new();
    for row in rows {
        if let Ok(val) = row {
            results.push(val);
        }
    }

    Ok(results)
}

#[tauri::command]
pub fn get_unsynced_records(table: String) -> Result<Vec<serde_json::Value>, String> {
    let db_guard = conn()?;
    let connection = db_guard.as_ref().ok_or("DB not initialized")?;

    validate_table(&table)?;

    let pragma = format!("PRAGMA table_info({})", table);
    let mut stmt = connection
        .prepare(&pragma)
        .map_err(|e| e.to_string())?;
    let columns: Vec<String> = stmt
        .query_map([], |row| row.get::<_, String>(1))
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();

    if columns.is_empty() {
        return Ok(vec![]);
    }

    let sql = format!("SELECT * FROM {} WHERE synced = 0", table);
    let mut stmt = connection
        .prepare(&sql)
        .map_err(|e| e.to_string())?;

    let rows = stmt
        .query_map([], |row| {
            let mut obj = serde_json::Map::new();
            for (i, col) in columns.iter().enumerate() {
                let val: Result<String, _> = row.get(i);
                match val {
                    Ok(v) => {
                        if let Ok(n) = v.parse::<i64>() {
                            obj.insert(col.clone(), serde_json::Value::Number(n.into()));
                        } else if v == "1" || v == "0" {
                            obj.insert(col.clone(), serde_json::Value::Bool(v == "1"));
                        } else {
                            obj.insert(col.clone(), serde_json::Value::String(v));
                        }
                    }
                    Err(_) => {
                        obj.insert(col.clone(), serde_json::Value::Null);
                    }
                }
            }
            Ok(serde_json::Value::Object(obj))
        })
        .map_err(|e| e.to_string())?;

    let mut results = Vec::new();
    for row in rows {
        if let Ok(val) = row {
            results.push(val);
        }
    }

    Ok(results)
}

#[allow(dead_code)]
pub fn clear_all() -> Result<(), String> {
    let db_guard = conn()?;
    let connection = db_guard.as_ref().ok_or("DB not initialized")?;

    for table in ALLOWED_TABLES {
        let sql = format!("DELETE FROM {}", table);
        connection.execute(&sql, []).map_err(|e| e.to_string())?;
    }
    Ok(())
}

pub fn delete_by_column(table: &str, column: &str, value: &str) -> Result<usize, String> {
    validate_table(table)?;
    let allowed_cols = [
        "vault_id", "user_id", "group_id", "id",
    ];
    if !allowed_cols.contains(&column) {
        return Err(format!("Unknown column: {}", column));
    }

    let db_guard = conn()?;
    let connection = db_guard.as_ref().ok_or("DB not initialized")?;
    
    // Soft delete for vault cascade (vault_id column)
    if column == "vault_id" {
        let sql = format!("UPDATE {} SET is_deleted = 1, synced = 0 WHERE {} = ?1", table, column);
        let rows = connection.execute(&sql, [value]).map_err(|e| e.to_string())?;
        Ok(rows as usize)
    } else {
        // Hard delete for other columns
        let sql = format!("DELETE FROM {} WHERE {} = ?1", table, column);
        let rows = connection.execute(&sql, [value]).map_err(|e| e.to_string())?;
        Ok(rows as usize)
    }
}

fn mark_synced_with_conn(connection: &Connection, table: &str, ids: &[String]) -> Result<(), String> {
    if ids.is_empty() {
        return Ok(());
    }

    validate_table(table)?;

    let placeholders: Vec<String> = ids.iter().enumerate().map(|(i, _)| format!("?{}", i + 1)).collect();
    let sql = format!(
        "UPDATE {} SET synced = 1 WHERE id IN ({})",
        table,
        placeholders.join(", ")
    );
    let param_refs: Vec<&dyn rusqlite::types::ToSql> = ids.iter().map(|v| v as &dyn rusqlite::types::ToSql).collect();
    connection.execute(&sql, param_refs.as_slice()).map_err(|e| format!("mark_synced {}: {}", table, e))?;
    Ok(())
}

#[allow(dead_code)]
pub fn mark_synced(table: &str, ids: &[String]) -> Result<(), String> {
    if ids.is_empty() {
        return Ok(());
    }
    let db_guard = conn()?;
    let connection = db_guard.as_ref().ok_or("DB not initialized")?;
    mark_synced_with_conn(connection, table, ids)
}

pub fn merge_records(table: &str, records: &[serde_json::Value], user_id: &str) -> Result<(), String> {
    let db_guard = conn()?;
    let connection = db_guard.as_ref().ok_or("DB not initialized")?;

    validate_table(table)?;

    // Collect server IDs
    let mut server_ids: Vec<String> = Vec::new();
    for record in records {
        if let Some(id) = record.get("id").and_then(|v| v.as_str()) {
            server_ids.push(id.to_string());
        }
    }

    // For records with local synced=0, compare timestamps to decide whether to upsert
    let mut local_unsynced_times: std::collections::HashMap<String, String> = std::collections::HashMap::new();
    if !server_ids.is_empty() {
        let placeholders: Vec<String> = server_ids.iter().enumerate().map(|(i, _)| format!("?{}", i + 1)).collect();
        let sql = format!(
            "SELECT id, updated_at FROM {} WHERE user_id = ? AND synced = 0 AND id IN ({})",
            table,
            placeholders.join(", ")
        );
        let mut stmt = connection.prepare(&sql).map_err(|e| format!("check synced=0: {}", e))?;
        let rows = stmt.query_map(params![user_id], |row| {
            Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?))
        }).map_err(|e| e.to_string())?;

        for row in rows {
            if let Ok((id, updated_at)) = row {
                local_unsynced_times.insert(id, updated_at);
            }
        }
    }

    // Decide which server records to upsert vs preserve
    let mut server_records_to_upsert: Vec<serde_json::Value> = Vec::new();
    for record in records {
        if let Some(id) = record.get("id").and_then(|v| v.as_str()) {
            if let Some(local_updated_at) = local_unsynced_times.get(id) {
                // Local has pending changes — compare timestamps
                let server_updated_at = record.get("updated_at")
                    .and_then(|v| v.as_str())
                    .unwrap_or("");

                // Server newer → overwrite local (upsert)
                // Local newer or equal → preserve local (skip)
                if server_updated_at > local_updated_at.as_str() {
                    server_records_to_upsert.push(record.clone());
                }
            } else {
                // No local pending change — always upsert
                server_records_to_upsert.push(record.clone());
            }
        }
    }

    if !server_records_to_upsert.is_empty() {
        upsert_with_conn(connection, table, &server_records_to_upsert)?;
        let server_ids_to_mark: Vec<String> = server_records_to_upsert
            .iter()
            .filter_map(|record| record.get("id").and_then(|v| v.as_str()))
            .map(|id| id.to_string())
            .collect();
        mark_synced_with_conn(connection, table, &server_ids_to_mark)?;
    }

    // Delete local records that are synced but NOT in server response (for this user)
    if !server_ids.is_empty() {
        let placeholders: Vec<String> = server_ids.iter().enumerate().map(|(i, _)| format!("?{}", i + 1)).collect();
        let sql = format!(
            "DELETE FROM {} WHERE user_id = ? AND synced = 1 AND id NOT IN ({})",
            table,
            placeholders.join(", ")
        );
        let mut params: Vec<Box<dyn rusqlite::types::ToSql>> = Vec::new();
        params.push(Box::new(user_id.to_string()));
        for id in &server_ids {
            params.push(Box::new(id.clone()));
        }
        let param_refs: Vec<&dyn rusqlite::types::ToSql> = params.iter().map(|v| v.as_ref()).collect();
        connection.execute(&sql, param_refs.as_slice()).map_err(|e| format!("merge delete {}: {}", table, e))?;
    } else {
        let sql = format!("DELETE FROM {} WHERE user_id = ? AND synced = 1", table);
        connection.execute(&sql, params![user_id]).map_err(|e| format!("merge delete all {}: {}", table, e))?;
    }

    Ok(())
}

#[tauri::command]
pub fn process_sync_result(table: String, results: Vec<serde_json::Value>) -> Result<(), String> {
    let db_guard = conn()?;
    let connection = db_guard.as_ref().ok_or("DB not initialized")?;

    validate_table(&table)?;

    let mut ids_to_mark_synced: Vec<String> = Vec::new();
    let mut ids_to_delete: Vec<String> = Vec::new();

    for result in results {
        if let Some(id) = result.get("id").and_then(|v| v.as_str()) {
            let status = result.get("status").and_then(|v| v.as_str()).unwrap_or("error");
            let operation = result.get("operation").and_then(|v| v.as_str()).unwrap_or("unknown");
            
            if status == "ok" {
                if operation == "upsert" {
                    ids_to_mark_synced.push(id.to_string());
                } else if operation == "delete" {
                    ids_to_delete.push(id.to_string());
                }
            } else if status == "conflict" {
                // Server has newer version — discard local record
                ids_to_delete.push(id.to_string());
            }
        }
    }

    // Mark successful upserts as synced
    if !ids_to_mark_synced.is_empty() {
        mark_synced_with_conn(connection, &table, &ids_to_mark_synced)?;
    }

    // Hard-delete successful deletions
    if !ids_to_delete.is_empty() {
        let placeholders: Vec<String> = ids_to_delete.iter().enumerate().map(|(i, _)| format!("?{}", i + 1)).collect();
        let sql = format!("DELETE FROM {} WHERE id IN ({})", table, placeholders.join(", "));
        let param_refs: Vec<&dyn rusqlite::types::ToSql> = ids_to_delete.iter().map(|v| v as &dyn rusqlite::types::ToSql).collect();
        connection.execute(&sql, param_refs.as_slice()).map_err(|e| format!("process_sync_result delete {}: {}", table, e))?;
    }

    Ok(())
}
