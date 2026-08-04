use rusqlite::{params, Connection};
use std::sync::Mutex;

pub struct LocalDb {
    pub conn: Mutex<Connection>,
}

/// Open (or create) the local SQLite database and ensure all tables exist.
pub fn open(path: &str) -> Result<LocalDb, String> {
    let conn = Connection::open(path).map_err(|e| format!("Failed to open DB: {e}"))?;
    conn.execute_batch("PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;")
        .map_err(|e| format!("Failed to set pragmas: {e}"))?;

    conn.execute_batch(
        "CREATE TABLE IF NOT EXISTS user_profiles (
            id TEXT PRIMARY KEY,
            email TEXT NOT NULL UNIQUE,
            name TEXT NOT NULL,
            auth_provider TEXT NOT NULL DEFAULT 'password',
            provider_sub TEXT,
            salt_cl TEXT,
            kdf_m INTEGER NOT NULL DEFAULT 67108864,
            kdf_t INTEGER NOT NULL DEFAULT 3,
            kdf_p INTEGER NOT NULL DEFAULT 1,
            public_key TEXT,
            initialized INTEGER NOT NULL DEFAULT 0,
            last_login_at TEXT,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS user_keys (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id TEXT NOT NULL,
            key_type TEXT NOT NULL,
            payload TEXT NOT NULL,
            created_at TEXT NOT NULL,
            UNIQUE(user_id, key_type)
        );

        CREATE TABLE IF NOT EXISTS vaults (
            id TEXT PRIMARY KEY,
            owner_id TEXT NOT NULL,
            kind TEXT NOT NULL,
            name TEXT NOT NULL,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS records (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            vault_id TEXT NOT NULL,
            record_type TEXT NOT NULL,
            data TEXT NOT NULL,
            revision INTEGER NOT NULL DEFAULT 1,
            deleted_at TEXT,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        );

        CREATE INDEX IF NOT EXISTS idx_records_vault_id_revision ON records(vault_id, revision);
        CREATE INDEX IF NOT EXISTS idx_records_vault_id ON records(vault_id);
        CREATE INDEX IF NOT EXISTS idx_records_user_id ON records(user_id);
        ",
    )
    .map_err(|e| format!("Failed to create tables: {e}"))?;

    Ok(LocalDb {
        conn: Mutex::new(conn),
    })
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct UserProfile {
    pub id: String,
    pub email: String,
    pub name: String,
    pub auth_provider: String,
    pub provider_sub: Option<String>,
    pub salt_cl: Option<String>,
    pub kdf_m: i64,
    pub kdf_t: i64,
    pub kdf_p: i64,
    pub public_key: Option<String>,
    pub initialized: bool,
    pub last_login_at: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

pub fn upsert_user_profile(db: &LocalDb, profile: &UserProfile) -> Result<(), String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    conn.execute(
        "INSERT INTO user_profiles (id, email, name, auth_provider, provider_sub, salt_cl,
         kdf_m, kdf_t, kdf_p, public_key, initialized, last_login_at, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14)
         ON CONFLICT(id) DO UPDATE SET
            email=excluded.email, name=excluded.name, auth_provider=excluded.auth_provider,
            provider_sub=excluded.provider_sub, salt_cl=excluded.salt_cl,
            kdf_m=excluded.kdf_m, kdf_t=excluded.kdf_t, kdf_p=excluded.kdf_p,
            public_key=excluded.public_key, initialized=excluded.initialized,
            last_login_at=excluded.last_login_at, updated_at=excluded.updated_at",
        params![
            profile.id,
            profile.email,
            profile.name,
            profile.auth_provider,
            profile.provider_sub,
            profile.salt_cl,
            profile.kdf_m,
            profile.kdf_t,
            profile.kdf_p,
            profile.public_key,
            profile.initialized as i64,
            profile.last_login_at,
            profile.created_at,
            profile.updated_at,
        ],
    )
    .map_err(|e| format!("upsert_user_profile: {e}"))?;
    Ok(())
}

pub fn get_user_profile(db: &LocalDb, user_id: &str) -> Result<Option<UserProfile>, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare(
            "SELECT id, email, name, auth_provider, provider_sub, salt_cl,
                    kdf_m, kdf_t, kdf_p, public_key, initialized, last_login_at,
                    created_at, updated_at
             FROM user_profiles WHERE id = ?1",
        )
        .map_err(|e| e.to_string())?;

    let row = stmt
        .query_row(params![user_id], |row| {
            Ok(UserProfile {
                id: row.get(0)?,
                email: row.get(1)?,
                name: row.get(2)?,
                auth_provider: row.get(3)?,
                provider_sub: row.get(4)?,
                salt_cl: row.get(5)?,
                kdf_m: row.get(6)?,
                kdf_t: row.get(7)?,
                kdf_p: row.get(8)?,
                public_key: row.get(9)?,
                initialized: row.get::<_, i64>(10)? != 0,
                last_login_at: row.get(11)?,
                created_at: row.get(12)?,
                updated_at: row.get(13)?,
            })
        })
        .ok();

    Ok(row)
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct UserKeyRow {
    pub id: i64,
    pub user_id: String,
    pub key_type: String,
    pub payload: String,
    pub created_at: String,
}

pub fn upsert_keyring(
    db: &LocalDb,
    user_id: &str,
    key_type: &str,
    payload: &str,
) -> Result<(), String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    let now = chrono_utc_now();
    conn.execute(
        "INSERT INTO user_keys (user_id, key_type, payload, created_at)
         VALUES (?1, ?2, ?3, ?4)
         ON CONFLICT(user_id, key_type) DO UPDATE SET payload=excluded.payload",
        params![user_id, key_type, payload, now],
    )
    .map_err(|e| format!("upsert_keyring: {e}"))?;
    Ok(())
}

