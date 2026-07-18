use crate::db;
use crate::AppState;
use rusqlite::params;
use serde::{Deserialize, Serialize};

const SERVER_URL: &str = "http://localhost:8080";

#[derive(Debug, Serialize, Deserialize)]
struct SyncRecord {
    #[serde(rename = "tableName")]
    table_name: String,
    #[serde(rename = "recordId")]
    record_id: String,
    #[serde(default)]
    data: serde_json::Value,
    #[serde(rename = "updatedAt", default)]
    updated_at: String,
    #[serde(rename = "deviceId", default)]
    device_id: String,
    #[serde(rename = "isDeleted", default)]
    is_deleted: bool,
}

#[derive(Debug, Serialize, Deserialize)]
struct SyncPushRequest {
    records: Vec<SyncRecord>,
    #[serde(rename = "deviceId")]
    device_id: String,
}

#[derive(Debug, Serialize, Deserialize)]
struct SyncPushResponse {
    status: String,
    accepted: i64,
    conflicts: Vec<SyncRecord>,
}

#[derive(Debug, Serialize, Deserialize)]
struct SyncPullResponse {
    records: Vec<SyncRecord>,
    #[serde(rename = "syncToken")]
    sync_token: String,
    #[serde(rename = "hasMore")]
    has_more: bool,
}

#[tauri::command]
pub async fn sync_push(state: tauri::State<'_, AppState>) -> Result<i32, String> {
    let device_id = state.device_id.clone();
    let user_id = {
        let guard = state.user_id.lock().map_err(|e| e.to_string())?;
        guard.clone().ok_or("Not logged in")?
    };

    let last_sync = {
        let conn_guard = db::conn()?;
        let conn = conn_guard.as_ref().ok_or("DB not initialized")?;
        conn.query_row(
            "SELECT last_sync_at FROM sync_state WHERE device_id = ?1",
            params![device_id],
            |row| row.get::<_, String>(0),
        )
        .ok()
    };

    let records = {
        let conn_guard = db::conn()?;
        let conn = conn_guard.as_ref().ok_or("DB not initialized")?;

        let mut records = Vec::new();
        if let Some(ref since) = last_sync {
            let mut stmt = conn.prepare(
                "SELECT table_name, record_id, updated_at, device_id, is_deleted
                 FROM sync_tracking
                 WHERE updated_at > ?1",
            )
            .map_err(|e| e.to_string())?;

            let rows = stmt
                .query_map(params![since], |row| {
                    Ok(SyncRecord {
                        table_name: row.get(0)?,
                        record_id: row.get(1)?,
                        data: serde_json::Value::Null,
                        updated_at: row.get(2)?,
                        device_id: row.get(3)?,
                        is_deleted: row.get::<_, i32>(4)? != 0,
                    })
                })
                .map_err(|e| e.to_string())?;

            for row in rows {
                let mut record = row.map_err(|e| e.to_string())?;
                if !record.is_deleted {
                    record.data =
                        fetch_record_data(conn, &record.table_name, &record.record_id, &user_id)?;
                }
                records.push(record);
            }
        } else {
            let mut stmt = conn.prepare(
                "SELECT table_name, record_id, updated_at, device_id, is_deleted
                 FROM sync_tracking",
            )
            .map_err(|e| e.to_string())?;

            let rows = stmt
                .query_map([], |row| {
                    Ok(SyncRecord {
                        table_name: row.get(0)?,
                        record_id: row.get(1)?,
                        data: serde_json::Value::Null,
                        updated_at: row.get(2)?,
                        device_id: row.get(3)?,
                        is_deleted: row.get::<_, i32>(4)? != 0,
                    })
                })
                .map_err(|e| e.to_string())?;

            for row in rows {
                let mut record = row.map_err(|e| e.to_string())?;
                if !record.is_deleted {
                    record.data =
                        fetch_record_data(conn, &record.table_name, &record.record_id, &user_id)?;
                }
                records.push(record);
            }
        }
        records
    };

    if records.is_empty() {
        return Ok(0);
    }

    let max_updated = records
        .iter()
        .map(|r| r.updated_at.as_str())
        .max()
        .unwrap()
        .to_string();

    let client = reqwest::Client::new();
    let resp = client
        .post(format!("{}/api/sync/push", SERVER_URL))
        .header("Authorization", format!("Bearer {}", {
            let guard = state.token.lock().map_err(|e| e.to_string())?;
            guard.clone().ok_or("Not logged in")?
        }))
        .json(&SyncPushRequest {
            records,
            device_id: device_id.clone(),
        })
        .send()
        .await
        .map_err(|e| e.to_string())?;

    if resp.status().is_success() {
        let result: SyncPushResponse = resp.json().await.map_err(|e| e.to_string())?;

        for conflict in &result.conflicts {
            apply_remote_record(conflict)?;
        }

        let conn_guard = db::conn()?;
        let conn = conn_guard.as_ref().ok_or("DB not initialized")?;
        conn.execute(
            "INSERT OR REPLACE INTO sync_state (id, device_id, last_sync_at, updated_at) VALUES (?1, ?1, ?2, ?2)",
            params![device_id, max_updated],
        )
        .map_err(|e| e.to_string())?;

        Ok(result.accepted as i32)
    } else {
        Err(format!("Sync push failed: {}", resp.status()))
    }
}

