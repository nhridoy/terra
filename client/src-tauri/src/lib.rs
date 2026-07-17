#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod ssh;
mod vault;

use std::sync::Mutex;
use ssh::SSHState;
use tauri::Manager;

#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! Welcome to TermVault!", name)
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
            Ok(())
        })
        .manage(Mutex::new(SSHState::default()))
        .invoke_handler(tauri::generate_handler![
            greet,
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
        ])
        .run(tauri::generate_context!())
        .expect("error while running TermVault");
}
