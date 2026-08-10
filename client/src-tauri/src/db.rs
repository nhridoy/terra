use rusqlite::{params, Connection};
use std::sync::Mutex;

pub const DB_FILE_NAME: &str = "termvault.db";

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

        -- Synced tables: shared envelope (id, revision, vault_id, created_at,
        -- updated_at, deleted_at) + plaintext whitelist columns + opaque encrypted
        -- data blob (AEAD with AAD = table name). No SQL FK constraints: rows can
        -- arrive via sync in any order (hydration without transient failures).
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
}
