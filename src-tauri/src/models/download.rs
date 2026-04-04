use std::path::PathBuf;
use std::time::Instant;

use log::{info, warn};
use serde::{Deserialize, Serialize};
use tauri::ipc::Channel;
use tokio::fs;
use tokio::io::AsyncWriteExt;
use tokio_util::sync::CancellationToken;

use super::catalog::ModelInfo;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "event", content = "data")]
pub enum DownloadEvent {
    Started { total_bytes: u64 },
    Progress { bytes_downloaded: u64, total_bytes: u64, speed_bps: u64 },
    Finished,
    Failed { error: String },
    Cancelled,
}

pub async fn download_model_files(
    model: &ModelInfo,
    models_dir: PathBuf,
    channel: &Channel<DownloadEvent>,
    cancel_token: CancellationToken,
) -> Result<(), String> {
    let model_dir = models_dir.join(&model.id);
    fs::create_dir_all(&model_dir).await.map_err(|e| e.to_string())?;

    let client = reqwest::Client::new();

    let model_url = format!(
        "https://huggingface.co/{}/resolve/main/{}",
        model.hf_repo, model.hf_filename
    );

    info!("Downloading model from: {}", model_url);

    let part_path = model_dir.join("model.gguf.part");
    let final_path = model_dir.join("model.gguf");

    // Resume support: check if .part file exists and get its size
    let mut existing_bytes: u64 = 0;
    if part_path.exists() {
        if let Ok(meta) = fs::metadata(&part_path).await {
            existing_bytes = meta.len();
            info!("Resuming download from {} bytes", existing_bytes);
        }
    }

    let mut request = client.get(&model_url);
    if existing_bytes > 0 {
        request = request.header("Range", format!("bytes={}-", existing_bytes));
    }

    let response = request
        .send()
        .await
        .map_err(|e| format!("Network error: {}", e))?;

    if !response.status().is_success() && response.status().as_u16() != 206 {
        let status = response.status();
        return Err(format!("Download failed: HTTP {}", status));
    }

    let is_resumed = response.status().as_u16() == 206;
    let total_bytes = if is_resumed {
        existing_bytes + response.content_length().unwrap_or(model.size_bytes - existing_bytes)
    } else {
        existing_bytes = 0;
        response.content_length().unwrap_or(model.size_bytes)
    };

    let _ = channel.send(DownloadEvent::Started { total_bytes });

    let mut file = if is_resumed && existing_bytes > 0 {
        tokio::fs::OpenOptions::new()
            .append(true)
            .open(&part_path)
            .await
            .map_err(|e| format!("Failed to open part file: {}", e))?
    } else {
        fs::File::create(&part_path)
            .await
            .map_err(|e| format!("Failed to create file: {}", e))?
    };

    let mut downloaded: u64 = existing_bytes;
    let start = Instant::now();
    let mut last_update = Instant::now();

    // Send initial progress for resumed downloads
    if existing_bytes > 0 {
        let _ = channel.send(DownloadEvent::Progress {
            bytes_downloaded: downloaded,
            total_bytes,
            speed_bps: 0,
        });
    }

    let mut response = response;

    loop {
        if cancel_token.is_cancelled() {
            drop(file);
            // Keep .part file for resume — don't delete
            let _ = channel.send(DownloadEvent::Cancelled);
            return Ok(());
        }

        match response.chunk().await {
            Ok(Some(chunk)) => {
                file.write_all(&chunk)
                    .await
                    .map_err(|e| format!("Write error: {}", e))?;
                downloaded += chunk.len() as u64;

                if last_update.elapsed().as_millis() >= 150 {
                    let new_bytes = downloaded - existing_bytes;
                    let elapsed = start.elapsed().as_secs_f64();
                    let speed = if elapsed > 0.0 {
                        (new_bytes as f64 / elapsed) as u64
                    } else {
                        0
                    };
                    let _ = channel.send(DownloadEvent::Progress {
                        bytes_downloaded: downloaded,
                        total_bytes,
                        speed_bps: speed,
                    });
                    last_update = Instant::now();
                }
            }
            Ok(None) => break,
            Err(e) => {
                drop(file);
                // Keep .part file for resume — don't delete
                let _ = channel.send(DownloadEvent::Failed {
                    error: e.to_string(),
                });
                return Err(format!("Download error: {}", e));
            }
        }
    }

    file.flush().await.map_err(|e| e.to_string())?;
    drop(file);
    fs::rename(&part_path, &final_path)
        .await
        .map_err(|e| format!("Failed to finalize file: {}", e))?;

    info!("Model file downloaded: {:?}", final_path);

    // Try to download tokenizer (non-fatal if it fails — gated repos)
    let tokenizer_url = format!(
        "https://huggingface.co/{}/resolve/main/tokenizer.json",
        model.tokenizer_repo
    );
    let tokenizer_path = model_dir.join("tokenizer.json");

    match client.get(&tokenizer_url).send().await {
        Ok(resp) if resp.status().is_success() => {
            if let Ok(bytes) = resp.bytes().await {
                let _ = fs::write(&tokenizer_path, &bytes).await;
                info!("Tokenizer downloaded: {:?}", tokenizer_path);
            }
        }
        _ => {
            warn!("Could not download tokenizer from {} — will extract from GGUF later", tokenizer_url);
        }
    }

    let _ = channel.send(DownloadEvent::Finished);
    Ok(())
}
