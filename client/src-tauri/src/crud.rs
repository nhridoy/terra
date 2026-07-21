use crate::db;
use chrono::Utc;
use serde_json::{json, Value};
use uuid::Uuid;

// ---- Helpers ----

fn now() -> String {
    Utc::now().to_rfc3339()
}

fn new_id() -> String {
    Uuid::new_v4().to_string()
}

fn get_str(obj: &serde_json::Map<String, Value>, key: &str) -> String {
    obj.get(key)
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .to_string()
}

fn get_str_or(obj: &serde_json::Map<String, Value>, key: &str, default: &str) -> String {
    obj.get(key)
        .and_then(|v| v.as_str())
        .filter(|s| !s.is_empty())
        .unwrap_or(default)
        .to_string()
}

fn get_int(obj: &serde_json::Map<String, Value>, key: &str) -> i64 {
    obj.get(key).and_then(|v| v.as_i64()).unwrap_or(0)
}

const MAX_PASSWORD_LENGTH: usize = 4096;
const MAX_PRIVATE_KEY_LENGTH: usize = 65536;
const MAX_PASSPHRASE_LENGTH: usize = 4096;

fn validate_credential_lengths(
    password: &str,
    private_key: &str,
    passphrase: &str,
) -> Result<(), String> {
    if password.len() > MAX_PASSWORD_LENGTH {
        return Err(format!("Password must be under {} characters", MAX_PASSWORD_LENGTH));
    }
    if private_key.len() > MAX_PRIVATE_KEY_LENGTH {
        return Err(format!("Private key must be under {} characters", MAX_PRIVATE_KEY_LENGTH));
    }
    if passphrase.len() > MAX_PASSPHRASE_LENGTH {
        return Err(format!("Passphrase must be under {} characters", MAX_PASSPHRASE_LENGTH));
    }
    Ok(())
}

fn obj_to_host(obj: &serde_json::Map<String, Value>) -> Value {
    let tags = obj
        .get("tags")
        .and_then(|v| v.as_str())
        .and_then(|s| serde_json::from_str::<Value>(s).ok())
        .unwrap_or_else(|| json!([]));

    json!({
        "id": obj.get("id").and_then(|v| v.as_str()).unwrap_or(""),
        "name": obj.get("name").and_then(|v| v.as_str()).unwrap_or(""),
        "address": obj.get("address").and_then(|v| v.as_str()).unwrap_or(""),
        "port": obj.get("port").and_then(|v| v.as_i64()).unwrap_or(22),
        "username": obj.get("username").and_then(|v| v.as_str()).unwrap_or(""),
        "groupId": obj.get("group_id").and_then(|v| v.as_str()).unwrap_or(""),
        "tags": tags,
        "color": obj.get("color").and_then(|v| v.as_str()).unwrap_or(""),
        "icon": obj.get("icon").and_then(|v| v.as_str()).unwrap_or(""),
        "sortOrder": obj.get("sort_order").and_then(|v| v.as_i64()).unwrap_or(0),
        "authType": obj.get("auth_type").and_then(|v| v.as_str()).unwrap_or("password"),
        "keyId": obj.get("key_id").and_then(|v| v.as_str()).unwrap_or(""),
        "createdAt": obj.get("created_at").and_then(|v| v.as_str()).unwrap_or(""),
        "updatedAt": obj.get("updated_at").and_then(|v| v.as_str()).unwrap_or(""),
    })
}

fn obj_to_group(obj: &serde_json::Map<String, Value>) -> Value {
    json!({
        "id": obj.get("id").and_then(|v| v.as_str()).unwrap_or(""),
        "name": obj.get("name").and_then(|v| v.as_str()).unwrap_or(""),
        "parentId": obj.get("parent_id").and_then(|v| v.as_str()).unwrap_or(""),
        "vaultId": obj.get("vault_id").and_then(|v| v.as_str()).unwrap_or(""),
        "sortOrder": obj.get("sort_order").and_then(|v| v.as_i64()).unwrap_or(0),
        "createdAt": obj.get("created_at").and_then(|v| v.as_str()).unwrap_or(""),
    })
}

fn obj_to_vault(obj: &serde_json::Map<String, Value>) -> Value {
    json!({
        "id": obj.get("id").and_then(|v| v.as_str()).unwrap_or(""),
        "name": obj.get("name").and_then(|v| v.as_str()).unwrap_or(""),
        "description": obj.get("description").and_then(|v| v.as_str()).unwrap_or(""),
        "isDefault": obj.get("is_default").and_then(|v| v.as_bool()).unwrap_or(false),
        "isSystem": obj.get("is_system").and_then(|v| v.as_bool()).unwrap_or(false),
        "createdAt": obj.get("created_at").and_then(|v| v.as_str()).unwrap_or(""),
        "updatedAt": obj.get("updated_at").and_then(|v| v.as_str()).unwrap_or(""),
    })
}

