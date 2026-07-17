#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod ssh;
mod vault;

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
        .invoke_handler(tauri::generate_handler![
            greet,
            ssh::connect,
            ssh::disconnect,
            ssh::send_input,
            ssh::resize,
            vault::derive_key,
            vault::encrypt,
            vault::decrypt,
        ])
        .run(tauri::generate_context!())
        .expect("error while running TermVault");
}
