#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    if let Some(code) = neurix_tauri::document_helper() {
        std::process::exit(code);
    }
    neurix_tauri::run()
}