fn obj_to_key(obj: &serde_json::Map<String, Value>) -> Value {
    json!({
        "id": obj.get("id").and_then(|v| v.as_str()).unwrap_or(""),
        "name": obj.get("name").and_then(|v| v.as_str()).unwrap_or(""),
        "description": obj.get("description").and_then(|v| v.as_str()).unwrap_or(""),
        "keyType": obj.get("key_type").and_then(|v| v.as_str()).unwrap_or("ed25519"),
        "publicKey": obj.get("public_key").and_then(|v| v.as_str()).unwrap_or(""),
        "encryptedPrivateKey": obj.get("encrypted_private_key").and_then(|v| v.as_str()).unwrap_or(""),
        "fingerprint": obj.get("fingerprint").and_then(|v| v.as_str()).unwrap_or(""),
        "createdAt": obj.get("created_at").and_then(|v| v.as_str()).unwrap_or(""),
    })
}

fn obj_to_snippet(obj: &serde_json::Map<String, Value>) -> Value {
    let tags = obj
        .get("tags")
        .and_then(|v| v.as_str())
        .and_then(|s| serde_json::from_str::<Value>(s).ok())
        .unwrap_or_else(|| json!([]));

    json!({
        "id": obj.get("id").and_then(|v| v.as_str()).unwrap_or(""),
        "name": obj.get("name").and_then(|v| v.as_str()).unwrap_or(""),
        "command": obj.get("command").and_then(|v| v.as_str()).unwrap_or(""),
        "description": obj.get("description").and_then(|v| v.as_str()).unwrap_or(""),
        "tags": tags,
        "vaultId": obj.get("vault_id").and_then(|v| v.as_str()).unwrap_or(""),
        "createdAt": obj.get("created_at").and_then(|v| v.as_str()).unwrap_or(""),
    })
}

fn obj_to_workspace(obj: &serde_json::Map<String, Value>) -> Value {
    json!({
        "id": obj.get("id").and_then(|v| v.as_str()).unwrap_or(""),
        "name": obj.get("name").and_then(|v| v.as_str()).unwrap_or(""),
        "layout": obj.get("layout").and_then(|v| v.as_str()).unwrap_or(""),
        "vaultId": obj.get("vault_id").and_then(|v| v.as_str()).unwrap_or(""),
        "hostIds": obj.get("host_ids").and_then(|v| v.as_str()).unwrap_or("[]"),
        "createdAt": obj.get("created_at").and_then(|v| v.as_str()).unwrap_or(""),
        "updatedAt": obj.get("updated_at").and_then(|v| v.as_str()).unwrap_or(""),
    })
}

fn obj_to_tab_group(obj: &serde_json::Map<String, Value>) -> Value {
    json!({
        "id": obj.get("id").and_then(|v| v.as_str()).unwrap_or(""),
        "name": obj.get("name").and_then(|v| v.as_str()).unwrap_or(""),
        "layout": obj.get("tabs").and_then(|v| v.as_str()).unwrap_or(""),
        "vaultId": obj.get("vault_id").and_then(|v| v.as_str()).unwrap_or(""),
        "createdAt": obj.get("created_at").and_then(|v| v.as_str()).unwrap_or(""),
    })
}

fn obj_to_settings(obj: &serde_json::Map<String, Value>) -> Value {
    json!({
        "id": obj.get("id").and_then(|v| v.as_str()).unwrap_or(""),
        "userId": obj.get("user_id").and_then(|v| v.as_str()).unwrap_or(""),
        "theme": obj.get("theme").and_then(|v| v.as_str()).unwrap_or("dark"),
        "fontFamily": obj.get("font_family").and_then(|v| v.as_str()).unwrap_or("JetBrains Mono"),
        "fontSize": obj.get("font_size").and_then(|v| v.as_i64()).unwrap_or(14),
        "cursorStyle": obj.get("cursor_style").and_then(|v| v.as_str()).unwrap_or("block"),
        "createdAt": obj.get("created_at").and_then(|v| v.as_str()).unwrap_or(""),
        "updatedAt": obj.get("updated_at").and_then(|v| v.as_str()).unwrap_or(""),
    })
}

// ---- Hosts ----

#[tauri::command]
pub fn list_hosts(user_id: String, vault_id: Option<String>) -> Result<Vec<Value>, String> {
    let all = db::fetch_filtered("hosts", &user_id, vault_id.as_deref())?;
    let result: Vec<Value> = all
        .into_iter()
        .filter_map(|r| r.as_object().map(obj_to_host))
        .collect();
    Ok(result)
}

