use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize};
use serde_json::{Map, Value};
use tauri::{AppHandle, Manager};
use tokio::fs;

use crate::device;
use crate::settings::{self, Settings};

#[tauri::command]
pub async fn get_settings(app: AppHandle) -> Result<Settings, String> {
    settings::load(&app)
}

/// Merge the given top-level keys into the stored settings. Callers send
/// only what they changed, so unrelated fields written elsewhere (for
/// example `last_model_id`, set when a model loads) are never clobbered.
#[tauri::command]
pub async fn patch_settings(app: AppHandle, patch: Map<String, Value>) -> Result<Settings, String> {
    settings::patch(&app, patch)
}

#[tauri::command]
pub async fn reset_settings(app: AppHandle) -> Result<Settings, String> {
    settings::reset(&app)
}

#[derive(Debug, Serialize, Deserialize)]
pub struct StorageInfo {
    /// Installed models.
    pub used_bytes: u64,
    pub models_count: u32,
    /// Unfinished downloads still on disk.
    pub partial_bytes: u64,
}

async fn file_len(path: &Path) -> u64 {
    fs::metadata(path).await.map(|m| m.len()).unwrap_or(0)
}

#[tauri::command]
pub async fn get_storage_info(app: AppHandle) -> Result<StorageInfo, String> {
    let models_dir = app
        .path()
        .app_local_data_dir()
        .map_err(|e| e.to_string())?
        .join("models");

    let mut info = StorageInfo { used_bytes: 0, models_count: 0, partial_bytes: 0 };
    if !models_dir.exists() {
        return Ok(info);
    }

    let mut entries = fs::read_dir(&models_dir).await.map_err(|e| e.to_string())?;
    while let Some(entry) = entries.next_entry().await.map_err(|e| e.to_string())? {
        let path = entry.path();
        if !path.is_dir() {
            continue;
        }
        let model_file = path.join("model.gguf");
        let part_file = path.join("model.gguf.part");

        info.partial_bytes += file_len(&part_file).await;
        if model_file.exists() {
            info.models_count += 1;
            info.used_bytes += file_len(&model_file).await;
        }
    }

    Ok(info)
}

fn space_check_path(app: &AppHandle) -> Result<PathBuf, String> {
    let data_dir = app.path().app_local_data_dir().map_err(|e| e.to_string())?;
    // Use the data directory, or its parent if it has not been created yet.
    Ok(if data_dir.exists() {
        data_dir
    } else {
        data_dir.parent().unwrap_or(Path::new("/")).to_path_buf()
    })
}

#[tauri::command]
pub async fn check_available_space(app: AppHandle, required_bytes: u64) -> Result<bool, String> {
    let available = fs2::available_space(space_check_path(&app)?).map_err(|e| e.to_string())?;
    // Require extra 100MB headroom beyond model size
    Ok(available > required_bytes + 100_000_000)
}

#[tauri::command]
pub async fn get_available_space(app: AppHandle) -> Result<u64, String> {
    fs2::available_space(space_check_path(&app)?).map_err(|e| e.to_string())
}

#[derive(Debug, Serialize)]
pub struct DeviceInfo {
    /// Physical RAM, when the platform lets us read it. `None` means
    /// unknown — callers must not treat that as "too little".
    pub total_memory_bytes: Option<u64>,
    /// Threads inference runs on when the setting is left on automatic.
    pub inference_threads: u32,
}

#[tauri::command]
pub async fn get_device_info() -> Result<DeviceInfo, String> {
    Ok(DeviceInfo {
        total_memory_bytes: device::total_memory_bytes(),
        inference_threads: device::inference_threads(),
    })
}