pub fn get_keyring(db: &LocalDb, user_id: &str) -> Result<Vec<UserKeyRow>, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare(
            "SELECT id, user_id, key_type, payload, created_at
             FROM user_keys WHERE user_id = ?1",
        )
        .map_err(|e| e.to_string())?;

    let rows = stmt
        .query_map(params![user_id], |row| {
            Ok(UserKeyRow {
                id: row.get(0)?,
                user_id: row.get(1)?,
                key_type: row.get(2)?,
                payload: row.get(3)?,
                created_at: row.get(4)?,
            })
        })
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();

    Ok(rows)
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct VaultRow {
    pub id: String,
    pub owner_id: String,
    pub kind: String,
    pub name: String,
    pub created_at: String,
    pub updated_at: String,
}

pub fn upsert_vault(db: &LocalDb, vault: &VaultRow) -> Result<(), String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    conn.execute(
        "INSERT INTO vaults (id, owner_id, kind, name, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6)
         ON CONFLICT(id) DO UPDATE SET
            owner_id=excluded.owner_id, kind=excluded.kind, name=excluded.name,
            updated_at=excluded.updated_at",
        params![
            vault.id,
            vault.owner_id,
            vault.kind,
            vault.name,
            vault.created_at,
            vault.updated_at,
        ],
    )
    .map_err(|e| format!("upsert_vault: {e}"))?;
    Ok(())
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct RecordRow {
    pub id: String,
    pub user_id: String,
    pub vault_id: String,
    pub record_type: String,
    pub data: String,
    pub revision: i64,
    pub deleted_at: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

pub fn upsert_record(db: &LocalDb, record: &RecordRow) -> Result<(), String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    conn.execute(
        "INSERT INTO records (id, user_id, vault_id, record_type, data, revision, deleted_at, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)
         ON CONFLICT(id) DO UPDATE SET
            data=excluded.data, revision=excluded.revision, deleted_at=excluded.deleted_at,
            record_type=excluded.record_type, updated_at=excluded.updated_at",
        params![
            record.id,
            record.user_id,
            record.vault_id,
            record.record_type,
            record.data,
            record.revision,
            record.deleted_at,
            record.created_at,
            record.updated_at,
        ],
    )
    .map_err(|e| format!("upsert_record: {e}"))?;
    Ok(())
}

