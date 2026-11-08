use std::path::Path;

use serde::{Deserialize, Serialize};
use tokio::fs;

use super::added;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DownloadedModel {
    pub id: String,
    pub name: String,
    pub size_bytes: u64,
    pub size_label: String,
    pub tag: String,
}

pub async fn get_downloaded_models(models_dir: &Path) -> Result<Vec<DownloadedModel>, String> {
    if !models_dir.exists() {
        return Ok(vec![]);
    }

    let catalog = added::all_models(models_dir);
    let mut result = Vec::new();
    let mut entries = fs::read_dir(models_dir).await.map_err(|e| e.to_string())?;

    while let Some(entry) = entries.next_entry().await.map_err(|e| e.to_string())? {
        let path = entry.path();
        if !path.is_dir() {
            continue;
        }

        let model_file = path.join("model.gguf");
        let part_file = path.join("model.gguf.part");

        // The GGUF is self-contained (weights, tokenizer and chat template),
        // and only appears under its final name once it has been verified.
        if model_file.exists() && !part_file.exists() {
            let dir_name = entry.file_name().to_string_lossy().to_string();
            if let Some(info) = catalog.iter().find(|m| m.id == dir_name) {
                let actual_size = fs::metadata(&model_file)
                    .await
                    .map(|m| m.len())
                    .unwrap_or(info.size_bytes);

                result.push(DownloadedModel {
                    id: info.id.clone(),
                    name: info.name.clone(),
                    size_bytes: actual_size,
                    size_label: info.size_label.clone(),
                    tag: info.tag.clone(),
                });
            }
        }
    }

    Ok(result)
}

/// Reject ids that are neither catalog entries nor added models. The id is
/// joined onto the models directory, so an unchecked value such as `..`
/// would resolve outside it.
pub fn require_known_id(models_dir: &Path, model_id: &str) -> Result<(), String> {
    if added::all_models(models_dir).iter().any(|m| m.id == model_id) {
        Ok(())
    } else {
        Err(format!("Unknown model: {}", model_id))
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PartialDownload {
    pub id: String,
    pub name: String,
    pub size_label: String,
    pub total_bytes: u64,
    pub downloaded_bytes: u64,
}

/// Interrupted downloads left on disk (a `.part` file). Lets the UI offer
/// "resume" after a restart.
pub async fn get_partial_downloads(models_dir: &Path) -> Result<Vec<PartialDownload>, String> {
    let mut result = Vec::new();
    if !models_dir.exists() {
        return Ok(result);
    }
    for info in added::all_models(models_dir) {
        let dir = models_dir.join(&info.id);
        let part = dir.join("model.gguf.part");
        if !part.exists() {
            continue;
        }
        let downloaded = fs::metadata(&part).await.map(|m| m.len()).unwrap_or(0);
        result.push(PartialDownload {
            id: info.id.clone(),
            name: info.name.clone(),
            size_label: info.size_label.clone(),
            total_bytes: info.size_bytes.max(downloaded),
            downloaded_bytes: downloaded,
        });
    }
    Ok(result)
}

/// Delete a model's files. An added model is forgotten as well, so it
/// leaves no trace once deleted or once its download is cancelled.
pub async fn delete_model(models_dir: &Path, model_id: &str) -> Result<(), String> {
    require_known_id(models_dir, model_id)?;
    let model_dir = models_dir.join(model_id);
    if model_dir.exists() {
        remove_model_dir(&model_dir).await?;
    }
    added::remove(models_dir, model_id)
}

/// Remove a model's folder. On Windows a model that was just unloaded can
/// stay mapped for a while (seen for over a minute): its file is then only
/// marked for deletion and the folder can't be removed yet (os error 32).
/// Once the model files themselves are gone the model is deleted as far as
/// anyone can tell, so an empty folder left behind is not an error; it is
/// removed by a later delete or left as harmless clutter.
async fn remove_model_dir(dir: &Path) -> Result<(), String> {
    let mut last_error = None;
    for attempt in 0..4u64 {
        match fs::remove_dir_all(dir).await {
            Ok(()) => return Ok(()),
            Err(e) if e.kind() == std::io::ErrorKind::NotFound => return Ok(()),
            Err(e) => last_error = Some(e),
        }
        tokio::time::sleep(std::time::Duration::from_millis(150 * (attempt + 1))).await;
    }
    let files_left = ["model.gguf", "model.gguf.part"].iter().any(|f| dir.join(f).exists());
    if !files_left {
        if let Some(e) = last_error {
            log::warn!("Model files deleted; their folder {:?} is still in use: {}", dir, e);
        }
        return Ok(());
    }
    Err("Couldn't delete this model because it is still in use. Wait a moment and try again.".to_string())
}
