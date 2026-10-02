use std::path::Path;

use serde::{Deserialize, Serialize};
use tokio::fs;

use super::catalog;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DownloadedModel {
    pub id: String,
    pub name: String,
    pub size_bytes: u64,
    pub size_label: String,
    pub tag: String,
}

pub async fn get_downloaded_models(models_dir: &Path) -> Result<Vec<DownloadedModel>, String> {
    let catalog = catalog::get_catalog();

    if !models_dir.exists() {
        return Ok(vec![]);
    }

    let mut result = Vec::new();
    let mut entries = fs::read_dir(models_dir).await.map_err(|e| e.to_string())?;

    while let Some(entry) = entries.next_entry().await.map_err(|e| e.to_string())? {
        let path = entry.path();
        if !path.is_dir() {
            continue;
        }

        let model_file = path.join("model.gguf");
        let part_file = path.join("model.gguf.part");
        let tokenizer_file = path.join("tokenizer.json");

        // A model is only usable with both files. A directory holding the
        // GGUF but no tokenizer is an interrupted install: it stays out of
        // this list so the store offers the (now tiny) download again.
        if model_file.exists() && tokenizer_file.exists() && !part_file.exists() {
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

/// Reject ids that are not catalog entries. The id is joined onto the models
/// directory, so an unchecked value such as `..` would resolve outside it.
pub fn require_catalog_id(model_id: &str) -> Result<(), String> {
    if catalog::get_catalog().iter().any(|m| m.id == model_id) {
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

/// Interrupted downloads left on disk (a `.part` file, or a GGUF whose
/// tokenizer never arrived). Lets the UI offer "resume" after a restart.
pub async fn get_partial_downloads(models_dir: &Path) -> Result<Vec<PartialDownload>, String> {
    let mut result = Vec::new();
    if !models_dir.exists() {
        return Ok(result);
    }
    for info in catalog::get_catalog() {
        let dir = models_dir.join(&info.id);
        let part = dir.join("model.gguf.part");
        let model = dir.join("model.gguf");
        let tokenizer = dir.join("tokenizer.json");
        let downloaded = if part.exists() {
            fs::metadata(&part).await.map(|m| m.len()).unwrap_or(0)
        } else if model.exists() && !tokenizer.exists() {
            fs::metadata(&model).await.map(|m| m.len()).unwrap_or(0)
        } else {
            continue;
        };
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

pub async fn delete_model(models_dir: &Path, model_id: &str) -> Result<(), String> {
    require_catalog_id(model_id)?;
    let model_dir = models_dir.join(model_id);
    if model_dir.exists() {
        fs::remove_dir_all(&model_dir).await.map_err(|e| e.to_string())?;
    }
    Ok(())
}