/// Query records in a vault. If `include_deleted` is false, soft-deleted records are excluded.
pub fn query_records(
    db: &LocalDb,
    vault_id: &str,
    include_deleted: bool,
) -> Result<Vec<RecordRow>, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    let sql = if include_deleted {
        "SELECT id, user_id, vault_id, record_type, data, revision, deleted_at, created_at, updated_at
         FROM records WHERE vault_id = ?1 ORDER BY revision DESC"
    } else {
        "SELECT id, user_id, vault_id, record_type, data, revision, deleted_at, created_at, updated_at
         FROM records WHERE vault_id = ?1 AND deleted_at IS NULL ORDER BY revision DESC"
    };

    let mut stmt = conn.prepare(sql).map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map(params![vault_id], |row| {
            Ok(RecordRow {
                id: row.get(0)?,
                user_id: row.get(1)?,
                vault_id: row.get(2)?,
                record_type: row.get(3)?,
                data: row.get(4)?,
                revision: row.get(5)?,
                deleted_at: row.get(6)?,
                created_at: row.get(7)?,
                updated_at: row.get(8)?,
            })
        })
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();

    Ok(rows)
}

/// Soft-delete a record by setting deleted_at.
pub fn delete_record(db: &LocalDb, record_id: &str) -> Result<(), String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    let now = chrono_utc_now();
    conn.execute(
        "UPDATE records SET deleted_at = ?1, updated_at = ?1 WHERE id = ?2 AND deleted_at IS NULL",
        params![now, record_id],
    )
    .map_err(|e| format!("delete_record: {e}"))?;
    Ok(())
}

/// Hard-delete a record (for cleanup/testing).
pub fn hard_delete_record(db: &LocalDb, record_id: &str) -> Result<(), String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM records WHERE id = ?1", params![record_id])
        .map_err(|e| format!("hard_delete_record: {e}"))?;
    Ok(())
}

fn chrono_utc_now() -> String {
    // Avoid chrono dependency — use a simple ISO-8601 timestamp
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs();
    format!("{now}")
}

#[cfg(test)]
mod tests {
    use super::*;

    fn test_db() -> LocalDb {
        open(":memory:").unwrap()
    }

    #[test]
    fn test_open_creates_tables() {
        let db = test_db();
        let conn = db.conn.lock().unwrap();
        // Check all expected tables exist
        let tables: Vec<String> = conn
            .prepare("SELECT name FROM sqlite_master WHERE type='table'")
            .unwrap()
            .query_map([], |row| row.get(0))
            .unwrap()
            .filter_map(|r| r.ok())
            .collect();
        assert!(tables.contains(&"user_profiles".to_string()));
        assert!(tables.contains(&"user_keys".to_string()));
        assert!(tables.contains(&"vaults".to_string()));
        assert!(tables.contains(&"records".to_string()));
    }

    #[test]
    fn test_upsert_user_profile_roundtrip() {
        let db = test_db();
        let profile = UserProfile {
            id: "u1".to_string(),
            email: "test@example.com".to_string(),
            name: "Test User".to_string(),
            auth_provider: "password".to_string(),
            provider_sub: None,
            salt_cl: Some("abc123".to_string()),
            kdf_m: 67108864,
            kdf_t: 3,
            kdf_p: 1,
            public_key: Some("pk_base64".to_string()),
            initialized: true,
            last_login_at: None,
            created_at: "1700000000".to_string(),
            updated_at: "1700000000".to_string(),
        };
        upsert_user_profile(&db, &profile).unwrap();

        let loaded = get_user_profile(&db, "u1").unwrap().unwrap();
        assert_eq!(loaded.email, "test@example.com");
        assert_eq!(loaded.name, "Test User");
        assert!(loaded.initialized);
    }

    #[test]
    fn test_upsert_user_profile_updates() {
        let db = test_db();
        let mut profile = UserProfile {
            id: "u1".to_string(),
            email: "old@example.com".to_string(),
            name: "Old Name".to_string(),
            auth_provider: "password".to_string(),
            provider_sub: None,
            salt_cl: None,
            kdf_m: 67108864,
            kdf_t: 3,
            kdf_p: 1,
            public_key: None,
            initialized: false,
            last_login_at: None,
            created_at: "1700000000".to_string(),
            updated_at: "1700000000".to_string(),
        };
        upsert_user_profile(&db, &profile).unwrap();

        profile.email = "new@example.com".to_string();
        profile.name = "New Name".to_string();
        profile.initialized = true;
        upsert_user_profile(&db, &profile).unwrap();

        let loaded = get_user_profile(&db, "u1").unwrap().unwrap();
        assert_eq!(loaded.email, "new@example.com");
        assert_eq!(loaded.name, "New Name");
        assert!(loaded.initialized);
    }

