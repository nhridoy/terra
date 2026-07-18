use crate::db;
use crate::vault;
use rusqlite::{Connection, params};
use serde::{Deserialize, Serialize};

// ── Data types ──

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HostData {
    pub user_id: String,
    pub vault_id: Option<String>,
    pub group_id: Option<String>,
    pub name: String,
    pub hostname: Option<String>,
    pub address: String,
    pub port: Option<u32>,
    pub username: String,
    pub password: Option<String>,
    pub private_key: Option<String>,
    pub passphrase: Option<String>,
    pub auth_method: Option<String>,
    pub tags: Option<String>,
    pub color: Option<String>,
    pub icon: Option<String>,
    pub sort_order: Option<i32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Host {
    pub id: String,
    pub user_id: String,
    pub vault_id: Option<String>,
    pub group_id: Option<String>,
    pub name: String,
    pub hostname: Option<String>,
    pub address: String,
    pub port: i32,
    pub username: String,
    pub password: Option<String>,
    pub private_key: Option<String>,
    pub passphrase: Option<String>,
    pub auth_method: String,
    pub tags: String,
    pub color: Option<String>,
    pub icon: Option<String>,
    pub sort_order: i32,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GroupData {
    pub user_id: String,
    pub vault_id: Option<String>,
    pub parent_id: Option<String>,
    pub name: String,
    pub sort_order: Option<i32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Group {
    pub id: String,
    pub user_id: String,
    pub vault_id: Option<String>,
    pub parent_id: Option<String>,
    pub name: String,
    pub sort_order: i32,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct VaultData {
    pub user_id: String,
    pub name: String,
    pub description: Option<String>,
    pub is_default: Option<bool>,
    pub is_system: Option<bool>,
    pub encrypted_data: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Vault {
    pub id: String,
    pub user_id: String,
    pub name: String,
    pub description: Option<String>,
    pub is_default: bool,
    pub is_system: bool,
    pub encrypted_data: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct KeyData {
    pub user_id: String,
    pub vault_id: Option<String>,
    pub name: String,
    pub description: Option<String>,
    pub key_type: String,
    pub public_key: String,
    pub encrypted_private_key: Option<String>,
    pub fingerprint: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Key {
    pub id: String,
    pub user_id: String,
    pub vault_id: Option<String>,
    pub name: String,
    pub description: Option<String>,
    pub key_type: String,
    pub public_key: String,
    pub encrypted_private_key: Option<String>,
    pub fingerprint: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SnippetData {
    pub user_id: String,
    pub vault_id: Option<String>,
    pub name: String,
    pub command: String,
    pub description: Option<String>,
    pub tags: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Snippet {
    pub id: String,
    pub user_id: String,
    pub vault_id: Option<String>,
    pub name: String,
    pub command: String,
    pub description: Option<String>,
    pub tags: String,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkspaceData {
    pub user_id: String,
    pub vault_id: Option<String>,
    pub name: String,
    pub layout: String,
    pub host_ids: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Workspace {
    pub id: String,
    pub user_id: String,
    pub vault_id: Option<String>,
    pub name: String,
    pub layout: String,
    pub host_ids: String,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TabGroupData {
    pub user_id: String,
    pub vault_id: Option<String>,
    pub name: String,
    pub layout: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TabGroup {
    pub id: String,
    pub user_id: String,
    pub vault_id: Option<String>,
    pub name: String,
    pub layout: String,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SettingsData {
    pub theme: Option<String>,
    pub font_family: Option<String>,
    pub font_size: Option<i32>,
    pub cursor_style: Option<String>,
    pub keybindings: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Settings {
    pub id: String,
    pub user_id: String,
    pub theme: String,
    pub font_family: String,
    pub font_size: i32,
    pub cursor_style: String,
    pub keybindings: String,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SessionLogData {
    pub user_id: String,
    pub host_id: Option<String>,
    pub started_at: String,
    pub data: Option<String>,
    pub size_bytes: Option<i64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SessionLog {
    pub id: String,
    pub user_id: String,
    pub host_id: Option<String>,
    pub started_at: String,
    pub ended_at: Option<String>,
    pub data: Option<String>,
    pub size_bytes: i64,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CommandLogData {
    pub session_id: Option<String>,
    pub command: String,
    pub output: Option<String>,
    pub exit_code: Option<i32>,
    pub executed_at: String,
    pub duration_ms: Option<i64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CommandLog {
    pub id: String,
    pub session_id: Option<String>,
    pub command: String,
    pub output: Option<String>,
    pub exit_code: Option<i32>,
    pub executed_at: String,
    pub duration_ms: i64,
}

// ── Helpers ──

fn now() -> String {
    chrono::Utc::now().format("%Y-%m-%dT%H:%M:%SZ").to_string()
}

fn new_id() -> String {
    uuid::Uuid::new_v4().to_string()
}

fn with_conn<F, R>(f: F) -> Result<R, String>
where
    F: FnOnce(&Connection) -> Result<R, String>,
{
    let guard = db::conn()?;
    let conn = guard.as_ref().ok_or_else(|| "DB not initialized".to_string())?;
    f(conn)
}

fn update_sync(conn: &Connection, table: &str, record_id: &str, device_id: &str, is_deleted: bool) {
    let t = now();
    let _ = conn.execute(
        "INSERT OR REPLACE INTO sync_tracking (table_name, record_id, updated_at, device_id, is_deleted) VALUES (?1, ?2, ?3, ?4, ?5)",
        params![table, record_id, t, device_id, is_deleted as i32],
    );
}

fn maybe_encrypt(plaintext: &str) -> Result<String, String> {
    if plaintext.is_empty() {
        return Ok(plaintext.to_string());
    }
    let key = db::get_encryption_key().map_err(|e| e.to_string())?;
    match key {
        Some(k) => vault::encrypt_field(plaintext, &k),
        None => Ok(plaintext.to_string()),
    }
}

fn maybe_decrypt(value: &str) -> Result<String, String> {
    if value.is_empty() {
        return Ok(value.to_string());
    }
    let key = db::get_encryption_key().map_err(|e| e.to_string())?;
    match key {
        Some(k) => {
            if vault::is_encrypted_field(value) {
                vault::decrypt_field(value, &k)
            } else {
                Ok(value.to_string())
            }
        }
        None => Ok(value.to_string()),
    }
}

// ── Hosts ──

#[tauri::command]
pub fn create_host(host: HostData, device_id: String) -> Result<Host, String> {
    with_conn(|conn| {
        let id = new_id();
        let now = now();
        let port = host.port.unwrap_or(22) as i32;
        let auth_method = host.auth_method.clone().unwrap_or_else(|| "password".to_string());
        let tags = host.tags.clone().unwrap_or_else(|| "[]".to_string());
        let sort_order = host.sort_order.unwrap_or(0);
        let password = host.password.as_deref().map(|p| maybe_encrypt(p)).transpose()?;
        let private_key = host.private_key.as_deref().map(|k| maybe_encrypt(k)).transpose()?;
        let passphrase = host.passphrase.as_deref().map(|p| maybe_encrypt(p)).transpose()?;
        conn.execute(
            "INSERT INTO hosts (id, user_id, vault_id, group_id, name, hostname, address, port, username, password, private_key, passphrase, auth_method, tags, color, icon, sort_order, created_at, updated_at) VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,?13,?14,?15,?16,?17,?18,?19)",
            params![id, host.user_id, host.vault_id, host.group_id, host.name, host.hostname, host.address, port, host.username, password, private_key, passphrase, auth_method, tags, host.color, host.icon, sort_order, now, now],
        ).map_err(|e| e.to_string())?;
        update_sync(conn, "hosts", &id, &device_id, false);
        Ok(Host { id, user_id: host.user_id, vault_id: host.vault_id, group_id: host.group_id, name: host.name, hostname: host.hostname, address: host.address, port, username: host.username, password: host.password, private_key: host.private_key, passphrase: host.passphrase, auth_method, tags, color: host.color, icon: host.icon, sort_order, created_at: now.clone(), updated_at: now })
    })
}

#[tauri::command]
pub fn get_host(id: String) -> Result<Host, String> {
    with_conn(|conn| {
        let host = conn.query_row("SELECT id, user_id, vault_id, group_id, name, hostname, address, port, username, password, private_key, passphrase, auth_method, tags, color, icon, sort_order, created_at, updated_at FROM hosts WHERE id = ?1", params![id], |row| {
            Ok(Host { id: row.get(0)?, user_id: row.get(1)?, vault_id: row.get(2)?, group_id: row.get(3)?, name: row.get(4)?, hostname: row.get(5)?, address: row.get(6)?, port: row.get(7)?, username: row.get(8)?, password: row.get(9)?, private_key: row.get(10)?, passphrase: row.get(11)?, auth_method: row.get(12)?, tags: row.get(13)?, color: row.get(14)?, icon: row.get(15)?, sort_order: row.get(16)?, created_at: row.get(17)?, updated_at: row.get(18)? })
        }).map_err(|e| e.to_string())?;
        Ok(Host {
            password: host.password.as_deref().map(|p| maybe_decrypt(p)).transpose()?,
            private_key: host.private_key.as_deref().map(|k| maybe_decrypt(k)).transpose()?,
            passphrase: host.passphrase.as_deref().map(|p| maybe_decrypt(p)).transpose()?,
            ..host
        })
    })
}

#[tauri::command]
pub fn list_hosts(user_id: String, vault_id: Option<String>) -> Result<Vec<Host>, String> {
    with_conn(|conn| {
        let hosts: Vec<Host> = if let Some(ref vid) = vault_id {
            let mut stmt = conn.prepare("SELECT id, user_id, vault_id, group_id, name, hostname, address, port, username, password, private_key, passphrase, auth_method, tags, color, icon, sort_order, created_at, updated_at FROM hosts WHERE user_id = ?1 AND vault_id = ?2 ORDER BY sort_order, name").map_err(|e| e.to_string())?;
            let rows = stmt.query_map(params![user_id, vid], |row| {
                Ok(Host { id: row.get(0)?, user_id: row.get(1)?, vault_id: row.get(2)?, group_id: row.get(3)?, name: row.get(4)?, hostname: row.get(5)?, address: row.get(6)?, port: row.get(7)?, username: row.get(8)?, password: row.get(9)?, private_key: row.get(10)?, passphrase: row.get(11)?, auth_method: row.get(12)?, tags: row.get(13)?, color: row.get(14)?, icon: row.get(15)?, sort_order: row.get(16)?, created_at: row.get(17)?, updated_at: row.get(18)? })
            }).map_err(|e| e.to_string())?;
            rows.filter_map(|r| r.ok()).collect()
        } else {
            let mut stmt = conn.prepare("SELECT id, user_id, vault_id, group_id, name, hostname, address, port, username, password, private_key, passphrase, auth_method, tags, color, icon, sort_order, created_at, updated_at FROM hosts WHERE user_id = ?1 ORDER BY sort_order, name").map_err(|e| e.to_string())?;
            let rows = stmt.query_map(params![user_id], |row| {
                Ok(Host { id: row.get(0)?, user_id: row.get(1)?, vault_id: row.get(2)?, group_id: row.get(3)?, name: row.get(4)?, hostname: row.get(5)?, address: row.get(6)?, port: row.get(7)?, username: row.get(8)?, password: row.get(9)?, private_key: row.get(10)?, passphrase: row.get(11)?, auth_method: row.get(12)?, tags: row.get(13)?, color: row.get(14)?, icon: row.get(15)?, sort_order: row.get(16)?, created_at: row.get(17)?, updated_at: row.get(18)? })
            }).map_err(|e| e.to_string())?;
            rows.filter_map(|r| r.ok()).collect()
        };
        hosts.into_iter().map(|h| {
            Ok(Host {
                password: h.password.as_deref().map(|p| maybe_decrypt(p)).transpose()?,
                private_key: h.private_key.as_deref().map(|k| maybe_decrypt(k)).transpose()?,
                passphrase: h.passphrase.as_deref().map(|p| maybe_decrypt(p)).transpose()?,
                ..h
            })
        }).collect()
    })
}

#[tauri::command]
pub fn list_hosts_by_group(group_id: String) -> Result<Vec<Host>, String> {
    with_conn(|conn| {
        let mut stmt = conn.prepare("SELECT id, user_id, vault_id, group_id, name, hostname, address, port, username, password, private_key, passphrase, auth_method, tags, color, icon, sort_order, created_at, updated_at FROM hosts WHERE group_id = ?1 ORDER BY sort_order, name").map_err(|e| e.to_string())?;
        let rows = stmt.query_map(params![group_id], |row| {
            Ok(Host { id: row.get(0)?, user_id: row.get(1)?, vault_id: row.get(2)?, group_id: row.get(3)?, name: row.get(4)?, hostname: row.get(5)?, address: row.get(6)?, port: row.get(7)?, username: row.get(8)?, password: row.get(9)?, private_key: row.get(10)?, passphrase: row.get(11)?, auth_method: row.get(12)?, tags: row.get(13)?, color: row.get(14)?, icon: row.get(15)?, sort_order: row.get(16)?, created_at: row.get(17)?, updated_at: row.get(18)? })
        }).map_err(|e| e.to_string())?;
        let hosts: Vec<Host> = rows.filter_map(|r| r.ok()).collect();
        hosts.into_iter().map(|h| {
            Ok(Host {
                password: h.password.as_deref().map(|p| maybe_decrypt(p)).transpose()?,
                private_key: h.private_key.as_deref().map(|k| maybe_decrypt(k)).transpose()?,
                passphrase: h.passphrase.as_deref().map(|p| maybe_decrypt(p)).transpose()?,
                ..h
            })
        }).collect()
    })
}

#[tauri::command]
pub fn update_host(id: String, host: HostData, device_id: String) -> Result<Host, String> {
    with_conn(|conn| {
        let now = now();
        let port = host.port.unwrap_or(22) as i32;
        let auth_method = host.auth_method.clone().unwrap_or_else(|| "password".to_string());
        let tags = host.tags.clone().unwrap_or_else(|| "[]".to_string());
        let sort_order = host.sort_order.unwrap_or(0);
        let password = host.password.as_deref().map(|p| maybe_encrypt(p)).transpose()?;
        let private_key = host.private_key.as_deref().map(|k| maybe_encrypt(k)).transpose()?;
        let passphrase = host.passphrase.as_deref().map(|p| maybe_encrypt(p)).transpose()?;
        conn.execute(
            "UPDATE hosts SET user_id=?2, vault_id=?3, group_id=?4, name=?5, hostname=?6, address=?7, port=?8, username=?9, password=?10, private_key=?11, passphrase=?12, auth_method=?13, tags=?14, color=?15, icon=?16, sort_order=?17, updated_at=?18 WHERE id=?1",
            params![id, host.user_id, host.vault_id, host.group_id, host.name, host.hostname, host.address, port, host.username, password, private_key, passphrase, auth_method, tags, host.color, host.icon, sort_order, now],
        ).map_err(|e| e.to_string())?;
        update_sync(conn, "hosts", &id, &device_id, false);
        let h = conn.query_row("SELECT id, user_id, vault_id, group_id, name, hostname, address, port, username, password, private_key, passphrase, auth_method, tags, color, icon, sort_order, created_at, updated_at FROM hosts WHERE id = ?1", params![id], |row| {
            Ok(Host { id: row.get(0)?, user_id: row.get(1)?, vault_id: row.get(2)?, group_id: row.get(3)?, name: row.get(4)?, hostname: row.get(5)?, address: row.get(6)?, port: row.get(7)?, username: row.get(8)?, password: row.get(9)?, private_key: row.get(10)?, passphrase: row.get(11)?, auth_method: row.get(12)?, tags: row.get(13)?, color: row.get(14)?, icon: row.get(15)?, sort_order: row.get(16)?, created_at: row.get(17)?, updated_at: row.get(18)? })
        }).map_err(|e| e.to_string())?;
        Ok(Host {
            password: h.password.as_deref().map(|p| maybe_decrypt(p)).transpose()?,
            private_key: h.private_key.as_deref().map(|k| maybe_decrypt(k)).transpose()?,
            passphrase: h.passphrase.as_deref().map(|p| maybe_decrypt(p)).transpose()?,
            ..h
        })
    })
}

#[tauri::command]
pub fn delete_host(id: String, device_id: String) -> Result<(), String> {
    with_conn(|conn| {
        conn.execute("DELETE FROM hosts WHERE id = ?1", params![id]).map_err(|e| e.to_string())?;
        update_sync(conn, "hosts", &id, &device_id, true);
        Ok(())
    })
}

// ── Groups ──

#[tauri::command]
pub fn create_group(group: GroupData, device_id: String) -> Result<Group, String> {
    with_conn(|conn| {
        let id = new_id();
        let now = now();
        let sort_order = group.sort_order.unwrap_or(0);
        conn.execute(
            "INSERT INTO groups (id, user_id, vault_id, parent_id, name, sort_order, created_at, updated_at) VALUES (?1,?2,?3,?4,?5,?6,?7,?8)",
            params![id, group.user_id, group.vault_id, group.parent_id, group.name, sort_order, now, now],
        ).map_err(|e| e.to_string())?;
        update_sync(conn, "groups", &id, &device_id, false);
        Ok(Group { id, user_id: group.user_id, vault_id: group.vault_id, parent_id: group.parent_id, name: group.name, sort_order, created_at: now.clone(), updated_at: now })
    })
}

#[tauri::command]
pub fn list_groups(user_id: String, vault_id: Option<String>) -> Result<Vec<Group>, String> {
    with_conn(|conn| {
        if let Some(ref vid) = vault_id {
            let mut stmt = conn.prepare("SELECT id, user_id, vault_id, parent_id, name, sort_order, created_at, updated_at FROM groups WHERE user_id = ?1 AND vault_id = ?2 ORDER BY sort_order, name").map_err(|e| e.to_string())?;
            let rows = stmt.query_map(params![user_id, vid], |row| {
                Ok(Group { id: row.get(0)?, user_id: row.get(1)?, vault_id: row.get(2)?, parent_id: row.get(3)?, name: row.get(4)?, sort_order: row.get(5)?, created_at: row.get(6)?, updated_at: row.get(7)? })
            }).map_err(|e| e.to_string())?;
            Ok(rows.filter_map(|r| r.ok()).collect())
        } else {
            let mut stmt = conn.prepare("SELECT id, user_id, vault_id, parent_id, name, sort_order, created_at, updated_at FROM groups WHERE user_id = ?1 ORDER BY sort_order, name").map_err(|e| e.to_string())?;
            let rows = stmt.query_map(params![user_id], |row| {
                Ok(Group { id: row.get(0)?, user_id: row.get(1)?, vault_id: row.get(2)?, parent_id: row.get(3)?, name: row.get(4)?, sort_order: row.get(5)?, created_at: row.get(6)?, updated_at: row.get(7)? })
            }).map_err(|e| e.to_string())?;
            Ok(rows.filter_map(|r| r.ok()).collect())
        }
    })
}

#[tauri::command]
pub fn update_group(id: String, group: GroupData, device_id: String) -> Result<Group, String> {
    with_conn(|conn| {
        let now = now();
        let sort_order = group.sort_order.unwrap_or(0);
        conn.execute(
            "UPDATE groups SET user_id=?2, vault_id=?3, parent_id=?4, name=?5, sort_order=?6, updated_at=?7 WHERE id=?1",
            params![id, group.user_id, group.vault_id, group.parent_id, group.name, sort_order, now],
        ).map_err(|e| e.to_string())?;
        update_sync(conn, "groups", &id, &device_id, false);
        conn.query_row("SELECT id, user_id, vault_id, parent_id, name, sort_order, created_at, updated_at FROM groups WHERE id = ?1", params![id], |row| {
            Ok(Group { id: row.get(0)?, user_id: row.get(1)?, vault_id: row.get(2)?, parent_id: row.get(3)?, name: row.get(4)?, sort_order: row.get(5)?, created_at: row.get(6)?, updated_at: row.get(7)? })
        }).map_err(|e| e.to_string())
    })
}

#[tauri::command]
pub fn delete_group(id: String, device_id: String) -> Result<(), String> {
    with_conn(|conn| {
        let now = now();
        // Unlink child groups
        let mut stmt = conn.prepare("SELECT id FROM groups WHERE parent_id = ?1").map_err(|e| e.to_string())?;
        let child_ids: Vec<String> = stmt.query_map(params![id], |row| row.get(0))
            .map_err(|e| e.to_string())?
            .filter_map(|r| r.ok())
            .collect();
        for child_id in &child_ids {
            conn.execute(
                "UPDATE groups SET parent_id = NULL, updated_at = ?1 WHERE id = ?2",
                params![now, child_id],
            ).map_err(|e| e.to_string())?;
            update_sync(conn, "groups", child_id, &device_id, false);
        }

        // Unlink hosts in this group
        let mut stmt = conn.prepare("SELECT id FROM hosts WHERE group_id = ?1").map_err(|e| e.to_string())?;
        let host_ids: Vec<String> = stmt.query_map(params![id], |row| row.get(0))
            .map_err(|e| e.to_string())?
            .filter_map(|r| r.ok())
            .collect();
        for host_id in &host_ids {
            conn.execute(
                "UPDATE hosts SET group_id = NULL, updated_at = ?1 WHERE id = ?2",
                params![now, host_id],
            ).map_err(|e| e.to_string())?;
            update_sync(conn, "hosts", host_id, &device_id, false);
        }

        // Delete the group itself
        conn.execute("DELETE FROM groups WHERE id = ?1", params![id]).map_err(|e| e.to_string())?;
        update_sync(conn, "groups", &id, &device_id, true);
        Ok(())
    })
}

// ── Vaults ──

#[tauri::command]
pub fn create_vault(vault: VaultData, device_id: String) -> Result<Vault, String> {
    with_conn(|conn| {
        let id = new_id();
        let now = now();
        let is_default = vault.is_default.unwrap_or(false) as i32;
        conn.execute(
            "INSERT INTO vaults (id, user_id, name, description, is_default, is_system, encrypted_data, created_at, updated_at) VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9)",
            params![id, vault.user_id, vault.name, vault.description, is_default, vault.is_system.unwrap_or(false) as i32, vault.encrypted_data, now, now],
        ).map_err(|e| e.to_string())?;
        update_sync(conn, "vaults", &id, &device_id, false);
        Ok(Vault { id, user_id: vault.user_id, name: vault.name, description: vault.description, is_default: is_default != 0, is_system: vault.is_system.unwrap_or(false), encrypted_data: vault.encrypted_data, created_at: now.clone(), updated_at: now })
    })
}

#[tauri::command]
pub fn create_default_vaults(user_id: String) -> Result<(), String> {
    with_conn(|conn| {
        let now = now();
        let personal_id = new_id();
        let team_id = new_id();
        conn.execute(
            "INSERT OR IGNORE INTO vaults (id, user_id, name, is_default, is_system, created_at, updated_at) VALUES (?1,?2,'Personal',1,1,?3,?3)",
            params![personal_id, user_id, now],
        ).map_err(|e| e.to_string())?;
        conn.execute(
            "INSERT OR IGNORE INTO vaults (id, user_id, name, is_default, is_system, created_at, updated_at) VALUES (?1,?2,'Team',1,1,?3,?3)",
            params![team_id, user_id, now],
        ).map_err(|e| e.to_string())?;
        Ok(())
    })
}

#[tauri::command]
pub fn list_vaults(user_id: String) -> Result<Vec<Vault>, String> {
    with_conn(|conn| {
        let mut stmt = conn.prepare("SELECT id, user_id, name, description, is_default, is_system, encrypted_data, created_at, updated_at FROM vaults WHERE user_id = ?1 ORDER BY is_default DESC, name").map_err(|e| e.to_string())?;
        let rows = stmt.query_map(params![user_id], |row| {
            Ok(Vault { id: row.get(0)?, user_id: row.get(1)?, name: row.get(2)?, description: row.get(3)?, is_default: row.get::<_, i32>(4)? != 0, is_system: row.get::<_, i32>(5)? != 0, encrypted_data: row.get(6)?, created_at: row.get(7)?, updated_at: row.get(8)? })
        }).map_err(|e| e.to_string())?;
        Ok(rows.filter_map(|r| r.ok()).collect())
    })
}

#[tauri::command]
pub fn update_vault(id: String, vault: VaultData, device_id: String) -> Result<Vault, String> {
    with_conn(|conn| {
        let existing: Vault = conn.query_row("SELECT id, user_id, name, description, is_default, is_system, encrypted_data, created_at, updated_at FROM vaults WHERE id = ?1", params![id], |row| {
            Ok(Vault { id: row.get(0)?, user_id: row.get(1)?, name: row.get(2)?, description: row.get(3)?, is_default: row.get::<_, i32>(4)? != 0, is_system: row.get::<_, i32>(5)? != 0, encrypted_data: row.get(6)?, created_at: row.get(7)?, updated_at: row.get(8)? })
        }).map_err(|e| e.to_string())?;
        if existing.is_system {
            return Err("Cannot edit system vault".to_string());
        }
        let now = now();
        conn.execute(
            "UPDATE vaults SET user_id=?2, name=?3, description=?4, encrypted_data=?5, updated_at=?6 WHERE id=?1",
            params![id, vault.user_id, vault.name, vault.description, vault.encrypted_data, now],
        ).map_err(|e| e.to_string())?;
        update_sync(conn, "vaults", &id, &device_id, false);
        conn.query_row("SELECT id, user_id, name, description, is_default, is_system, encrypted_data, created_at, updated_at FROM vaults WHERE id = ?1", params![id], |row| {
            Ok(Vault { id: row.get(0)?, user_id: row.get(1)?, name: row.get(2)?, description: row.get(3)?, is_default: row.get::<_, i32>(4)? != 0, is_system: row.get::<_, i32>(5)? != 0, encrypted_data: row.get(6)?, created_at: row.get(7)?, updated_at: row.get(8)? })
        }).map_err(|e| e.to_string())
    })
}

#[tauri::command]
pub fn delete_vault(id: String, device_id: String) -> Result<(), String> {
    with_conn(|conn| {
        let is_system: i32 = conn.query_row("SELECT is_system FROM vaults WHERE id = ?1", params![id], |row| row.get(0)).map_err(|e| e.to_string())?;
        if is_system != 0 {
            return Err("Cannot delete system vault".to_string());
        }
        conn.execute("DELETE FROM vaults WHERE id = ?1", params![id]).map_err(|e| e.to_string())?;
        update_sync(conn, "vaults", &id, &device_id, true);
        Ok(())
    })
}

#[tauri::command]
pub fn get_vault_data(id: String) -> Result<Vault, String> {
    with_conn(|conn| {
        conn.query_row("SELECT id, user_id, name, description, is_default, is_system, encrypted_data, created_at, updated_at FROM vaults WHERE id = ?1", params![id], |row| {
            Ok(Vault { id: row.get(0)?, user_id: row.get(1)?, name: row.get(2)?, description: row.get(3)?, is_default: row.get::<_, i32>(4)? != 0, is_system: row.get::<_, i32>(5)? != 0, encrypted_data: row.get(6)?, created_at: row.get(7)?, updated_at: row.get(8)? })
        }).map_err(|e| e.to_string())
    })
}

// ── Keychain ──

#[tauri::command]
pub fn create_key(key: KeyData, device_id: String) -> Result<Key, String> {
    with_conn(|conn| {
        let id = new_id();
        let now = now();
        let enc_pk = key.encrypted_private_key.as_deref().map(|k| maybe_encrypt(k)).transpose()?;
        conn.execute(
            "INSERT INTO keychain (id, user_id, vault_id, name, description, key_type, public_key, encrypted_private_key, fingerprint, created_at, updated_at) VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11)",
            params![id, key.user_id, key.vault_id, key.name, key.description, key.key_type, key.public_key, enc_pk, key.fingerprint, now, now],
        ).map_err(|e| e.to_string())?;
        update_sync(conn, "keychain", &id, &device_id, false);
        Ok(Key { id, user_id: key.user_id, vault_id: key.vault_id, name: key.name, description: key.description, key_type: key.key_type, public_key: key.public_key, encrypted_private_key: key.encrypted_private_key, fingerprint: key.fingerprint, created_at: now.clone(), updated_at: now })
    })
}

#[tauri::command]
pub fn list_keys(user_id: String, vault_id: Option<String>) -> Result<Vec<Key>, String> {
    with_conn(|conn| {
        let keys: Vec<Key> = if let Some(ref vid) = vault_id {
            let mut stmt = conn.prepare("SELECT id, user_id, vault_id, name, description, key_type, public_key, encrypted_private_key, fingerprint, created_at, updated_at FROM keychain WHERE user_id = ?1 AND vault_id = ?2 ORDER BY name").map_err(|e| e.to_string())?;
            let rows = stmt.query_map(params![user_id, vid], |row| {
                Ok(Key { id: row.get(0)?, user_id: row.get(1)?, vault_id: row.get(2)?, name: row.get(3)?, description: row.get(4)?, key_type: row.get(5)?, public_key: row.get(6)?, encrypted_private_key: row.get(7)?, fingerprint: row.get(8)?, created_at: row.get(9)?, updated_at: row.get(10)? })
            }).map_err(|e| e.to_string())?;
            rows.filter_map(|r| r.ok()).collect()
        } else {
            let mut stmt = conn.prepare("SELECT id, user_id, vault_id, name, description, key_type, public_key, encrypted_private_key, fingerprint, created_at, updated_at FROM keychain WHERE user_id = ?1 ORDER BY name").map_err(|e| e.to_string())?;
            let rows = stmt.query_map(params![user_id], |row| {
                Ok(Key { id: row.get(0)?, user_id: row.get(1)?, vault_id: row.get(2)?, name: row.get(3)?, description: row.get(4)?, key_type: row.get(5)?, public_key: row.get(6)?, encrypted_private_key: row.get(7)?, fingerprint: row.get(8)?, created_at: row.get(9)?, updated_at: row.get(10)? })
            }).map_err(|e| e.to_string())?;
            rows.filter_map(|r| r.ok()).collect()
        };
        keys.into_iter().map(|k| {
            Ok(Key {
                encrypted_private_key: k.encrypted_private_key.as_deref().map(|v| maybe_decrypt(v)).transpose()?,
                ..k
            })
        }).collect()
    })
}

#[tauri::command]
pub fn get_key(id: String) -> Result<Key, String> {
    with_conn(|conn| {
        let k = conn.query_row("SELECT id, user_id, vault_id, name, description, key_type, public_key, encrypted_private_key, fingerprint, created_at, updated_at FROM keychain WHERE id = ?1", params![id], |row| {
            Ok(Key { id: row.get(0)?, user_id: row.get(1)?, vault_id: row.get(2)?, name: row.get(3)?, description: row.get(4)?, key_type: row.get(5)?, public_key: row.get(6)?, encrypted_private_key: row.get(7)?, fingerprint: row.get(8)?, created_at: row.get(9)?, updated_at: row.get(10)? })
        }).map_err(|e| e.to_string())?;
        Ok(Key {
            encrypted_private_key: k.encrypted_private_key.as_deref().map(|v| maybe_decrypt(v)).transpose()?,
            ..k
        })
    })
}

#[tauri::command]
pub fn delete_key(id: String, device_id: String) -> Result<(), String> {
    with_conn(|conn| {
        conn.execute("DELETE FROM keychain WHERE id = ?1", params![id]).map_err(|e| e.to_string())?;
        update_sync(conn, "keychain", &id, &device_id, true);
        Ok(())
    })
}

// ── Snippets ──

#[tauri::command]
pub fn create_snippet(snippet: SnippetData, device_id: String) -> Result<Snippet, String> {
    with_conn(|conn| {
        let id = new_id();
        let now = now();
        let tags = snippet.tags.unwrap_or_else(|| "[]".to_string());
        conn.execute(
            "INSERT INTO snippets (id, user_id, vault_id, name, command, description, tags, created_at, updated_at) VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9)",
            params![id, snippet.user_id, snippet.vault_id, snippet.name, snippet.command, snippet.description, tags, now, now],
        ).map_err(|e| e.to_string())?;
        update_sync(conn, "snippets", &id, &device_id, false);
        Ok(Snippet { id, user_id: snippet.user_id, vault_id: snippet.vault_id, name: snippet.name, command: snippet.command, description: snippet.description, tags, created_at: now.clone(), updated_at: now })
    })
}

#[tauri::command]
pub fn list_snippets(user_id: String, vault_id: Option<String>) -> Result<Vec<Snippet>, String> {
    with_conn(|conn| {
        if let Some(ref vid) = vault_id {
            let mut stmt = conn.prepare("SELECT id, user_id, vault_id, name, command, description, tags, created_at, updated_at FROM snippets WHERE user_id = ?1 AND vault_id = ?2 ORDER BY name").map_err(|e| e.to_string())?;
            let rows = stmt.query_map(params![user_id, vid], |row| {
                Ok(Snippet { id: row.get(0)?, user_id: row.get(1)?, vault_id: row.get(2)?, name: row.get(3)?, command: row.get(4)?, description: row.get(5)?, tags: row.get(6)?, created_at: row.get(7)?, updated_at: row.get(8)? })
            }).map_err(|e| e.to_string())?;
            Ok(rows.filter_map(|r| r.ok()).collect())
        } else {
            let mut stmt = conn.prepare("SELECT id, user_id, vault_id, name, command, description, tags, created_at, updated_at FROM snippets WHERE user_id = ?1 ORDER BY name").map_err(|e| e.to_string())?;
            let rows = stmt.query_map(params![user_id], |row| {
                Ok(Snippet { id: row.get(0)?, user_id: row.get(1)?, vault_id: row.get(2)?, name: row.get(3)?, command: row.get(4)?, description: row.get(5)?, tags: row.get(6)?, created_at: row.get(7)?, updated_at: row.get(8)? })
            }).map_err(|e| e.to_string())?;
            Ok(rows.filter_map(|r| r.ok()).collect())
        }
    })
}

#[tauri::command]
pub fn update_snippet(id: String, snippet: SnippetData, device_id: String) -> Result<Snippet, String> {
    with_conn(|conn| {
        let now = now();
        let tags = snippet.tags.unwrap_or_else(|| "[]".to_string());
        conn.execute(
            "UPDATE snippets SET user_id=?2, vault_id=?3, name=?4, command=?5, description=?6, tags=?7, updated_at=?8 WHERE id=?1",
            params![id, snippet.user_id, snippet.vault_id, snippet.name, snippet.command, snippet.description, tags, now],
        ).map_err(|e| e.to_string())?;
        update_sync(conn, "snippets", &id, &device_id, false);
        conn.query_row("SELECT id, user_id, vault_id, name, command, description, tags, created_at, updated_at FROM snippets WHERE id = ?1", params![id], |row| {
            Ok(Snippet { id: row.get(0)?, user_id: row.get(1)?, vault_id: row.get(2)?, name: row.get(3)?, command: row.get(4)?, description: row.get(5)?, tags: row.get(6)?, created_at: row.get(7)?, updated_at: row.get(8)? })
        }).map_err(|e| e.to_string())
    })
}

#[tauri::command]
pub fn delete_snippet(id: String, device_id: String) -> Result<(), String> {
    with_conn(|conn| {
        conn.execute("DELETE FROM snippets WHERE id = ?1", params![id]).map_err(|e| e.to_string())?;
        update_sync(conn, "snippets", &id, &device_id, true);
        Ok(())
    })
}

#[tauri::command]
pub fn search_snippets(query: String) -> Result<Vec<Snippet>, String> {
    with_conn(|conn| {
        let pattern = format!("%{}%", query);
        let mut stmt = conn.prepare("SELECT id, user_id, vault_id, name, command, description, tags, created_at, updated_at FROM snippets WHERE name LIKE ?1 OR command LIKE ?1 OR description LIKE ?1 ORDER BY name").map_err(|e| e.to_string())?;
        let rows = stmt.query_map(params![pattern], |row| {
            Ok(Snippet { id: row.get(0)?, user_id: row.get(1)?, vault_id: row.get(2)?, name: row.get(3)?, command: row.get(4)?, description: row.get(5)?, tags: row.get(6)?, created_at: row.get(7)?, updated_at: row.get(8)? })
        }).map_err(|e| e.to_string())?;
        Ok(rows.filter_map(|r| r.ok()).collect())
    })
}

// ── Workspaces ──

#[tauri::command]
pub fn create_workspace(ws: WorkspaceData, device_id: String) -> Result<Workspace, String> {
    with_conn(|conn| {
        let id = new_id();
        let now = now();
        let host_ids = ws.host_ids.unwrap_or_else(|| "[]".to_string());
        conn.execute(
            "INSERT INTO workspaces (id, user_id, vault_id, name, layout, host_ids, created_at, updated_at) VALUES (?1,?2,?3,?4,?5,?6,?7,?8)",
            params![id, ws.user_id, ws.vault_id, ws.name, ws.layout, host_ids, now, now],
        ).map_err(|e| e.to_string())?;
        update_sync(conn, "workspaces", &id, &device_id, false);
        Ok(Workspace { id, user_id: ws.user_id, vault_id: ws.vault_id, name: ws.name, layout: ws.layout, host_ids, created_at: now.clone(), updated_at: now })
    })
}

#[tauri::command]
pub fn list_workspaces(user_id: String, vault_id: Option<String>) -> Result<Vec<Workspace>, String> {
    with_conn(|conn| {
        if let Some(ref vid) = vault_id {
            let mut stmt = conn.prepare("SELECT id, user_id, vault_id, name, layout, host_ids, created_at, updated_at FROM workspaces WHERE user_id = ?1 AND vault_id = ?2 ORDER BY name").map_err(|e| e.to_string())?;
            let rows = stmt.query_map(params![user_id, vid], |row| {
                Ok(Workspace { id: row.get(0)?, user_id: row.get(1)?, vault_id: row.get(2)?, name: row.get(3)?, layout: row.get(4)?, host_ids: row.get(5)?, created_at: row.get(6)?, updated_at: row.get(7)? })
            }).map_err(|e| e.to_string())?;
            Ok(rows.filter_map(|r| r.ok()).collect())
        } else {
            let mut stmt = conn.prepare("SELECT id, user_id, vault_id, name, layout, host_ids, created_at, updated_at FROM workspaces WHERE user_id = ?1 ORDER BY name").map_err(|e| e.to_string())?;
            let rows = stmt.query_map(params![user_id], |row| {
                Ok(Workspace { id: row.get(0)?, user_id: row.get(1)?, vault_id: row.get(2)?, name: row.get(3)?, layout: row.get(4)?, host_ids: row.get(5)?, created_at: row.get(6)?, updated_at: row.get(7)? })
            }).map_err(|e| e.to_string())?;
            Ok(rows.filter_map(|r| r.ok()).collect())
        }
    })
}

#[tauri::command]
pub fn update_workspace(id: String, ws: WorkspaceData, device_id: String) -> Result<Workspace, String> {
    with_conn(|conn| {
        let now = now();
        let host_ids = ws.host_ids.unwrap_or_else(|| "[]".to_string());
        conn.execute(
            "UPDATE workspaces SET user_id=?2, vault_id=?3, name=?4, layout=?5, host_ids=?6, updated_at=?7 WHERE id=?1",
            params![id, ws.user_id, ws.vault_id, ws.name, ws.layout, host_ids, now],
        ).map_err(|e| e.to_string())?;
        update_sync(conn, "workspaces", &id, &device_id, false);
        conn.query_row("SELECT id, user_id, vault_id, name, layout, host_ids, created_at, updated_at FROM workspaces WHERE id = ?1", params![id], |row| {
            Ok(Workspace { id: row.get(0)?, user_id: row.get(1)?, vault_id: row.get(2)?, name: row.get(3)?, layout: row.get(4)?, host_ids: row.get(5)?, created_at: row.get(6)?, updated_at: row.get(7)? })
        }).map_err(|e| e.to_string())
    })
}

#[tauri::command]
pub fn delete_workspace(id: String, device_id: String) -> Result<(), String> {
    with_conn(|conn| {
        conn.execute("DELETE FROM workspaces WHERE id = ?1", params![id]).map_err(|e| e.to_string())?;
        update_sync(conn, "workspaces", &id, &device_id, true);
        Ok(())
    })
}

// ── Tab Groups ──

#[tauri::command]
pub fn create_tab_group(tg: TabGroupData, device_id: String) -> Result<TabGroup, String> {
    with_conn(|conn| {
        let id = new_id();
        let now = now();
        conn.execute(
            "INSERT INTO tab_groups (id, user_id, vault_id, name, layout, created_at, updated_at) VALUES (?1,?2,?3,?4,?5,?6,?7)",
            params![id, tg.user_id, tg.vault_id, tg.name, tg.layout, now, now],
        ).map_err(|e| e.to_string())?;
        update_sync(conn, "tab_groups", &id, &device_id, false);
        Ok(TabGroup { id, user_id: tg.user_id, vault_id: tg.vault_id, name: tg.name, layout: tg.layout, created_at: now.clone(), updated_at: now })
    })
}

#[tauri::command]
pub fn list_tab_groups(user_id: String, vault_id: Option<String>) -> Result<Vec<TabGroup>, String> {
    with_conn(|conn| {
        if let Some(ref vid) = vault_id {
            let mut stmt = conn.prepare("SELECT id, user_id, vault_id, name, layout, created_at, updated_at FROM tab_groups WHERE user_id = ?1 AND vault_id = ?2 ORDER BY name").map_err(|e| e.to_string())?;
            let rows = stmt.query_map(params![user_id, vid], |row| {
                Ok(TabGroup { id: row.get(0)?, user_id: row.get(1)?, vault_id: row.get(2)?, name: row.get(3)?, layout: row.get(4)?, created_at: row.get(5)?, updated_at: row.get(6)? })
            }).map_err(|e| e.to_string())?;
            Ok(rows.filter_map(|r| r.ok()).collect())
        } else {
            let mut stmt = conn.prepare("SELECT id, user_id, vault_id, name, layout, created_at, updated_at FROM tab_groups WHERE user_id = ?1 ORDER BY name").map_err(|e| e.to_string())?;
            let rows = stmt.query_map(params![user_id], |row| {
                Ok(TabGroup { id: row.get(0)?, user_id: row.get(1)?, vault_id: row.get(2)?, name: row.get(3)?, layout: row.get(4)?, created_at: row.get(5)?, updated_at: row.get(6)? })
            }).map_err(|e| e.to_string())?;
            Ok(rows.filter_map(|r| r.ok()).collect())
        }
    })
}

#[tauri::command]
pub fn update_tab_group(id: String, tg: TabGroupData, device_id: String) -> Result<TabGroup, String> {
    with_conn(|conn| {
        let now = now();
        conn.execute(
            "UPDATE tab_groups SET user_id=?2, vault_id=?3, name=?4, layout=?5, updated_at=?6 WHERE id=?1",
            params![id, tg.user_id, tg.vault_id, tg.name, tg.layout, now],
        ).map_err(|e| e.to_string())?;
        update_sync(conn, "tab_groups", &id, &device_id, false);
        conn.query_row("SELECT id, user_id, vault_id, name, layout, created_at, updated_at FROM tab_groups WHERE id = ?1", params![id], |row| {
            Ok(TabGroup { id: row.get(0)?, user_id: row.get(1)?, vault_id: row.get(2)?, name: row.get(3)?, layout: row.get(4)?, created_at: row.get(5)?, updated_at: row.get(6)? })
        }).map_err(|e| e.to_string())
    })
}

#[tauri::command]
pub fn delete_tab_group(id: String, device_id: String) -> Result<(), String> {
    with_conn(|conn| {
        conn.execute("DELETE FROM tab_groups WHERE id = ?1", params![id]).map_err(|e| e.to_string())?;
        update_sync(conn, "tab_groups", &id, &device_id, true);
        Ok(())
    })
}

// ── Settings ──

#[tauri::command]
pub fn get_settings(user_id: String) -> Result<Settings, String> {
    with_conn(|conn| {
        let result = conn.query_row(
            "SELECT id, user_id, theme, font_family, font_size, cursor_style, keybindings, created_at, updated_at FROM settings WHERE user_id = ?1",
            params![user_id],
            |row| {
                Ok(Settings { id: row.get(0)?, user_id: row.get(1)?, theme: row.get(2)?, font_family: row.get(3)?, font_size: row.get(4)?, cursor_style: row.get(5)?, keybindings: row.get(6)?, created_at: row.get(7)?, updated_at: row.get(8)? })
            },
        );
        match result {
            Ok(s) => Ok(s),
            Err(rusqlite::Error::QueryReturnedNoRows) => {
                let id = new_id();
                let now = now();
                conn.execute(
                    "INSERT INTO settings (id, user_id, theme, font_family, font_size, cursor_style, keybindings, created_at, updated_at) VALUES (?1,?2,'dark','JetBrains Mono',14,'block','{}',?3,?3)",
                    params![id, user_id, now],
                ).map_err(|e| e.to_string())?;
                Ok(Settings { id, user_id, theme: "dark".into(), font_family: "JetBrains Mono".into(), font_size: 14, cursor_style: "block".into(), keybindings: "{}".into(), created_at: now.clone(), updated_at: now })
            }
            Err(e) => Err(e.to_string()),
        }
    })
}

#[tauri::command]
pub fn update_settings(user_id: String, settings: SettingsData, device_id: String) -> Result<Settings, String> {
    with_conn(|conn| {
        let now = now();
        let existing = get_settings(user_id.clone())?;
        let theme = settings.theme.unwrap_or(existing.theme);
        let font_family = settings.font_family.unwrap_or(existing.font_family);
        let font_size = settings.font_size.unwrap_or(existing.font_size);
        let cursor_style = settings.cursor_style.unwrap_or(existing.cursor_style);
        let keybindings = settings.keybindings.unwrap_or(existing.keybindings);
        conn.execute(
            "UPDATE settings SET theme=?2, font_family=?3, font_size=?4, cursor_style=?5, keybindings=?6, updated_at=?7 WHERE id=?1",
            params![existing.id, theme, font_family, font_size, cursor_style, keybindings, now],
        ).map_err(|e| e.to_string())?;
        update_sync(conn, "settings", &existing.id, &device_id, false);
        Ok(Settings { id: existing.id, user_id, theme, font_family, font_size, cursor_style, keybindings, created_at: existing.created_at, updated_at: now })
    })
}

// ── Session Logs ──

#[tauri::command]
pub fn create_session_log(log: SessionLogData, device_id: String) -> Result<SessionLog, String> {
    with_conn(|conn| {
        let id = new_id();
        let created_at = now();
        let size_bytes = log.size_bytes.unwrap_or(0);
        conn.execute(
            "INSERT INTO session_logs (id, user_id, host_id, started_at, data, size_bytes, created_at) VALUES (?1,?2,?3,?4,?5,?6,?7)",
            params![id, log.user_id, log.host_id, log.started_at, log.data, size_bytes, created_at],
        ).map_err(|e| e.to_string())?;
        update_sync(conn, "session_logs", &id, &device_id, false);
        Ok(SessionLog { id, user_id: log.user_id, host_id: log.host_id, started_at: log.started_at, ended_at: None, data: log.data, size_bytes, created_at })
    })
}

#[tauri::command]
pub fn list_session_logs(user_id: String) -> Result<Vec<SessionLog>, String> {
    with_conn(|conn| {
        let mut stmt = conn.prepare("SELECT id, user_id, host_id, started_at, ended_at, data, size_bytes, created_at FROM session_logs WHERE user_id = ?1 ORDER BY started_at DESC").map_err(|e| e.to_string())?;
        let rows = stmt.query_map(params![user_id], |row| {
            Ok(SessionLog { id: row.get(0)?, user_id: row.get(1)?, host_id: row.get(2)?, started_at: row.get(3)?, ended_at: row.get(4)?, data: row.get(5)?, size_bytes: row.get(6)?, created_at: row.get(7)? })
        }).map_err(|e| e.to_string())?;
        Ok(rows.filter_map(|r| r.ok()).collect())
    })
}

#[tauri::command]
pub fn get_session_log(id: String) -> Result<SessionLog, String> {
    with_conn(|conn| {
        conn.query_row("SELECT id, user_id, host_id, started_at, ended_at, data, size_bytes, created_at FROM session_logs WHERE id = ?1", params![id], |row| {
            Ok(SessionLog { id: row.get(0)?, user_id: row.get(1)?, host_id: row.get(2)?, started_at: row.get(3)?, ended_at: row.get(4)?, data: row.get(5)?, size_bytes: row.get(6)?, created_at: row.get(7)? })
        }).map_err(|e| e.to_string())
    })
}

#[tauri::command]
pub fn delete_session_log(id: String, device_id: String) -> Result<(), String> {
    with_conn(|conn| {
        conn.execute("DELETE FROM session_logs WHERE id = ?1", params![id]).map_err(|e| e.to_string())?;
        update_sync(conn, "session_logs", &id, &device_id, true);
        Ok(())
    })
}

#[tauri::command]
pub fn end_session_log(id: String) -> Result<(), String> {
    with_conn(|conn| {
        let now = now();
        conn.execute("UPDATE session_logs SET ended_at = ?1 WHERE id = ?2", params![now, id]).map_err(|e| e.to_string())?;
        Ok(())
    })
}

// ── Command Logs ──

#[tauri::command]
pub fn log_command(log: CommandLogData) -> Result<CommandLog, String> {
    with_conn(|conn| {
        let id = new_id();
        let duration_ms = log.duration_ms.unwrap_or(0);
        conn.execute(
            "INSERT INTO command_logs (id, session_id, command, output, exit_code, executed_at, duration_ms) VALUES (?1,?2,?3,?4,?5,?6,?7)",
            params![id, log.session_id, log.command, log.output, log.exit_code, log.executed_at, duration_ms],
        ).map_err(|e| e.to_string())?;
        Ok(CommandLog { id, session_id: log.session_id, command: log.command, output: log.output, exit_code: log.exit_code, executed_at: log.executed_at, duration_ms })
    })
}

#[tauri::command]
pub fn list_command_logs(session_id: String) -> Result<Vec<CommandLog>, String> {
    with_conn(|conn| {
        let mut stmt = conn.prepare("SELECT id, session_id, command, output, exit_code, executed_at, duration_ms FROM command_logs WHERE session_id = ?1 ORDER BY executed_at").map_err(|e| e.to_string())?;
        let rows = stmt.query_map(params![session_id], |row| {
            Ok(CommandLog { id: row.get(0)?, session_id: row.get(1)?, command: row.get(2)?, output: row.get(3)?, exit_code: row.get(4)?, executed_at: row.get(5)?, duration_ms: row.get(6)? })
        }).map_err(|e| e.to_string())?;
        Ok(rows.filter_map(|r| r.ok()).collect())
    })
}
