#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod ssh;
mod vault;
mod db;
mod sync;
mod crud;
mod known_hosts;
mod local_shell;

use std::sync::Mutex;
use ssh::SSHState;
use tauri::Manager;

pub struct AppState {
    pub device_id: String,
    pub api_url: Mutex<Option<String>>,
    pub user_id: Mutex<Option<String>>,
    pub encryption_key: Mutex<Option<String>>,
}

#[tauri::command]
fn get_device_id(state: tauri::State<'_, AppState>) -> String {
    state.device_id.clone()
}

#[tauri::command]
fn set_api_url(url: String, state: tauri::State<'_, AppState>) -> Result<(), String> {
    let mut guard = state.api_url.lock().map_err(|e| e.to_string())?;
    *guard = Some(url);
    Ok(())
}

#[tauri::command]
fn get_api_url(state: tauri::State<'_, AppState>) -> Result<String, String> {
    let guard = state.api_url.lock().map_err(|e| e.to_string())?;
    Ok(guard.clone().unwrap_or_else(|| "http://localhost:8080".to_string()))
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

#[tauri::command]
fn write_file(path: String, contents: String) -> Result<(), String> {
    let p = std::path::Path::new(&path);
    if let Some(parent) = p.parent() {
        std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    std::fs::write(p, contents).map_err(|e| e.to_string())
}

fn get_or_create_device_id() -> String {
    let dirs = dirs::data_local_dir().unwrap_or_else(|| std::path::PathBuf::from("."));
    let path = dirs.join("termvault").join("device_id");
    if let Ok(id) = std::fs::read_to_string(&path) {
        let id = id.trim().to_string();
        if !id.is_empty() {
            return id;
        }
    }
    let id = uuid::Uuid::new_v4().to_string();
    if let Some(parent) = path.parent() {
        let _ = std::fs::create_dir_all(parent);
    }
    let _ = std::fs::write(&path, &id);
    id
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .setup(|app| {
            let window = app
                .get_webview_window("main")
                .ok_or("main window not found")?;
            window.set_title("TermVault")?;

            let app_data_dir = app
                .path()
                .app_data_dir()
                .map_err(|e| format!("failed to get app dir: {e}"))?;
            std::fs::create_dir_all(&app_data_dir).ok();
            let db_path = app_data_dir.join("termvault.db");
            let db_str = db_path
                .to_str()
                .ok_or("database path is not valid UTF-8")?;
            db::init(db_str).map_err(|e| format!("Failed to init local DB: {e}"))?;

            // Set known_hosts path for SSH host key verification
            let known_hosts_path = app_data_dir.join("known_hosts");
            known_hosts::set_known_hosts_path(known_hosts_path);

            Ok(())
        })
        .manage(Mutex::new(SSHState::default()))
        .manage(AppState {
            device_id: get_or_create_device_id(),
            api_url: Mutex::new(None),
            user_id: Mutex::new(None),
            encryption_key: Mutex::new(None),
        })
        .invoke_handler(tauri::generate_handler![
            get_device_id,
            set_api_url,
            get_api_url,
            set_user_id,
            set_encryption_key,
            write_file,
            vault::generate_salt,
            vault::derive_key,
            vault::encrypt,
            vault::decrypt,
            vault::generate_recovery_kit,
            vault::recover_from_kit,
            vault::generate_ed25519_keypair,
            vault::generate_rsa_keypair,
            ssh::connect,
            ssh::disconnect,
            ssh::send_input,
            ssh::resize,
            ssh::accept_host_key,
            ssh::sftp_list,
            ssh::sftp_read,
            ssh::sftp_write,
            ssh::sftp_delete,
            ssh::sftp_mkdir,
            ssh::sftp_rename,
            ssh::sftp_chmod,
            ssh::sftp_copy,
            ssh::sftp_cross_copy,
            ssh::port_forward_start,
            ssh::port_forward_stop,
            ssh::port_forward_list,
            sync::sync_pull,
            sync::sync_push,
            sync::get_local_records,
            db::get_unsynced_records,
            db::process_sync_result,
            crud::list_hosts,
            crud::create_host,
            crud::update_host,
            crud::delete_host,
            crud::get_host_credentials,
            crud::get_all_hosts_with_credentials,
            crud::get_all_keys_with_credentials,
            crud::list_groups,
            crud::create_group,
            crud::update_group,
            crud::delete_group,
            crud::list_vaults,
            crud::create_vault,
            crud::update_vault,
            crud::delete_vault,
            crud::get_vault_data,
            crud::list_keys,
            crud::create_key,
            crud::update_key,
            crud::delete_key,
            crud::list_snippets,
            crud::create_snippet,
            crud::update_snippet,
            crud::delete_snippet,
            crud::list_workspaces,
            crud::create_workspace,
            crud::update_workspace,
            crud::delete_workspace,
            crud::list_tab_groups,
            crud::create_tab_group,
            crud::update_tab_group,
            crud::delete_tab_group,
            crud::get_settings,
            crud::update_settings,
            known_hosts::list_known_hosts,
            known_hosts::remove_known_host,
            known_hosts::clear_known_hosts,
            local_shell::list_local_shells,
            local_shell::connect_local,
            local_shell::disconnect_local,
            local_shell::send_input_local,
            local_shell::resize_local,
        ])
        .run(tauri::generate_context!())
        .unwrap_or_else(|e| {
            eprintln!("Failed to run TermVault: {e}");
            std::process::exit(1);
        });
}
