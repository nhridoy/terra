#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod ssh;
mod vault;

use tauri::Manager;

#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! Welcome to TermVault!", name)
}

fn main() {
    tauri::Builder::default()
        .setup(|app| {
            let window = app.get_window("main").unwrap();
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