#[tauri::command]
pub fn create_host(host: Value, _device_id: Option<String>) -> Result<Value, String> {
    let obj = host.as_object().ok_or("Invalid host data")?;
    let id = new_id();
    let ts = now();

    let password = get_str(obj, "password");
    let private_key = get_str(obj, "privateKey");
    let passphrase = get_str(obj, "passphrase");
    validate_credential_lengths(&password, &private_key, &passphrase)?;

    let record = json!({
        "id": id,
        "user_id": get_str(obj, "userId"),
        "vault_id": get_str(obj, "vaultId"),
        "group_id": get_str(obj, "groupId"),
        "name": get_str(obj, "name"),
        "address": get_str(obj, "address"),
        "port": get_int(obj, "port").max(22),
        "username": get_str(obj, "username"),
        "password": password,
        "private_key": private_key,
        "passphrase": passphrase,
        "color": get_str(obj, "color"),
        "tags": get_str(obj, "tags"),
        "icon": get_str(obj, "icon"),
        "sort_order": get_int(obj, "sortOrder"),
        "auth_type": get_str_or(obj, "authType", "password"),
        "key_id": get_str(obj, "keyId"),
        "synced": 0,
        "created_at": ts,
        "updated_at": ts,
    });

    db::upsert_records("hosts", &[record])?;

    let all = db::fetch_all("hosts")?;
    all.into_iter()
        .find(|r| r.get("id").and_then(|v| v.as_str()) == Some(&id))
        .and_then(|r| r.as_object().map(obj_to_host))
        .ok_or_else(|| "Failed to fetch created host".to_string())
}

#[tauri::command]
pub fn update_host(id: String, host: Value, _device_id: Option<String>) -> Result<Value, String> {
    let obj = host.as_object().ok_or("Invalid host data")?;
    let ts = now();

    // Read existing record to preserve credential fields when not provided
    let existing = db::fetch_all("hosts")?
        .into_iter()
        .find(|r| r.get("id").and_then(|v| v.as_str()) == Some(&id))
        .and_then(|r| r.as_object().cloned());

    let existing_get = |key: &str| -> String {
        existing
            .as_ref()
            .and_then(|e| e.get(key))
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .to_string()
    };

    // For credential fields, only overwrite if the new value is non-empty.
    // This prevents editing other fields (name, address, etc.) from wiping
    // stored encrypted passwords/keys.
    let password = get_str(obj, "password");
    let private_key = get_str(obj, "privateKey");
    let passphrase = get_str(obj, "passphrase");

    // Validate lengths of provided credential fields
    let final_password = if password.is_empty() { existing_get("password") } else { password };
    let final_private_key = if private_key.is_empty() { existing_get("private_key") } else { private_key };
    let final_passphrase = if passphrase.is_empty() { existing_get("passphrase") } else { passphrase };
    validate_credential_lengths(&final_password, &final_private_key, &final_passphrase)?;

    let record = json!({
        "id": id,
        "user_id": get_str(obj, "userId"),
        "vault_id": get_str(obj, "vaultId"),
        "group_id": get_str(obj, "groupId"),
        "name": get_str(obj, "name"),
        "address": get_str(obj, "address"),
        "port": get_int(obj, "port").max(22),
        "username": get_str(obj, "username"),
        "password": final_password,
        "private_key": final_private_key,
        "passphrase": final_passphrase,
        "color": get_str(obj, "color"),
        "tags": get_str(obj, "tags"),
        "icon": get_str(obj, "icon"),
        "sort_order": get_int(obj, "sortOrder"),
        "auth_type": get_str_or(obj, "authType", "password"),
        "key_id": get_str(obj, "keyId"),
        "synced": 0,
        "created_at": get_str_or(obj, "createdAt", &ts),
        "updated_at": ts,
    });

    db::upsert_records("hosts", &[record])?;

    let all = db::fetch_all("hosts")?;
    all.into_iter()
        .find(|r| r.get("id").and_then(|v| v.as_str()) == Some(&id))
        .and_then(|r| r.as_object().map(obj_to_host))
        .ok_or_else(|| "Failed to fetch updated host".to_string())
}

#[tauri::command]
pub fn delete_host(id: String, _device_id: Option<String>) -> Result<(), String> {
    db::delete_record("hosts", &id)
}

#[tauri::command]
pub fn get_host_credentials(host_id: String) -> Result<Value, String> {
    let all = db::fetch_all("hosts")?;
    let host = all
        .into_iter()
        .find(|r| r.get("id").and_then(|v| v.as_str()) == Some(&host_id))
        .ok_or_else(|| "Host not found".to_string())?;

    let obj = host.as_object().ok_or("Invalid host record")?;
    Ok(json!({
        "password": obj.get("password").and_then(|v| v.as_str()).unwrap_or(""),
        "privateKey": obj.get("private_key").and_then(|v| v.as_str()).unwrap_or(""),
        "passphrase": obj.get("passphrase").and_then(|v| v.as_str()).unwrap_or(""),
    }))
}

