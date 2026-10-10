use log::info;
use std::env;

mod characters;
mod chat;
mod commands;
mod device;
mod inference;
mod models;
mod settings;
mod state;

/// Verbose logs in development; quiet in release builds, where Debug output
/// only costs battery and fills logcat.
fn default_log_level() -> log::LevelFilter {
    if cfg!(debug_assertions) {
        log::LevelFilter::Debug
    } else {
        log::LevelFilter::Info
    }
}

use commands::{
    character_cmds::get_preset_characters,
    chat_cmds::{benchmark_model, get_active_model, run_inference, stop_inference, unload_model},
    data_cmds::{export_data, import_data},
    history_cmds::{
        clear_all_conversations, delete_conversation, get_conversations, load_conversation,
        save_conversation, search_conversations,
    },
    model_cmds::{
        cancel_download, delete_model, download_model, get_active_downloads,
        get_downloaded_models, get_model_catalog, get_partial_downloads, load_model,
    },
    settings_cmds::{
        check_available_space, get_available_space, get_device_info, get_settings,
        get_storage_info, patch_settings, reset_settings,
    },
};
use state::SharedState;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    #[cfg(target_os = "android")]
    {
        android_logger::init_once(
            android_logger::Config::default()
                .with_max_level(default_log_level())
                .with_tag("Neurix"),
        );
    }

    #[cfg(not(target_os = "android"))]
    {
        let log_level = env::var("RUST_LOG")
            .ok()
            .and_then(|s| s.parse::<log::LevelFilter>().ok())
            .unwrap_or_else(default_log_level);
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
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_notification::init())
        .invoke_handler(tauri::generate_handler![
            get_model_catalog,
            download_model,
            cancel_download,
            get_downloaded_models,
            get_active_downloads,
            delete_model,
            get_partial_downloads,
            load_model,
            unload_model,
            get_active_model,
            run_inference,
            stop_inference,
            benchmark_model,
            search_conversations,
            get_conversations,
            load_conversation,
            save_conversation,
            delete_conversation,
            clear_all_conversations,
            get_settings,
            patch_settings,
            reset_settings,
            get_storage_info,
            check_available_space,
            get_available_space,
            get_device_info,
            export_data,
            import_data,
            get_preset_characters,
        ])
        .run(tauri::generate_context!())
        .expect("error while running Neurix")
}