    #[test]
    fn test_upsert_keyring_roundtrip() {
        let db = test_db();
        upsert_keyring(&db, "u1", "dek_wrapped_by_kek", "encrypted_payload_1").unwrap();
        upsert_keyring(&db, "u1", "dek_wrapped_by_recovery", "encrypted_payload_2").unwrap();

        let keys = get_keyring(&db, "u1").unwrap();
        assert_eq!(keys.len(), 2);

        let dek_key = keys.iter().find(|k| k.key_type == "dek_wrapped_by_kek").unwrap();
        assert_eq!(dek_key.payload, "encrypted_payload_1");
    }

    #[test]
    fn test_upsert_keyring_updates() {
        let db = test_db();
        upsert_keyring(&db, "u1", "dek_wrapped_by_kek", "old_payload").unwrap();
        upsert_keyring(&db, "u1", "dek_wrapped_by_kek", "new_payload").unwrap();

        let keys = get_keyring(&db, "u1").unwrap();
        assert_eq!(keys.len(), 1);
        assert_eq!(keys[0].payload, "new_payload");
    }

    #[test]
    fn test_upsert_vault_roundtrip() {
        let db = test_db();
        let vault = VaultRow {
            id: "v1".to_string(),
            owner_id: "u1".to_string(),
            kind: "personal".to_string(),
            name: "Personal".to_string(),
            created_at: "1700000000".to_string(),
            updated_at: "1700000000".to_string(),
        };
        upsert_vault(&db, &vault).unwrap();

        let conn = db.conn.lock().unwrap();
        let name: String = conn
            .query_row("SELECT name FROM vaults WHERE id = 'v1'", [], |row| row.get(0))
            .unwrap();
        assert_eq!(name, "Personal");
    }

    #[test]
    fn test_upsert_record_and_query_roundtrip() {
        let db = test_db();
        let record = RecordRow {
            id: "r1".to_string(),
            user_id: "u1".to_string(),
            vault_id: "v1".to_string(),
            record_type: "host".to_string(),
            data: "encrypted_host_data".to_string(),
            revision: 1,
            deleted_at: None,
            created_at: "1700000000".to_string(),
            updated_at: "1700000000".to_string(),
        };
        upsert_record(&db, &record).unwrap();

        let records = query_records(&db, "v1", false).unwrap();
        assert_eq!(records.len(), 1);
        assert_eq!(records[0].id, "r1");
        assert_eq!(records[0].record_type, "host");
        assert_eq!(records[0].data, "encrypted_host_data");
    }

    #[test]
    fn test_delete_record_marks_deleted() {
        let db = test_db();
        let record = RecordRow {
            id: "r1".to_string(),
            user_id: "u1".to_string(),
            vault_id: "v1".to_string(),
            record_type: "host".to_string(),
            data: "data".to_string(),
            revision: 1,
            deleted_at: None,
            created_at: "1700000000".to_string(),
            updated_at: "1700000000".to_string(),
        };
        upsert_record(&db, &record).unwrap();

        delete_record(&db, "r1").unwrap();

        // Should not appear when excluding deleted
        let visible = query_records(&db, "v1", false).unwrap();
        assert!(visible.is_empty());

        // Should appear when including deleted
        let all = query_records(&db, "v1", true).unwrap();
        assert_eq!(all.len(), 1);
        assert!(all[0].deleted_at.is_some());
    }

    #[test]
    fn test_query_records_excludes_deleted_by_default() {
        let db = test_db();
        for i in 0..5 {
            let record = RecordRow {
                id: format!("r{i}"),
                user_id: "u1".to_string(),
                vault_id: "v1".to_string(),
                record_type: "host".to_string(),
                data: format!("data_{i}"),
                revision: i + 1,
                deleted_at: None,
                created_at: "1700000000".to_string(),
                updated_at: "1700000000".to_string(),
            };
            upsert_record(&db, &record).unwrap();
        }
        delete_record(&db, "r2").unwrap();
        delete_record(&db, "r4").unwrap();

        let visible = query_records(&db, "v1", false).unwrap();
        assert_eq!(visible.len(), 3);
        let ids: Vec<&str> = visible.iter().map(|r| r.id.as_str()).collect();
        assert!(ids.contains(&"r0"));
        assert!(ids.contains(&"r1"));
        assert!(ids.contains(&"r3"));
    }
}