#[tauri::command]
pub fn get_all_hosts_with_credentials(user_id: String) -> Result<Vec<Value>, String> {
    let all = db::fetch_filtered("hosts", &user_id, None)?;
    let result: Vec<Value> = all
        .into_iter()
        .filter_map(|r| {
            let obj = r.as_object()?;
            let tags = obj
                .get("tags")
                .and_then(|v| v.as_str())
                .and_then(|s| serde_json::from_str::<Value>(s).ok())
                .unwrap_or_else(|| json!([]));
            Some(json!({
                "id": obj.get("id").and_then(|v| v.as_str()).unwrap_or(""),
                "name": obj.get("name").and_then(|v| v.as_str()).unwrap_or(""),
                "address": obj.get("address").and_then(|v| v.as_str()).unwrap_or(""),
                "port": obj.get("port").and_then(|v| v.as_i64()).unwrap_or(22),
                "username": obj.get("username").and_then(|v| v.as_str()).unwrap_or(""),
                "groupId": obj.get("group_id").and_then(|v| v.as_str()).unwrap_or(""),
                "tags": tags,
                "color": obj.get("color").and_then(|v| v.as_str()).unwrap_or(""),
                "icon": obj.get("icon").and_then(|v| v.as_str()).unwrap_or(""),
                "sortOrder": obj.get("sort_order").and_then(|v| v.as_i64()).unwrap_or(0),
                "authType": obj.get("auth_type").and_then(|v| v.as_str()).unwrap_or("password"),
                "keyId": obj.get("key_id").and_then(|v| v.as_str()).unwrap_or(""),
                "password": obj.get("password").and_then(|v| v.as_str()).unwrap_or(""),
                "privateKey": obj.get("private_key").and_then(|v| v.as_str()).unwrap_or(""),
                "passphrase": obj.get("passphrase").and_then(|v| v.as_str()).unwrap_or(""),
                "createdAt": obj.get("created_at").and_then(|v| v.as_str()).unwrap_or(""),
                "updatedAt": obj.get("updated_at").and_then(|v| v.as_str()).unwrap_or(""),
            }))
        })
        .collect();
    Ok(result)
}

#[tauri::command]
pub fn get_all_keys_with_credentials(user_id: String) -> Result<Vec<Value>, String> {
    let all = db::fetch_filtered("keychain", &user_id, None)?;
    let result: Vec<Value> = all
        .into_iter()
        .filter_map(|r| {
            let obj = r.as_object()?;
            Some(json!({
                "id": obj.get("id").and_then(|v| v.as_str()).unwrap_or(""),
                "name": obj.get("name").and_then(|v| v.as_str()).unwrap_or(""),
                "description": obj.get("description").and_then(|v| v.as_str()).unwrap_or(""),
                "keyType": obj.get("key_type").and_then(|v| v.as_str()).unwrap_or("ed25519"),
                "publicKey": obj.get("public_key").and_then(|v| v.as_str()).unwrap_or(""),
                "encryptedPrivateKey": obj.get("encrypted_private_key").and_then(|v| v.as_str()).unwrap_or(""),
                "fingerprint": obj.get("fingerprint").and_then(|v| v.as_str()).unwrap_or(""),
                "createdAt": obj.get("created_at").and_then(|v| v.as_str()).unwrap_or(""),
            }))
        })
        .collect();
    Ok(result)
}

// ---- Groups ----

#[tauri::command]
pub fn list_groups(user_id: String, vault_id: Option<String>) -> Result<Vec<Value>, String> {
    let all = db::fetch_filtered("groups", &user_id, vault_id.as_deref())?;
    let result: Vec<Value> = all
        .into_iter()
        .filter_map(|r| r.as_object().map(obj_to_group))
        .collect();
    Ok(result)
}

#[tauri::command]
pub fn create_group(group: Value, _device_id: Option<String>) -> Result<Value, String> {
    let obj = group.as_object().ok_or("Invalid group data")?;
    let id = new_id();
    let ts = now();

    let record = json!({
        "id": id,
        "user_id": get_str(obj, "userId"),
        "vault_id": get_str(obj, "vaultId"),
        "parent_id": get_str(obj, "parentId"),
        "name": get_str(obj, "name"),
        "sort_order": get_int(obj, "sortOrder"),
        "synced": 0,
        "created_at": ts,
        "updated_at": ts,
    });

    db::upsert_records("groups", &[record])?;

    let all = db::fetch_all("groups")?;
    all.into_iter()
        .find(|r| r.get("id").and_then(|v| v.as_str()) == Some(&id))
        .and_then(|r| r.as_object().map(obj_to_group))
        .ok_or_else(|| "Failed to fetch created group".to_string())
}

