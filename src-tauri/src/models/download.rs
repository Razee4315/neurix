use std::path::{Path, PathBuf};
use std::time::Instant;

use log::{info, warn};
use serde::{Deserialize, Serialize};
use tauri::ipc::Channel;
use tokio::fs;
use tokio::io::{AsyncReadExt, AsyncWriteExt};
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

    // Verify the .part file before renaming. Two checks catch the common
    // failure modes:
    //   1. Size mismatch — partial download or content-length lied to us.
    //   2. Magic-byte check — the response was actually HTML (404 page,
    //      Cloudflare error, gated-repo redirect) and not a GGUF file.
    if let Err(e) = verify_gguf(&part_path, total_bytes).await {
        // Delete the bad .part so the user gets a fresh download next time
        // rather than resuming a corrupt file.
        let _ = fs::remove_file(&part_path).await;
        let _ = channel.send(DownloadEvent::Failed { error: e.clone() });
        return Err(e);
    }

    fs::rename(&part_path, &final_path)
        .await
        .map_err(|e| format!("Failed to finalize file: {}", e))?;

    info!("Model file downloaded: {:?}", final_path);

    // Download tokenizer — try GGUF repo first (public), then original repo (may be gated)
    let tokenizer_path = model_dir.join("tokenizer.json");
    let tokenizer_urls = [
        format!("https://huggingface.co/{}/resolve/main/tokenizer.json", model.hf_repo),
        format!("https://huggingface.co/{}/resolve/main/tokenizer.json", model.tokenizer_repo),
    ];

    let mut tokenizer_ok = false;
    for url in &tokenizer_urls {
        info!("Trying tokenizer from: {}", url);
        match client.get(url).send().await {
            Ok(resp) if resp.status().is_success() => {
                if let Ok(bytes) = resp.bytes().await {
                    let _ = fs::write(&tokenizer_path, &bytes).await;
                    info!("Tokenizer downloaded from: {}", url);
                    tokenizer_ok = true;
                    break;
                }
            }
            _ => {
                warn!("Tokenizer not available at: {}", url);
            }
        }
    }

    if !tokenizer_ok {
        warn!("Could not download tokenizer from any source");
    }

    let _ = channel.send(DownloadEvent::Finished);
    Ok(())
}

/// Verify a downloaded model file is valid by checking size + GGUF magic bytes.
/// Returns Err with a user-facing message if the file is not a usable GGUF.
async fn verify_gguf(path: &Path, expected_bytes: u64) -> Result<(), String> {
    let actual_bytes = fs::metadata(path)
        .await
        .map_err(|e| format!("Cannot stat downloaded file: {}", e))?
        .len();

    // Allow a small fudge factor — some servers report Content-Length slightly
    // off from the actual body. But anything more than ~1% off is suspicious.
    let tolerance = (expected_bytes / 100).max(1024);
    if actual_bytes + tolerance < expected_bytes {
        return Err(format!(
            "Download incomplete: got {} bytes, expected ~{}",
            actual_bytes, expected_bytes
        ));
    }

    let mut f = fs::File::open(path)
        .await
        .map_err(|e| format!("Cannot read downloaded file: {}", e))?;
    let mut magic = [0u8; 4];
    f.read_exact(&mut magic)
        .await
        .map_err(|e| format!("Cannot read file header: {}", e))?;

    // GGUF magic: "GGUF" (0x47 0x47 0x55 0x46). Older GGML files start with
    // "ggml"/"ggjt"/"ggla" — none of those work in this app, so reject them.
    if &magic != b"GGUF" {
        return Err(
            "Downloaded file is not a valid GGUF model (likely an HTML error page from \
             HuggingFace). Try again or check that the model is publicly available."
                .to_string(),
        );
    }

    Ok(())
}
