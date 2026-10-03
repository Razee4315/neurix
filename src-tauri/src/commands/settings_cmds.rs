use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize};
use serde_json::{Map, Value};
use tauri::{AppHandle, Manager};
use tokio::fs;

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
    /// Installed models (weights + tokenizer).
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
        let tok_file = path.join("tokenizer.json");
        let part_file = path.join("model.gguf.part");

        info.partial_bytes += file_len(&part_file).await;
        if model_file.exists() && tok_file.exists() {
            info.models_count += 1;
            info.used_bytes += file_len(&model_file).await + file_len(&tok_file).await;
        } else {
            // Weights without a tokenizer are an unfinished install.
            info.partial_bytes += file_len(&model_file).await;
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
}

/// Parse the `MemTotal` line of `/proc/meminfo` ("MemTotal:  8040348 kB").
fn parse_mem_total(meminfo: &str) -> Option<u64> {
    meminfo
        .lines()
        .find(|line| line.starts_with("MemTotal:"))?
        .split_whitespace()
        .nth(1)?
        .parse::<u64>()
        .ok()
        .map(|kb| kb * 1024)
}

#[tauri::command]
pub async fn get_device_info() -> Result<DeviceInfo, String> {
    // Android and Linux expose RAM through procfs. Other platforms report
    // unknown rather than pulling in a system-info dependency.
    let total_memory_bytes = fs::read_to_string("/proc/meminfo")
        .await
        .ok()
        .and_then(|text| parse_mem_total(&text));
    Ok(DeviceInfo { total_memory_bytes })
}

#[cfg(test)]
mod tests {
    use super::parse_mem_total;

    #[test]
    fn reads_mem_total() {
        let sample = "MemTotal:        8040348 kB\nMemFree:          123456 kB\n";
        assert_eq!(parse_mem_total(sample), Some(8_040_348 * 1024));
    }

    #[test]
    fn missing_line_is_unknown() {
        assert_eq!(parse_mem_total("MemFree: 1 kB\n"), None);
    }
}