#[tauri::command]
pub fn update_group(id: String, group: Value, _device_id: Option<String>) -> Result<Value, String> {
    let obj = group.as_object().ok_or("Invalid group data")?;
    let ts = now();

    let record = json!({
        "id": id,
        "user_id": get_str(obj, "userId"),
        "vault_id": get_str(obj, "vaultId"),
        "parent_id": get_str(obj, "parentId"),
        "name": get_str(obj, "name"),
        "sort_order": get_int(obj, "sortOrder"),
        "synced": 0,
        "created_at": get_str_or(obj, "createdAt", &ts),
        "updated_at": ts,
    });

    db::upsert_records("groups", &[record])?;

    let all = db::fetch_all("groups")?;
    all.into_iter()
        .find(|r| r.get("id").and_then(|v| v.as_str()) == Some(&id))
        .and_then(|r| r.as_object().map(obj_to_group))
        .ok_or_else(|| "Failed to fetch updated group".to_string())
}

#[tauri::command]
pub fn delete_group(id: String, _device_id: Option<String>) -> Result<(), String> {
    db::delete_record("groups", &id)
}

// ---- Vaults ----

#[tauri::command]
pub fn list_vaults(user_id: String) -> Result<Vec<Value>, String> {
    let all = db::fetch_filtered("vaults", &user_id, None)?;
    let result: Vec<Value> = all
        .into_iter()
        .filter_map(|r| r.as_object().map(obj_to_vault))
        .collect();
    Ok(result)
}

#[tauri::command]
pub fn create_vault(vault: Value, _device_id: Option<String>) -> Result<Value, String> {
    let obj = vault.as_object().ok_or("Invalid vault data")?;
    let id = new_id();
    let ts = now();

    let record = json!({
        "id": id,
        "user_id": get_str(obj, "userId"),
        "name": get_str(obj, "name"),
        "description": get_str(obj, "description"),
        "is_default": 0,
        "is_system": 0,
        "synced": 0,
        "created_at": ts,
        "updated_at": ts,
    });

    db::upsert_records("vaults", &[record])?;

    let all = db::fetch_all("vaults")?;
    all.into_iter()
        .find(|r| r.get("id").and_then(|v| v.as_str()) == Some(&id))
        .and_then(|r| r.as_object().map(obj_to_vault))
        .ok_or_else(|| "Failed to fetch created vault".to_string())
}

#[tauri::command]
pub fn update_vault(id: String, vault: Value, _device_id: Option<String>) -> Result<Value, String> {
    let obj = vault.as_object().ok_or("Invalid vault data")?;
    let ts = now();

    let is_default = match obj.get("isDefault") {
        Some(Value::Bool(b)) => *b as i64,
        Some(Value::Number(n)) => n.as_i64().unwrap_or(0),
        _ => 0,
    };
    let is_system = match obj.get("isSystem") {
        Some(Value::Bool(b)) => *b as i64,
        Some(Value::Number(n)) => n.as_i64().unwrap_or(0),
        _ => 0,
    };

    let record = json!({
        "id": id,
        "user_id": get_str(obj, "userId"),
        "name": get_str(obj, "name"),
        "description": get_str(obj, "description"),
        "is_default": is_default,
        "is_system": is_system,
        "synced": 0,
        "created_at": get_str_or(obj, "createdAt", &ts),
        "updated_at": ts,
    });

    db::upsert_records("vaults", &[record])?;

    let all = db::fetch_all("vaults")?;
    all.into_iter()
        .find(|r| r.get("id").and_then(|v| v.as_str()) == Some(&id))
        .and_then(|r| r.as_object().map(obj_to_vault))
        .ok_or_else(|| "Failed to fetch updated vault".to_string())
}

#[tauri::command]
pub fn delete_vault(id: String, _device_id: Option<String>) -> Result<(), String> {
    // Cascade: delete all child records by vault_id
    db::delete_by_column("hosts", "vault_id", &id)?;
    db::delete_by_column("groups", "vault_id", &id)?;
    db::delete_by_column("keychain", "vault_id", &id)?;
    db::delete_by_column("snippets", "vault_id", &id)?;
    db::delete_by_column("workspaces", "vault_id", &id)?;
    db::delete_by_column("tab_groups", "vault_id", &id)?;

    // Finally delete the vault itself
    db::delete_record("vaults", &id)
}

#[tauri::command]
pub fn get_vault_data(id: String) -> Result<Value, String> {
    let all = db::fetch_all("vaults")?;
    all.into_iter()
        .find(|r| r.get("id").and_then(|v| v.as_str()) == Some(&id))
        .and_then(|r| r.as_object().map(obj_to_vault))
        .ok_or_else(|| "Vault not found".to_string())
}

// ---- Keys ----

