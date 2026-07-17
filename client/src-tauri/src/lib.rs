#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod ssh;
mod vault;
mod db;
mod crud;

use std::sync::Mutex;
use ssh::SSHState;
use tauri::Manager;

pub struct AppState {
    pub device_id: String,
    pub user_id: Mutex<Option<String>>,
    pub encryption_key: Mutex<Option<String>>,
}

#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! Welcome to TermVault!", name)
}

#[tauri::command]
fn get_device_id(state: tauri::State<'_, AppState>) -> String {
    state.device_id.clone()
}

#[tauri::command]
fn set_user_id(user_id: String, state: tauri::State<'_, AppState>) -> Result<(), String> {
    let mut guard = state.user_id.lock().map_err(|e| e.to_string())?;
    *guard = Some(user_id);
    Ok(())
}

#[tauri::command]
fn set_encryption_key(key: String, state: tauri::State<'_, AppState>) -> Result<(), String> {
    let mut guard = state.encryption_key.lock().map_err(|e| e.to_string())?;
    *guard = Some(key);
    Ok(())
}

fn get_or_create_device_id() -> String {
    let dirs = dirs::data_local_dir().unwrap_or_else(|| std::path::PathBuf::from("."));
    let path = dirs.join("termvault").join("device_id");
    if let Ok(id) = std::fs::read_to_string(&path) {
        let id = id.trim().to_string();
        if !id.is_empty() { return id; }
    }
    let id = uuid::Uuid::new_v4().to_string();
    std::fs::create_dir_all(path.parent().unwrap()).ok();
    std::fs::write(&path, &id).ok();
    id
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .setup(|app| {
            let window = app.get_webview_window("main").unwrap();
            window.set_title("TermVault")?;

            let app_data_dir = app.path().app_data_dir().expect("failed to get app dir");
            std::fs::create_dir_all(&app_data_dir).ok();
            let db_path = app_data_dir.join("termvault.db");
            db::init(db_path.to_str().unwrap()).expect("Failed to init DB");

            Ok(())
        })
        .manage(Mutex::new(SSHState::default()))
        .manage(AppState {
            device_id: get_or_create_device_id(),
            user_id: Mutex::new(None),
            encryption_key: Mutex::new(None),
        })
        .invoke_handler(tauri::generate_handler![
            greet,
            get_device_id,
            set_user_id,
            set_encryption_key,
            vault::generate_salt,
            vault::derive_key,
            vault::encrypt,
            vault::decrypt,
            ssh::connect,
            ssh::disconnect,
            ssh::send_input,
            ssh::resize,
            ssh::sftp_list,
            ssh::sftp_read,
            ssh::sftp_write,
            ssh::sftp_delete,
            ssh::sftp_mkdir,
            ssh::sftp_rename,
            ssh::sftp_chmod,
            ssh::sftp_copy,
            ssh::sftp_cross_copy,
            vault::derive_key,
            vault::encrypt,
            vault::decrypt,
            crud::create_host,
            crud::get_host,
            crud::list_hosts,
            crud::list_hosts_by_group,
            crud::update_host,
            crud::delete_host,
            crud::create_group,
            crud::list_groups,
            crud::update_group,
            crud::delete_group,
            crud::create_vault,
            crud::list_vaults,
            crud::update_vault,
            crud::delete_vault,
            crud::get_vault_data,
            crud::create_key,
            crud::list_keys,
            crud::get_key,
            crud::delete_key,
            crud::create_snippet,
            crud::list_snippets,
            crud::update_snippet,
            crud::delete_snippet,
            crud::search_snippets,
            crud::create_workspace,
            crud::list_workspaces,
            crud::update_workspace,
            crud::delete_workspace,
            crud::create_tab_group,
            crud::list_tab_groups,
            crud::update_tab_group,
            crud::delete_tab_group,
            crud::get_settings,
            crud::update_settings,
            crud::create_session_log,
            crud::list_session_logs,
            crud::get_session_log,
            crud::delete_session_log,
            crud::end_session_log,
            crud::log_command,
            crud::list_command_logs,
        ])
        .run(tauri::generate_context!())
        .expect("error while running TermVault");
}
