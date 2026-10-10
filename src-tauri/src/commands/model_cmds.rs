use std::path::PathBuf;

use log::info;
use serde_json::{json, Map};
use tauri::ipc::Channel;
use tauri::{AppHandle, Manager, State};
use tokio_util::sync::CancellationToken;

use crate::device;
use crate::inference::engine::{self, LoadOptions};
use crate::models::catalog::{self, ModelInfo, Reasoning};
use crate::models::download::{self, DownloadEvent};
use crate::models::manager::{self, DownloadedModel, PartialDownload};
use crate::settings;
use crate::state::{ActiveModel, SharedState};

/// Below this much RAM a large context is a real risk of the system killing
/// the app, so the automatic setting stays at 4,096 tokens.
const SMALL_DEVICE_BYTES: u64 = 5_500_000_000;

/// Context window to allocate. An explicit setting wins; otherwise the
/// model's default is used, halved on low-memory devices.
fn context_length_for(setting: u32, model_default: u32, ram_bytes: Option<u64>) -> u32 {
    if setting > 0 {
        return setting;
    }
    match ram_bytes {
        Some(ram) if ram < SMALL_DEVICE_BYTES => model_default.min(4096),
        _ => model_default,
    }
}

fn models_dir(app: &AppHandle) -> Result<PathBuf, String> {
    Ok(app
        .path()
        .app_local_data_dir()
        .map_err(|e| e.to_string())?
        .join("models"))
}

#[tauri::command]
pub fn get_model_catalog() -> Vec<ModelInfo> {
    catalog::get_catalog()
}

#[tauri::command]
pub async fn download_model(
    app: AppHandle,
    state: State<'_, SharedState>,
    model_id: String,
    confirmed_wifi: bool,
    on_event: Channel<DownloadEvent>,
) -> Result<(), String> {
    // Defense-in-depth: re-enforce WiFi-only on the backend. The frontend
    // gate can be bypassed by devtools or a future code path that forgets to
    // call DownloadContext.startDownload. This is the second wall.
    //
    // Desktop builds have no metered-connection concept the WebView can
    // report, so the rule only applies on mobile.
    if cfg!(mobile) {
        let current = settings::load(&app)?;
        if current.wifi_only && !confirmed_wifi {
            return Err(
                "WiFi-only is enabled but the connection is not a confirmed WiFi network. \
                 Connect to WiFi or disable WiFi-only in Settings."
                    .to_string(),
            );
        }
    }

    let models_dir = models_dir(&app)?;

    let model = catalog::get_catalog()
        .into_iter()
        .find(|m| m.id == model_id)
        .ok_or_else(|| format!("Model {} not found in catalog", model_id))?;

    let cancel_token = CancellationToken::new();
    {
        let mut s = state.lock().await;
        if s.active_downloads.contains_key(&model_id) {
            return Err(format!("{} is already downloading", model.name));
        }
        s.discard_on_cancel.remove(&model_id);
        s.active_downloads.insert(model_id.clone(), cancel_token.clone());
    }

    info!("Starting download for model: {}", model_id);
    let result =
        download::download_model_files(&model, models_dir.clone(), &on_event, cancel_token).await;

    let discard = {
        let mut s = state.lock().await;
        s.active_downloads.remove(&model_id);
        s.discard_on_cancel.remove(&model_id)
    };
    if discard {
        // The transfer loop has exited and closed the file, so the partial
        // download can be removed safely on every platform.
        let _ = manager::delete_model(&models_dir, &model_id).await;
    }

    result
}

/// Stop a download. With `discard` the partial file is deleted as well
/// ("cancel"); without it the file is kept so the download can resume
/// ("pause").
#[tauri::command]
pub async fn cancel_download(
    app: AppHandle,
    state: State<'_, SharedState>,
    model_id: String,
    discard: Option<bool>,
) -> Result<(), String> {
    let discard = discard.unwrap_or(false);
    let was_active = {
        let mut s = state.lock().await;
        match s.active_downloads.get(&model_id).cloned() {
            Some(token) => {
                info!("Cancelling download for model: {}", model_id);
                if discard {
                    s.discard_on_cancel.insert(model_id.clone());
                }
                token.cancel();
                true
            }
            None => false,
        }
    };

    // Nothing in flight (already paused, or left over from a previous run):
    // remove the partial files directly.
    if discard && !was_active {
        let dir = models_dir(&app)?;
        let installed = manager::get_downloaded_models(&dir).await?;
        if !installed.iter().any(|m| m.id == model_id) {
            manager::delete_model(&dir, &model_id).await?;
        }
    }
    Ok(())
}

#[tauri::command]
pub async fn get_downloaded_models(app: AppHandle) -> Result<Vec<DownloadedModel>, String> {
    manager::get_downloaded_models(&models_dir(&app)?).await
}