#[tauri::command]
pub fn list_keys(user_id: String, vault_id: Option<String>) -> Result<Vec<Value>, String> {
    let all = db::fetch_filtered("keychain", &user_id, vault_id.as_deref())?;
    let result: Vec<Value> = all
        .into_iter()
        .filter_map(|r| r.as_object().map(obj_to_key))
        .collect();
    Ok(result)
}

#[tauri::command]
pub fn create_key(key: Value, _device_id: Option<String>) -> Result<Value, String> {
    let obj = key.as_object().ok_or("Invalid key data")?;
    let id = new_id();
    let ts = now();

    let encrypted_private_key = get_str(obj, "encryptedPrivateKey");
    if encrypted_private_key.len() > MAX_PRIVATE_KEY_LENGTH {
        return Err(format!("Private key must be under {} characters", MAX_PRIVATE_KEY_LENGTH));
    }

    let record = json!({
        "id": id,
        "user_id": get_str(obj, "userId"),
        "vault_id": get_str(obj, "vaultId"),
        "name": get_str(obj, "name"),
        "key_type": get_str_or(obj, "keyType", "ed25519"),
        "description": get_str(obj, "description"),
        "fingerprint": get_str(obj, "fingerprint"),
        "public_key": get_str(obj, "publicKey"),
        "encrypted_private_key": encrypted_private_key,
        "data": "",
        "synced": 0,
        "created_at": ts,
        "updated_at": ts,
    });

    db::upsert_records("keychain", &[record])?;

    let all = db::fetch_all("keychain")?;
    all.into_iter()
        .find(|r| r.get("id").and_then(|v| v.as_str()) == Some(&id))
        .and_then(|r| r.as_object().map(obj_to_key))
        .ok_or_else(|| "Failed to fetch created key".to_string())
}

#[tauri::command]
pub fn update_key(id: String, key: Value, _device_id: Option<String>) -> Result<Value, String> {
    let obj = key.as_object().ok_or("Invalid key data")?;
    let ts = now();

    // Read existing record to preserve encrypted_private_key when not provided
    let existing = db::fetch_all("keychain")?
        .into_iter()
        .find(|r| r.get("id").and_then(|v| v.as_str()) == Some(&id))
        .and_then(|r| r.as_object().cloned());

    let existing_get = |key: &str| -> String {
        existing
            .as_ref()
            .and_then(|e| e.get(key))
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .to_string()
    };

    let encrypted_private_key = get_str(obj, "encryptedPrivateKey");

    // Validate length of provided private key
    let final_private_key = if encrypted_private_key.is_empty() {
        existing_get("encrypted_private_key")
    } else {
        if encrypted_private_key.len() > MAX_PRIVATE_KEY_LENGTH {
            return Err(format!("Private key must be under {} characters", MAX_PRIVATE_KEY_LENGTH));
        }
        encrypted_private_key
    };

    let record = json!({
        "id": id,
        "user_id": get_str(obj, "userId"),
        "vault_id": get_str(obj, "vaultId"),
        "name": get_str(obj, "name"),
        "key_type": get_str_or(obj, "keyType", "ed25519"),
        "description": get_str(obj, "description"),
        "fingerprint": get_str(obj, "fingerprint"),
        "public_key": get_str(obj, "publicKey"),
        "encrypted_private_key": final_private_key,
        "data": get_str(obj, "data"),
        "synced": 0,
        "created_at": get_str_or(obj, "createdAt", &ts),
        "updated_at": ts,
    });

    db::upsert_records("keychain", &[record])?;

    let all = db::fetch_all("keychain")?;
    all.into_iter()
        .find(|r| r.get("id").and_then(|v| v.as_str()) == Some(&id))
        .and_then(|r| r.as_object().map(obj_to_key))
        .ok_or_else(|| "Failed to fetch updated key".to_string())
}

#[tauri::command]
pub fn delete_key(id: String, _device_id: Option<String>) -> Result<(), String> {
    db::delete_record("keychain", &id)
}

// ---- Snippets ----

#[tauri::command]
pub fn list_snippets(user_id: String, vault_id: Option<String>) -> Result<Vec<Value>, String> {
    let all = db::fetch_filtered("snippets", &user_id, vault_id.as_deref())?;
    let result: Vec<Value> = all
        .into_iter()
        .filter_map(|r| r.as_object().map(obj_to_snippet))
        .collect();
    Ok(result)
}

#[tauri::command]
pub fn create_snippet(snippet: Value, _device_id: Option<String>) -> Result<Value, String> {
    let obj = snippet.as_object().ok_or("Invalid snippet data")?;
    let id = new_id();
    let ts = now();

    let record = json!({
        "id": id,
        "user_id": get_str(obj, "userId"),
        "vault_id": get_str(obj, "vaultId"),
        "name": get_str(obj, "name"),
        "command": get_str(obj, "command"),
        "description": get_str(obj, "description"),
        "tags": get_str(obj, "tags"),
        "synced": 0,
        "created_at": ts,
        "updated_at": ts,
    });

    db::upsert_records("snippets", &[record])?;

    let all = db::fetch_all("snippets")?;
    all.into_iter()
        .find(|r| r.get("id").and_then(|v| v.as_str()) == Some(&id))
        .and_then(|r| r.as_object().map(obj_to_snippet))
        .ok_or_else(|| "Failed to fetch created snippet".to_string())
}

