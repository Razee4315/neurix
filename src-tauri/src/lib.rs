use log::info;
use std::env;

mod chat;
mod commands;
mod inference;
mod models;
mod settings;
mod state;

use commands::{
    chat_cmds::{get_active_model, run_inference, stop_inference},
    history_cmds::{clear_all_conversations, delete_conversation, get_conversations, load_conversation, save_conversation},
    model_cmds::{cancel_download, delete_model, download_model, get_active_downloads, get_downloaded_models, get_model_catalog, load_model},
    settings_cmds::{check_available_space, get_available_space, get_settings, get_storage_info, update_settings},
};
use state::SharedState;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    #[cfg(target_os = "android")]
    {
        android_logger::init_once(
            android_logger::Config::default()
                .with_max_level(log::LevelFilter::Debug)
                .with_tag("Neurix"),
        );
    }

    #[cfg(not(target_os = "android"))]
    {
        let log_level = env::var("RUST_LOG")
            .ok()
            .and_then(|s| s.parse::<log::LevelFilter>().ok())
            .unwrap_or(log::LevelFilter::Debug);
        let _ = simple_logger::SimpleLogger::new()
            .with_level(log_level)
            .init();
    }

    info!("Starting Neurix");

    let app_state = SharedState::default();

    tauri::Builder::default()
        .manage(app_state)
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .invoke_handler(tauri::generate_handler![
            get_model_catalog,
            download_model,
            cancel_download,
            get_downloaded_models,
            get_active_downloads,
            delete_model,
            load_model,
            get_active_model,
            run_inference,
            stop_inference,
            get_conversations,
            load_conversation,
            save_conversation,
            delete_conversation,
            clear_all_conversations,
            get_settings,
            update_settings,
            get_storage_info,
            check_available_space,
            get_available_space,
        ])
        .run(tauri::generate_context!())
        .expect("error while running Neurix")
}
