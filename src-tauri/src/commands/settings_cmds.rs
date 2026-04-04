use crate::settings::Settings;
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Manager};
use tauri_plugin_store::StoreExt;
use tokio::fs;

const SETTINGS_STORE: &str = "settings.json";
const SETTINGS_KEY: &str = "settings";

#[tauri::command]
pub async fn get_settings(app: AppHandle) -> Result<Settings, String> {
    let store = app.store(SETTINGS_STORE).map_err(|e| e.to_string())?;
    match store.get(SETTINGS_KEY) {
        Some(val) => serde_json::from_value(val).map_err(|e| e.to_string()),
        None => Ok(Settings::default()),
    }
}

#[tauri::command]
pub async fn update_settings(app: AppHandle, settings: Settings) -> Result<(), String> {
    let store = app.store(SETTINGS_STORE).map_err(|e| e.to_string())?;
    let val = serde_json::to_value(&settings).map_err(|e| e.to_string())?;
    store.set(SETTINGS_KEY, val);
    store.save().map_err(|e| e.to_string())?;
    Ok(())
}

#[derive(Debug, Serialize, Deserialize)]
pub struct StorageInfo {
    pub used_bytes: u64,
    pub models_count: u32,
}

#[tauri::command]
pub async fn get_storage_info(app: AppHandle) -> Result<StorageInfo, String> {
    let models_dir = app
        .path()
        .app_local_data_dir()
        .map_err(|e| e.to_string())?
        .join("models");

    if !models_dir.exists() {
        return Ok(StorageInfo { used_bytes: 0, models_count: 0 });
    }

    let mut total_bytes: u64 = 0;
    let mut models_count: u32 = 0;

    let mut entries = fs::read_dir(&models_dir).await.map_err(|e| e.to_string())?;
    while let Some(entry) = entries.next_entry().await.map_err(|e| e.to_string())? {
        let path = entry.path();
        if path.is_dir() {
            let model_file = path.join("model.gguf");
            if model_file.exists() {
                models_count += 1;
                if let Ok(meta) = fs::metadata(&model_file).await {
                    total_bytes += meta.len();
                }
                let tok_file = path.join("tokenizer.json");
                if let Ok(meta) = fs::metadata(&tok_file).await {
                    total_bytes += meta.len();
                }
            }
        }
    }

    Ok(StorageInfo { used_bytes: total_bytes, models_count })
}
