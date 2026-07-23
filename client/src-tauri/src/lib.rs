#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::sync::Mutex;
use tauri::Manager;

pub struct AppState {
    pub device_id: String,
    pub api_url: Mutex<Option<String>>,
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
    Ok(guard
        .clone()
        .unwrap_or_else(|| "http://localhost:8080".to_string()))
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
        .plugin(tauri_plugin_store::Builder::default().build())
        .setup(|app| {
            let window = app
                .get_webview_window("main")
                .ok_or("main window not found")?;
            window.set_title("TermVault")?;
            Ok(())
        })
        .manage(AppState {
            device_id: get_or_create_device_id(),
            api_url: Mutex::new(None),
        })
        .invoke_handler(tauri::generate_handler![
            get_device_id,
            set_api_url,
            get_api_url,
            write_file,
        ])
        .run(tauri::generate_context!())
        .unwrap_or_else(|e| {
            eprintln!("Failed to run TermVault: {e}");
            std::process::exit(1);
        });
}
