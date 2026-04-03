use log::info;
use std::env;

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

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .invoke_handler(tauri::generate_handler![greet])
        .run(tauri::generate_context!())
        .expect("error while running Neurix")
}

#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! Welcome to Neurix.", name)
}