#[tauri::command]
pub async fn sync_full(state: tauri::State<'_, AppState>) -> Result<String, String> {
    sync_push(state.clone()).await?;

    let token = {
        let guard = state.token.lock().map_err(|e| e.to_string())?;
        guard.clone().ok_or("Not logged in")?
    };

    let client = reqwest::Client::new();
    let resp = client
        .get(format!("{}/api/sync/full", SERVER_URL))
        .header("Authorization", format!("Bearer {}", token))
        .send()
        .await
        .map_err(|e| e.to_string())?;

    if resp.status().is_success() {
        let body = resp.text().await.map_err(|e| format!("Failed to read body: {}", e))?;
        let result: SyncPullResponse = serde_json::from_str(&body)
            .map_err(|e| format!("Decode error: {} | body: {}", e, &body[..body.len().min(500)]))?;

        for record in &result.records {
            apply_remote_record(record)?;
        }

        let now = chrono::Utc::now()
            .format("%Y-%m-%dT%H:%M:%SZ")
            .to_string();
        let device_id = state.device_id.clone();
        let conn_guard = db::conn()?;
        let conn = conn_guard.as_ref().ok_or("DB not initialized")?;
        conn.execute(
            "INSERT OR REPLACE INTO sync_state (id, device_id, last_sync_at, updated_at) VALUES (?1, ?1, ?2, ?2)",
            params![device_id, now],
        )
        .map_err(|e| e.to_string())?;

        Ok("synced".to_string())
    } else {
        Err(format!("Sync full failed: {}", resp.status()))
    }
}

fn fetch_record_data(
    conn: &rusqlite::Connection,
    table_name: &str,
    record_id: &str,
    _user_id: &str,
) -> Result<serde_json::Value, String> {
    let allowed = ["hosts", "groups", "vaults", "snippets", "workspaces", "tab_groups", "keychain", "settings", "session_logs"];
    if !allowed.contains(&table_name) {
        return Ok(serde_json::json!({}));
    }

    // Get column names from the table so json_object('col1', col1, 'col2', col2, ...)
    // uses real column names as JSON keys.
    let pragma = format!("PRAGMA table_info({})", table_name);
    let mut stmt = conn.prepare(&pragma).map_err(|e| e.to_string())?;
    let columns: Vec<String> = stmt
        .query_map([], |row| row.get::<_, String>(1))
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();

    if columns.is_empty() {
        return Ok(serde_json::json!({}));
    }

    let pairs: Vec<String> = columns
        .iter()
        .flat_map(|c| vec![format!("'{}'", c), c.clone()])
        .collect();
    let sql = format!(
        "SELECT json_object({}) FROM {} WHERE id = ?1 LIMIT 1",
        pairs.join(", "),
        table_name
    );
    let result: Result<String, _> =
        conn.query_row(&sql, params![record_id], |row| row.get(0));
    match result {
        Ok(val) => serde_json::from_str(&val).map_err(|e| e.to_string()),
        Err(_) => Ok(serde_json::json!({})),
    }
}

fn apply_remote_record(record: &SyncRecord) -> Result<(), String> {
    let conn_guard = db::conn()?;
    let conn = conn_guard.as_ref().ok_or("DB not initialized")?;

    if record.is_deleted {
        let sql = format!("DELETE FROM {} WHERE id = ?1", record.table_name);
        conn.execute(&sql, params![record.record_id])
            .map_err(|e| e.to_string())?;
    } else if !record.data.is_null() && record.data != serde_json::json!({}) {
        let obj = record.data.as_object().ok_or("Record data is not an object")?;

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
                    _ => Box::new(Option::<String>::None),
                };
                boxed
            })
            .collect();

        let sql = format!(
            "INSERT OR REPLACE INTO {} ({}) VALUES ({})",
            record.table_name,
            columns.join(", "),
            placeholders.join(", ")
        );

        let param_refs: Vec<&dyn rusqlite::types::ToSql> =
            values.iter().map(|v| v.as_ref()).collect();
        conn.execute(&sql, param_refs.as_slice())
            .map_err(|e| e.to_string())?;
    }

    Ok(())
}