#[tauri::command]
pub fn update_snippet(
    id: String,
    snippet: Value,
    _device_id: Option<String>,
) -> Result<Value, String> {
    let obj = snippet.as_object().ok_or("Invalid snippet data")?;
    let ts = now();

    let record = json!({
        "id": id,
        "user_id": get_str(obj, "userId"),
        "vault_id": get_str(obj, "vaultId"),
        "name": get_str(obj, "name"),
        "command": get_str(obj, "command"),
        "description": get_str(obj, "description"),
        "tags": get_str(obj, "tags"),
        "synced": 0,
        "created_at": get_str_or(obj, "createdAt", &ts),
        "updated_at": ts,
    });

    db::upsert_records("snippets", &[record])?;

    let all = db::fetch_all("snippets")?;
    all.into_iter()
        .find(|r| r.get("id").and_then(|v| v.as_str()) == Some(&id))
        .and_then(|r| r.as_object().map(obj_to_snippet))
        .ok_or_else(|| "Failed to fetch updated snippet".to_string())
}

#[tauri::command]
pub fn delete_snippet(id: String, _device_id: Option<String>) -> Result<(), String> {
    db::delete_record("snippets", &id)
}

// ---- Workspaces ----

#[tauri::command]
pub fn list_workspaces(user_id: String, vault_id: Option<String>) -> Result<Vec<Value>, String> {
    let all = db::fetch_filtered("workspaces", &user_id, vault_id.as_deref())?;
    let result: Vec<Value> = all
        .into_iter()
        .filter_map(|r| r.as_object().map(obj_to_workspace))
        .collect();
    Ok(result)
}

#[tauri::command]
pub fn create_workspace(
    ws: Option<Value>,
    _device_id: Option<String>,
) -> Result<Value, String> {
    let data = ws.ok_or("No workspace data provided")?;
    let obj = data.as_object().ok_or("Invalid workspace data")?;
    let id = new_id();
    let ts = now();

    let record = json!({
        "id": id,
        "user_id": get_str(obj, "userId"),
        "vault_id": get_str(obj, "vaultId"),
        "name": get_str(obj, "name"),
        "layout": get_str(obj, "layout"),
        "host_ids": get_str(obj, "hostIds"),
        "synced": 0,
        "created_at": ts,
        "updated_at": ts,
    });

    db::upsert_records("workspaces", &[record])?;

    let all = db::fetch_all("workspaces")?;
    all.into_iter()
        .find(|r| r.get("id").and_then(|v| v.as_str()) == Some(&id))
        .and_then(|r| r.as_object().map(obj_to_workspace))
        .ok_or_else(|| "Failed to fetch created workspace".to_string())
}

#[tauri::command]
pub fn update_workspace(
    id: String,
    ws: Option<Value>,
    _device_id: Option<String>,
) -> Result<Value, String> {
    let data = ws.ok_or("No workspace data provided")?;
    let obj = data.as_object().ok_or("Invalid workspace data")?;
    let ts = now();

    let record = json!({
        "id": id,
        "user_id": get_str(obj, "userId"),
        "vault_id": get_str(obj, "vaultId"),
        "name": get_str(obj, "name"),
        "layout": get_str(obj, "layout"),
        "host_ids": get_str(obj, "hostIds"),
        "synced": 0,
        "created_at": get_str_or(obj, "createdAt", &ts),
        "updated_at": ts,
    });

    db::upsert_records("workspaces", &[record])?;

    let all = db::fetch_all("workspaces")?;
    all.into_iter()
        .find(|r| r.get("id").and_then(|v| v.as_str()) == Some(&id))
        .and_then(|r| r.as_object().map(obj_to_workspace))
        .ok_or_else(|| "Failed to fetch updated workspace".to_string())
}

#[tauri::command]
pub fn delete_workspace(id: String, _device_id: Option<String>) -> Result<(), String> {
    db::delete_record("workspaces", &id)
}

// ---- Tab Groups ----

#[tauri::command]
pub fn list_tab_groups(user_id: String, vault_id: Option<String>) -> Result<Vec<Value>, String> {
    let all = db::fetch_filtered("tab_groups", &user_id, vault_id.as_deref())?;
    let result: Vec<Value> = all
        .into_iter()
        .filter_map(|r| r.as_object().map(obj_to_tab_group))
        .collect();
    Ok(result)
}