#[tauri::command]
pub async fn get_partial_downloads(app: AppHandle) -> Result<Vec<PartialDownload>, String> {
    manager::get_partial_downloads(&models_dir(&app)?).await
}

#[tauri::command]
pub async fn delete_model(
    app: AppHandle,
    state: State<'_, SharedState>,
    model_id: String,
) -> Result<(), String> {
    manager::require_catalog_id(&model_id)?;

    // Unload first: a deleted model must not stay "active", or the next
    // message fails when it tries to reopen a file that no longer exists.
    {
        let mut s = state.lock().await;
        if s.active_model.as_ref().map(|m| m.id == model_id).unwrap_or(false) {
            if let Some(token) = &s.inference_cancel {
                token.cancel();
            }
            s.loaded_model = None;
            s.active_model = None;
        }
    }

    info!("Deleting model: {}", model_id);
    manager::delete_model(&models_dir(&app)?, &model_id).await
}

#[tauri::command]
pub async fn get_active_downloads(state: State<'_, SharedState>) -> Result<Vec<String>, String> {
    let s = state.lock().await;
    Ok(s.active_downloads.keys().cloned().collect())
}

#[tauri::command]
pub async fn load_model(
    app: AppHandle,
    state: State<'_, SharedState>,
    model_id: String,
) -> Result<(), String> {
    let catalog_entry = catalog::get_catalog()
        .into_iter()
        .find(|m| m.id == model_id)
        .ok_or_else(|| format!("Model {} not found in catalog", model_id))?;

    {
        let mut s = state.lock().await;
        // Already selected (loaded, or checked out by a running reply):
        // nothing to do. Avoids re-reading gigabytes for no reason.
        if s.active_model.as_ref().map(|m| m.id == model_id).unwrap_or(false) {
            return Ok(());
        }
        // Free the previous model BEFORE reading the new one so two models
        // are never held in memory at once.
        if let Some(token) = &s.inference_cancel {
            token.cancel();
        }
        s.loaded_model = None;
        s.active_model = None;
    }

    let model_path = models_dir(&app)?.join(&model_id).join("model.gguf");
    if !model_path.exists() {
        return Err(format!("Model file not found for {}", catalog_entry.name));
    }

    let current = settings::load(&app)?;
    let options = LoadOptions {
        context_length: context_length_for(
            current.context_size,
            catalog_entry.context_length as u32,
            device::total_memory_bytes(),
        ),
        threads: if current.threads > 0 { current.threads } else { device::inference_threads() },
    };

    info!("Loading model: {} ({})", catalog_entry.name, model_id);

    // Opening the file and allocating the context is blocking work.
    let name = catalog_entry.name.clone();
    let mid = model_id.clone();
    let sampling = catalog_entry.sampling;
    let loaded = tokio::task::spawn_blocking(move || {
        engine::load_model_from_disk(&mid, &name, &model_path, sampling, options)
    })
    .await
    .map_err(|e| format!("Loading task failed: {}", e))??;

    // Trust the model's own template over the catalog about whether
    // reasoning can be switched.
    let reasoning = match (catalog_entry.reasoning, loaded.supports_thinking_switch()) {
        (Reasoning::Always, _) => Reasoning::Always,
        (_, true) => Reasoning::Optional,
        (_, false) => Reasoning::None,
    };

    {
        let mut s = state.lock().await;
        s.active_model = Some(ActiveModel {
            id: model_id.clone(),
            name: catalog_entry.name.clone(),
            reasoning,
            context_length: loaded.context_length,
            threads: loaded.threads,
        });
        s.loaded_model = Some(loaded);
    }
    info!("Model loaded and ready");

    // Persist last used model. Goes through the shared patch path so it
    // cannot be overwritten by a concurrent settings write.
    let mut patch = Map::new();
    patch.insert("last_model_id".to_string(), json!(model_id));
    if let Err(e) = settings::patch(&app, patch) {
        log::warn!("Could not persist last model: {}", e);
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::context_length_for;

    #[test]
    fn context_follows_setting_then_memory() {
        let gb = 1_000_000_000u64;
        // An explicit setting always wins.
        assert_eq!(context_length_for(16_384, 8192, Some(4 * gb)), 16_384);
        // Automatic: the model default, halved on small devices.
        assert_eq!(context_length_for(0, 8192, Some(4 * gb)), 4096);
        assert_eq!(context_length_for(0, 8192, Some(8 * gb)), 8192);
        // Unknown RAM (desktop) is not treated as small.
        assert_eq!(context_length_for(0, 8192, None), 8192);
        assert_eq!(context_length_for(0, 4096, Some(12 * gb)), 4096);
    }
}
