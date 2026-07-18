use rusqlite::Connection;
use std::sync::Mutex;
use std::sync::LazyLock;

pub static DB: LazyLock<Mutex<Option<Connection>>> = LazyLock::new(|| Mutex::new(None));
pub static ENCRYPTION_KEY: LazyLock<Mutex<Option<String>>> = LazyLock::new(|| Mutex::new(None));

pub fn init(db_path: &str) -> Result<(), String> {
    let conn = Connection::open(db_path).map_err(|e| e.to_string())?;
    conn.execute_batch("PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;")
        .map_err(|e| e.to_string())?;
    run_migrations(&conn).map_err(|e| e.to_string())?;
    let mut guard = DB.lock().map_err(|e| e.to_string())?;
    *guard = Some(conn);
    Ok(())
}

pub fn set_encryption_key(key: String) -> Result<(), String> {
    let mut guard = ENCRYPTION_KEY.lock().map_err(|e| e.to_string())?;
    *guard = Some(key);
    Ok(())
}

pub fn get_encryption_key() -> Result<Option<String>, String> {
    let guard = ENCRYPTION_KEY.lock().map_err(|e| e.to_string())?;
    Ok(guard.clone())
}

pub fn conn() -> Result<std::sync::MutexGuard<'static, Option<Connection>>, String> {
    DB.lock().map_err(|e| e.to_string())
}

fn run_migrations(conn: &Connection) -> Result<(), rusqlite::Error> {
    conn.execute_batch(
        "CREATE TABLE IF NOT EXISTS hosts (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            vault_id TEXT,
            group_id TEXT,
            name TEXT NOT NULL,
            hostname TEXT,
            address TEXT NOT NULL,
            port INTEGER DEFAULT 22,
            username TEXT NOT NULL,
            password TEXT,
            private_key TEXT,
            passphrase TEXT,
            auth_method TEXT DEFAULT 'password',
            tags TEXT DEFAULT '[]',
            color TEXT,
            icon TEXT,
            sort_order INTEGER DEFAULT 0,
            created_at TEXT NOT NULL DEFAULT (datetime('now')),
            updated_at TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS groups (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            vault_id TEXT,
            parent_id TEXT,
            name TEXT NOT NULL,
            sort_order INTEGER DEFAULT 0,
            created_at TEXT NOT NULL DEFAULT (datetime('now')),
            updated_at TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS vaults (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            name TEXT NOT NULL,
            description TEXT,
            is_default INTEGER DEFAULT 0,
            encrypted_data TEXT,
            created_at TEXT NOT NULL DEFAULT (datetime('now')),
            updated_at TEXT NOT NULL DEFAULT (datetime('now')),
            UNIQUE(user_id, name)
        );

        CREATE TABLE IF NOT EXISTS keychain (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            vault_id TEXT,
            name TEXT NOT NULL,
            description TEXT,
            key_type TEXT NOT NULL,
            public_key TEXT NOT NULL,
            encrypted_private_key TEXT,
            fingerprint TEXT,
            created_at TEXT NOT NULL DEFAULT (datetime('now')),
            updated_at TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS snippets (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            vault_id TEXT,
            name TEXT NOT NULL,
            command TEXT NOT NULL,
            description TEXT,
            tags TEXT DEFAULT '[]',
            created_at TEXT NOT NULL DEFAULT (datetime('now')),
            updated_at TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS workspaces (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            vault_id TEXT,
            name TEXT NOT NULL,
            layout TEXT NOT NULL,
            host_ids TEXT DEFAULT '[]',
            created_at TEXT NOT NULL DEFAULT (datetime('now')),
            updated_at TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS tab_groups (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            vault_id TEXT,
            name TEXT NOT NULL,
            layout TEXT NOT NULL,
            created_at TEXT NOT NULL DEFAULT (datetime('now')),
            updated_at TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS settings (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            theme TEXT DEFAULT 'dark',
            font_family TEXT DEFAULT 'JetBrains Mono',
            font_size INTEGER DEFAULT 14,
            cursor_style TEXT DEFAULT 'block',
            keybindings TEXT DEFAULT '{}',
            created_at TEXT NOT NULL DEFAULT (datetime('now')),
            updated_at TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS session_logs (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            host_id TEXT,
            started_at TEXT NOT NULL,
            ended_at TEXT,
            data TEXT,
            size_bytes INTEGER DEFAULT 0,
            created_at TEXT DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS command_logs (
            id TEXT PRIMARY KEY,
            session_id TEXT,
            command TEXT NOT NULL,
            output TEXT,
            exit_code INTEGER,
            executed_at TEXT NOT NULL,
            duration_ms INTEGER DEFAULT 0
        );

        CREATE TABLE IF NOT EXISTS sync_state (
            id TEXT PRIMARY KEY,
            device_id TEXT NOT NULL,
            last_sync_at TEXT,
            created_at TEXT DEFAULT (datetime('now')),
            updated_at TEXT DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS sync_tracking (
            table_name TEXT NOT NULL,
            record_id TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            device_id TEXT NOT NULL,
            is_deleted INTEGER DEFAULT 0,
            PRIMARY KEY (table_name, record_id)
        );

        CREATE TABLE IF NOT EXISTS schema_version (
            version INTEGER PRIMARY KEY,
            applied_at TEXT NOT NULL DEFAULT (datetime('now'))
        );

        INSERT OR IGNORE INTO schema_version (version) VALUES (1);
        ",
    )?;

    let alter_statements = [
        "ALTER TABLE vaults ADD COLUMN is_default INTEGER DEFAULT 0",
        "ALTER TABLE vaults ADD COLUMN encrypted_data TEXT",
        "ALTER TABLE keychain ADD COLUMN updated_at TEXT DEFAULT ''",
        "ALTER TABLE groups ADD COLUMN updated_at TEXT DEFAULT ''",
    ];
    for sql in &alter_statements {
        let _ = conn.execute(sql, []);
    }

    Ok(())
}