#[tauri::command]
pub fn create_tab_group(
    tg: Option<Value>,
    _device_id: Option<String>,
) -> Result<Value, String> {
    let data = tg.ok_or("No tab group data provided")?;
    let obj = data.as_object().ok_or("Invalid tab group data")?;
    let id = new_id();
    let ts = now();

    // Store uses "layout" but DB column is "tabs"
    let tabs = get_str(obj, "layout");

    let record = json!({
        "id": id,
        "user_id": get_str(obj, "userId"),
        "vault_id": get_str(obj, "vaultId"),
        "name": get_str(obj, "name"),
        "tabs": tabs,
        "synced": 0,
        "created_at": ts,
        "updated_at": ts,
    });

    db::upsert_records("tab_groups", &[record])?;

    let all = db::fetch_all("tab_groups")?;
    all.into_iter()
        .find(|r| r.get("id").and_then(|v| v.as_str()) == Some(&id))
        .and_then(|r| r.as_object().map(obj_to_tab_group))
        .ok_or_else(|| "Failed to fetch created tab group".to_string())
}

#[tauri::command]
pub fn update_tab_group(
    id: String,
    tg: Option<Value>,
    _device_id: Option<String>,
) -> Result<Value, String> {
    let data = tg.ok_or("No tab group data provided")?;
    let obj = data.as_object().ok_or("Invalid tab group data")?;
    let ts = now();

    // Store uses "layout" but DB column is "tabs"
    let tabs = get_str(obj, "layout");

    let record = json!({
        "id": id,
        "user_id": get_str(obj, "userId"),
        "vault_id": get_str(obj, "vaultId"),
        "name": get_str(obj, "name"),
        "tabs": tabs,
        "synced": 0,
        "created_at": get_str_or(obj, "createdAt", &ts),
        "updated_at": ts,
    });

    db::upsert_records("tab_groups", &[record])?;

    let all = db::fetch_all("tab_groups")?;
    all.into_iter()
        .find(|r| r.get("id").and_then(|v| v.as_str()) == Some(&id))
        .and_then(|r| r.as_object().map(obj_to_tab_group))
        .ok_or_else(|| "Failed to fetch updated tab group".to_string())
}

#[tauri::command]
pub fn delete_tab_group(id: String, _device_id: Option<String>) -> Result<(), String> {
    db::delete_record("tab_groups", &id)
}

// ---- Settings ----

#[tauri::command]
pub fn get_settings(user_id: String) -> Result<Value, String> {
    let all = db::fetch_filtered("settings", &user_id, None)?;
    if let Some(s) = all.into_iter().next() {
        if let Some(obj) = s.as_object() {
            return Ok(obj_to_settings(obj));
        }
    }
    // Create default settings (server-side defaults are synced)
    let id = new_id();
    let ts = now();
    let record = json!({
        "id": id,
        "user_id": user_id,
        "theme": "dark",
        "font_family": "JetBrains Mono",
        "font_size": 14,
        "cursor_style": "block",
        "synced": 1, // Default settings are synced
        "created_at": ts,
        "updated_at": ts,
    });
    db::upsert_records("settings", &[record.clone()])?;
    Ok(record)
}

#[tauri::command]
pub fn update_settings(user_id: String, settings: Value) -> Result<Value, String> {
    let obj = settings.as_object().ok_or("Invalid settings data")?;
    let ts = now();

    // Find existing settings or create new
    let all = db::fetch_all("settings")?;
    let existing = all
        .into_iter()
        .find(|r| r.get("user_id").and_then(|v| v.as_str()) == Some(user_id.as_str()));
    let id = existing
        .as_ref()
        .and_then(|r| r.get("id"))
        .and_then(|v| v.as_str())
        .map(|s| s.to_string())
        .unwrap_or_else(new_id);

    let record = json!({
        "id": id,
        "user_id": user_id,
        "theme": obj.get("theme").and_then(|v| v.as_str()).unwrap_or("dark"),
        "font_family": obj.get("fontFamily").and_then(|v| v.as_str()).unwrap_or("JetBrains Mono"),
        "font_size": obj.get("fontSize").and_then(|v| v.as_i64()).unwrap_or(14),
        "cursor_style": obj.get("cursorStyle").and_then(|v| v.as_str()).unwrap_or("block"),
        "synced": 0, // Updated settings need to be synced
        "created_at": existing
            .as_ref()
            .and_then(|r| r.get("created_at"))
            .and_then(|v| v.as_str())
            .unwrap_or(&ts),
        "updated_at": ts,
    });

    db::upsert_records("settings", &[record])?;

    let all = db::fetch_all("settings")?;
    all.into_iter()
        .find(|r| r.get("id").and_then(|v| v.as_str()) == Some(&id))
        .and_then(|r| r.as_object().map(obj_to_settings))
        .ok_or_else(|| "Failed to fetch updated settings".to_string())
}
