use crate::db;
use serde::{Deserialize, Serialize};

const TABLES: &[&str] = &[
    "hosts",
    "groups",
    "vaults",
    "keychain",
    "snippets",
    "workspaces",
    "tab_groups",
    "settings",
];

#[derive(Debug, Serialize, Deserialize)]
struct SyncResponse {
    hosts: Option<Vec<serde_json::Value>>,
    groups: Option<Vec<serde_json::Value>>,
    vaults: Option<Vec<serde_json::Value>>,
    keychain: Option<Vec<serde_json::Value>>,
    snippets: Option<Vec<serde_json::Value>>,
    workspaces: Option<Vec<serde_json::Value>>,
    #[serde(rename = "tabGroups")]
    tab_groups: Option<Vec<serde_json::Value>>,
    settings: Option<Vec<serde_json::Value>>,
}

#[derive(Debug, Serialize, Deserialize)]
struct SyncPushRequest {
    table: String,
    records: Vec<serde_json::Value>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SyncPushResponse {
    pub results: Vec<SyncResult>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SyncResult {
    pub id: String,
    pub status: String,
    pub operation: String,
}

#[tauri::command]
pub async fn sync_pull(api_url: String, token: String, user_id: String) -> Result<String, String> {
    let client = reqwest::Client::new();

    let response = client
        .get(format!("{}/api/sync/full", api_url))
        .header("Authorization", format!("Bearer {}", token))
        .send()
        .await
        .map_err(|e| format!("Failed to fetch from server: {}", e))?;

    if !response.status().is_success() {
        return Err(format!("Server returned status: {}", response.status()));
    }

    let data: SyncResponse = response
        .json()
        .await
        .map_err(|e| format!("Failed to parse response: {}", e))?;

    let table_data: Vec<(&str, &Option<Vec<serde_json::Value>>)> = vec![
        ("hosts", &data.hosts),
        ("groups", &data.groups),
        ("vaults", &data.vaults),
        ("keychain", &data.keychain),
        ("snippets", &data.snippets),
        ("workspaces", &data.workspaces),
        ("tab_groups", &data.tab_groups),
        ("settings", &data.settings),
    ];

    for (table, records) in table_data {
        let empty = Vec::new();
        let recs = records.as_ref().unwrap_or(&empty);
        db::merge_records(table, recs, &user_id)
            .map_err(|e| format!("Failed to sync {}: {}", table, e))?;
    }

    Ok("sync complete".to_string())
}

#[tauri::command]
pub async fn sync_push(api_url: String, token: String, table: String, records: Vec<serde_json::Value>) -> Result<SyncPushResponse, String> {
    if !TABLES.contains(&table.as_str()) {
        return Err(format!("Unknown table: {}", table));
    }

    let client = reqwest::Client::new();
    let request = SyncPushRequest {
        table: table.clone(),
        records,
    };

    let response = client
        .post(format!("{}/api/sync/push", api_url))
        .header("Authorization", format!("Bearer {}", token))
        .json(&request)
        .send()
        .await
        .map_err(|e| format!("Failed to push to server: {}", e))?;

    if !response.status().is_success() {
        return Err(format!("Server returned status: {}", response.status()));
    }

    let push_response: SyncPushResponse = response
        .json()
        .await
        .map_err(|e| format!("Failed to parse sync response: {}", e))?;

    Ok(push_response)
}

#[tauri::command]
pub fn get_local_records(table: String) -> Result<Vec<serde_json::Value>, String> {
    if !TABLES.contains(&table.as_str()) {
        return Err(format!("Unknown table: {}", table));
    }
    db::fetch_all(&table)
}
