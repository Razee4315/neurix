use std::path::Path;

use serde::{Deserialize, Serialize};
use tokio::fs;

use super::catalog::{self, ModelInfo};

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

pub async fn delete_model(models_dir: &Path, model_id: &str) -> Result<(), String> {
    let model_dir = models_dir.join(model_id);
    if model_dir.exists() {
        fs::remove_dir_all(&model_dir).await.map_err(|e| e.to_string())?;
    }
    Ok(())
}

pub fn get_model_info(model_id: &str) -> Option<ModelInfo> {
    catalog::get_catalog().into_iter().find(|m| m.id == model_id)
}
