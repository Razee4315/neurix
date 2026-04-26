use log::info;
use tauri::{AppHandle, Manager, State};
use tauri::ipc::Channel;
use tauri_plugin_store::StoreExt;
use tokio_util::sync::CancellationToken;

use crate::models::catalog::{self, ModelInfo};
use crate::models::download::{self, DownloadEvent};
use crate::models::manager::{self, DownloadedModel};
use crate::state::SharedState;

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
    // We read the persisted settings ourselves rather than trusting any flag
    // from the caller; the caller only tells us whether IT confirmed WiFi.
    if let Ok(store) = app.store("settings.json") {
        let settings = store
            .get("settings")
            .and_then(|v| serde_json::from_value::<crate::settings::Settings>(v).ok())
            .unwrap_or_default();
        if settings.wifi_only && !confirmed_wifi {
            return Err(
                "WiFi-only is enabled but the connection is not a confirmed WiFi network. \
                 Connect to WiFi or disable WiFi-only in Settings."
                    .to_string(),
            );
        }
    }

    let models_dir = app
        .path()
        .app_local_data_dir()
        .map_err(|e| e.to_string())?
        .join("models");

    let model = catalog::get_catalog()
        .into_iter()
        .find(|m| m.id == model_id)
        .ok_or_else(|| format!("Model {} not found in catalog", model_id))?;

    let cancel_token = CancellationToken::new();
    {
        let mut s = state.lock().await;
        s.active_downloads.insert(model_id.clone(), cancel_token.clone());
    }

    info!("Starting download for model: {}", model_id);
    let result = download::download_model_files(&model, models_dir, &on_event, cancel_token).await;

    {
        let mut s = state.lock().await;
        s.active_downloads.remove(&model_id);
    }

    result
}

#[tauri::command]
pub async fn cancel_download(
    state: State<'_, SharedState>,
    model_id: String,
) -> Result<(), String> {
    let s = state.lock().await;
    if let Some(token) = s.active_downloads.get(&model_id) {
        info!("Cancelling download for model: {}", model_id);
        token.cancel();
    }
    Ok(())
}

#[tauri::command]
pub async fn get_downloaded_models(app: AppHandle) -> Result<Vec<DownloadedModel>, String> {
    let models_dir = app
        .path()
        .app_local_data_dir()
        .map_err(|e| e.to_string())?
        .join("models");

    manager::get_downloaded_models(&models_dir).await
}

#[tauri::command]
pub async fn delete_model(app: AppHandle, model_id: String) -> Result<(), String> {
    let models_dir = app
        .path()
        .app_local_data_dir()
        .map_err(|e| e.to_string())?
        .join("models");

    info!("Deleting model: {}", model_id);
    manager::delete_model(&models_dir, &model_id).await
}

#[tauri::command]
pub async fn get_active_downloads(
    state: State<'_, SharedState>,
) -> Result<Vec<String>, String> {
    let s = state.lock().await;
    Ok(s.active_downloads.keys().cloned().collect())
}

#[tauri::command]
pub async fn load_model(
    app: AppHandle,
    state: State<'_, SharedState>,
    model_id: String,
) -> Result<(), String> {
    let models_dir = app
        .path()
        .app_local_data_dir()
        .map_err(|e| e.to_string())?
        .join("models");

    let model_dir = models_dir.join(&model_id);
    let model_path = model_dir.join("model.gguf");
    let tokenizer_path = model_dir.join("tokenizer.json");

    if !model_path.exists() {
        return Err(format!("Model file not found for {}", model_id));
    }
    if !tokenizer_path.exists() {
        return Err(format!("Tokenizer not found for {}. Re-download the model.", model_id));
    }

    let catalog_entry = catalog::get_catalog()
        .into_iter()
        .find(|m| m.id == model_id)
        .ok_or_else(|| format!("Model {} not found in catalog", model_id))?;

    info!("Loading model: {} ({})", catalog_entry.name, model_id);

    // Load on a blocking thread since candle does heavy CPU work
    let name = catalog_entry.name.clone();
    let mid = model_id.clone();
    let template = catalog_entry.chat_template.clone();
    let ctx_len = catalog_entry.context_length;

    let loaded = tokio::task::spawn_blocking(move || {
        crate::inference::engine::load_model_from_disk(
            &mid,
            &name,
            &model_path,
            &tokenizer_path,
            template,
            ctx_len,
        )
    })
    .await
    .map_err(|e| format!("Loading task failed: {}", e))??;

    let mut s = state.lock().await;
    s.loaded_model = Some(loaded);
    info!("Model loaded and ready");

    // Persist last used model ID
    if let Ok(store) = app.store("settings.json") {
        let current = store.get("settings");
        let mut settings = current
            .and_then(|v| serde_json::from_value::<crate::settings::Settings>(v).ok())
            .unwrap_or_default();
        settings.last_model_id = Some(model_id);
        if let Ok(v) = serde_json::to_value(&settings) {
            store.set("settings", v);
            let _ = store.save();
        }
    }

    Ok(())
}
