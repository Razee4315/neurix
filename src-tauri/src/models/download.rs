use std::path::{Path, PathBuf};
use std::time::{Duration, Instant};

use log::{info, warn};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use tauri::ipc::Channel;
use tokio::fs;
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio_util::sync::CancellationToken;

use super::catalog::ModelInfo;

/// How long to wait for a connection before giving up.
const CONNECT_TIMEOUT: Duration = Duration::from_secs(20);
/// How long a transfer may deliver no data before it counts as stalled.
/// Without this a dead connection shows "downloading" forever.
const READ_TIMEOUT: Duration = Duration::from_secs(45);
const PROGRESS_INTERVAL_MS: u128 = 250;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "event", content = "data")]
pub enum DownloadEvent {
    Started { total_bytes: u64 },
    Progress { bytes_downloaded: u64, total_bytes: u64, speed_bps: u64 },
    /// The transfer is complete and the file is being checked.
    Verifying,
    Finished,
    Failed { error: String },
    Cancelled,
}

/// Report a failure to the UI and return it as the command error.
fn fail(channel: &Channel<DownloadEvent>, error: String) -> Result<(), String> {
    let _ = channel.send(DownloadEvent::Failed { error: error.clone() });
    Err(error)
}

/// Pull a SHA-256 out of an ETag-style header, if that is what it holds.
/// HuggingFace serves LFS files with the content hash as the ETag.
fn sha256_from_header(value: &str) -> Option<String> {
    let trimmed = value.trim().trim_start_matches("W/").trim_matches('"');
    if trimmed.len() == 64 && trimmed.bytes().all(|b| b.is_ascii_hexdigit()) {
        Some(trimmed.to_ascii_lowercase())
    } else {
        None
    }
}

fn expected_sha256(response: &reqwest::Response) -> Option<String> {
    ["x-linked-etag", "etag"].iter().find_map(|name| {
        response
            .headers()
            .get(*name)
            .and_then(|v| v.to_str().ok())
            .and_then(sha256_from_header)
    })
}

async fn file_sha256(path: PathBuf) -> Result<String, String> {
    tokio::task::spawn_blocking(move || {
        use std::io::Read;
        let mut file = std::fs::File::open(&path)
            .map_err(|e| format!("Cannot read downloaded file: {}", e))?;
        let mut hasher = Sha256::new();
        let mut buf = vec![0u8; 1024 * 1024];
        loop {
            let n = file
                .read(&mut buf)
                .map_err(|e| format!("Cannot read downloaded file: {}", e))?;
            if n == 0 {
                break;
            }
            hasher.update(&buf[..n]);
        }
        Ok(format!("{:x}", hasher.finalize()))
    })
    .await
    .map_err(|e| format!("Checksum task failed: {}", e))?
}

pub async fn download_model_files(
    model: &ModelInfo,
    models_dir: PathBuf,
    channel: &Channel<DownloadEvent>,
    cancel_token: CancellationToken,
) -> Result<(), String> {
    let model_dir = models_dir.join(&model.id);
    fs::create_dir_all(&model_dir).await.map_err(|e| e.to_string())?;

    let client = reqwest::Client::builder()
        .connect_timeout(CONNECT_TIMEOUT)
        .read_timeout(READ_TIMEOUT)
        .build()
        .map_err(|e| format!("Could not start download: {}", e))?;

    let part_path = model_dir.join("model.gguf.part");
    let final_path = model_dir.join("model.gguf");

    // The weights may already be in place from an earlier run whose tokenizer
    // download failed. In that case only the tokenizer is fetched.
    if !final_path.exists() {
        match download_weights(model, &client, &part_path, &final_path, channel, &cancel_token)
            .await?
        {
            Outcome::Completed => {}
            Outcome::Cancelled => return Ok(()),
        }
    }

    if cancel_token.is_cancelled() {
        let _ = channel.send(DownloadEvent::Cancelled);
        return Ok(());
    }

    if let Err(e) = download_tokenizer(model, &client, &model_dir).await {
        // Without a tokenizer the model cannot load. Report failure instead
        // of success; the weights stay on disk so the retry is a few MB.
        return fail(channel, e);
    }

    let _ = channel.send(DownloadEvent::Finished);
    Ok(())
}

enum Outcome {
    Completed,
    Cancelled,
}

async fn download_weights(
    model: &ModelInfo,
    client: &reqwest::Client,
    part_path: &Path,
    final_path: &Path,
    channel: &Channel<DownloadEvent>,
    cancel_token: &CancellationToken,
) -> Result<Outcome, String> {
    let model_url = format!(
        "https://huggingface.co/{}/resolve/main/{}",
        model.hf_repo, model.hf_filename
    );
    info!("Downloading model from: {}", model_url);

    // Resume support: check if .part file exists and get its size
    let mut existing_bytes: u64 = 0;
    if part_path.exists() {
        if let Ok(meta) = fs::metadata(part_path).await {
            existing_bytes = meta.len();
            info!("Resuming download from {} bytes", existing_bytes);
        }
    }

    let mut request = client.get(&model_url);
    if existing_bytes > 0 {
        request = request.header("Range", format!("bytes={}-", existing_bytes));
    }

    let response = match request.send().await {
        Ok(r) => r,
        Err(e) => return fail(channel, format!("Network error: {}", e)).map(|_| Outcome::Completed),
    };

    let status = response.status().as_u16();
    let expected_hash = expected_sha256(&response);

    // 416 = "range not satisfiable": the partial file already holds every
    // byte (the app was closed between the last chunk and the rename).
    // Skip the transfer and go straight to verification.
    let already_complete = status == 416 && existing_bytes > 0;

    if !already_complete && !response.status().is_success() {
        return fail(channel, format!("Download failed: HTTP {}", response.status()))
            .map(|_| Outcome::Completed);
    }

    let is_resumed = status == 206;
    let total_bytes = if already_complete {
        existing_bytes
    } else if is_resumed {
        existing_bytes
            + response
                .content_length()
                .unwrap_or_else(|| model.size_bytes.saturating_sub(existing_bytes))
    } else {
        // Server ignored the range request: start over.
        existing_bytes = 0;
        response.content_length().unwrap_or(model.size_bytes)
    };

    let _ = channel.send(DownloadEvent::Started { total_bytes });

    if !already_complete {
        let mut file = if is_resumed && existing_bytes > 0 {
            tokio::fs::OpenOptions::new()
                .append(true)
                .open(part_path)
                .await
                .map_err(|e| format!("Failed to open part file: {}", e))?
        } else {
            fs::File::create(part_path)
                .await
                .map_err(|e| format!("Failed to create file: {}", e))?
        };

        let mut downloaded: u64 = existing_bytes;
        let mut last_update = Instant::now();
        let mut bytes_at_last_update = downloaded;
        // Smoothed recent speed, so the readout and ETA follow the current
        // connection instead of the average since the download began.
        let mut speed_bps: f64 = 0.0;

        if existing_bytes > 0 {
            let _ = channel.send(DownloadEvent::Progress {
                bytes_downloaded: downloaded,
                total_bytes,
                speed_bps: 0,
            });
        }

        let mut response = response;

        loop {
            let chunk = tokio::select! {
                _ = cancel_token.cancelled() => {
                    let _ = file.flush().await;
                    drop(file);
                    // Keep the .part file so the download can resume.
                    let _ = channel.send(DownloadEvent::Cancelled);
                    return Ok(Outcome::Cancelled);
                }
                chunk = response.chunk() => chunk,
            };

            match chunk {
                Ok(Some(chunk)) => {
                    if let Err(e) = file.write_all(&chunk).await {
                        drop(file);
                        return fail(channel, format!("Could not write to storage: {}", e))
                            .map(|_| Outcome::Completed);
                    }
                    downloaded += chunk.len() as u64;

                    let elapsed = last_update.elapsed();
                    if elapsed.as_millis() >= PROGRESS_INTERVAL_MS {
                        let instant =
                            (downloaded - bytes_at_last_update) as f64 / elapsed.as_secs_f64();
                        speed_bps = if speed_bps == 0.0 {
                            instant
                        } else {
                            speed_bps * 0.7 + instant * 0.3
                        };
                        let _ = channel.send(DownloadEvent::Progress {
                            bytes_downloaded: downloaded,
                            total_bytes,
                            speed_bps: speed_bps as u64,
                        });
                        last_update = Instant::now();
                        bytes_at_last_update = downloaded;
                    }
                }
                Ok(None) => break,
                Err(e) => {
                    let _ = file.flush().await;
                    drop(file);
                    // Keep the .part file so the download can resume.
                    let message = if e.is_timeout() {
                        "The connection stalled. Check your network and resume.".to_string()
                    } else {
                        format!("Download interrupted: {}", e)
                    };
                    return fail(channel, message).map(|_| Outcome::Completed);
                }
            }
        }

        file.flush().await.map_err(|e| e.to_string())?;
        drop(file);
    }

    let _ = channel.send(DownloadEvent::Verifying);

    // Verify the .part file before renaming:
    //   1. Size — partial download or a lying content-length.
    //   2. Magic bytes — the response was actually HTML (404 page, Cloudflare
    //      error, gated-repo redirect) and not a GGUF file.
    //   3. SHA-256 — when the server told us the content hash.
    let mut verdict = verify_gguf(part_path, total_bytes).await;
    if verdict.is_ok() {
        if let Some(expected) = expected_hash {
            match file_sha256(part_path.to_path_buf()).await {
                Ok(actual) if actual == expected => info!("Checksum verified"),
                Ok(_) => {
                    verdict = Err(
                        "The downloaded file is corrupt (checksum mismatch). Please download it again."
                            .to_string(),
                    )
                }
                Err(e) => verdict = Err(e),
            }
        } else {
            warn!("Server sent no content hash; skipping checksum verification");
        }
    }
    if let Err(e) = verdict {
        // Delete the bad .part so the next attempt starts clean rather than
        // resuming a corrupt file.
        let _ = fs::remove_file(part_path).await;
        return fail(channel, e).map(|_| Outcome::Completed);
    }

    fs::rename(part_path, final_path)
        .await
        .map_err(|e| format!("Failed to finalize file: {}", e))?;

    info!("Model file downloaded: {:?}", final_path);
    Ok(Outcome::Completed)
}

/// Download the tokenizer — try the GGUF repo first (public), then the
/// original repo (may be gated).
async fn download_tokenizer(
    model: &ModelInfo,
    client: &reqwest::Client,
    model_dir: &Path,
) -> Result<(), String> {
    let tokenizer_path = model_dir.join("tokenizer.json");
    let tokenizer_urls = [
        format!("https://huggingface.co/{}/resolve/main/tokenizer.json", model.hf_repo),
        format!("https://huggingface.co/{}/resolve/main/tokenizer.json", model.tokenizer_repo),
    ];

    for url in &tokenizer_urls {
        info!("Trying tokenizer from: {}", url);
        let bytes = match client.get(url).send().await {
            Ok(resp) if resp.status().is_success() => match resp.bytes().await {
                Ok(bytes) => bytes,
                Err(_) => continue,
            },
            _ => {
                warn!("Tokenizer not available at: {}", url);
                continue;
            }
        };
        // A tokenizer is JSON; anything else is an error page.
        if serde_json::from_slice::<serde_json::Value>(&bytes).is_err() {
            warn!("Tokenizer at {} is not valid JSON", url);
            continue;
        }
        fs::write(&tokenizer_path, &bytes)
            .await
            .map_err(|e| format!("Could not save tokenizer: {}", e))?;
        info!("Tokenizer downloaded from: {}", url);
        return Ok(());
    }

    Err("The model downloaded but its tokenizer could not be fetched. \
         Retry to finish — the model file itself will not be downloaded again."
        .to_string())
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

#[cfg(test)]
mod tests {
    use super::sha256_from_header;

    #[test]
    fn extracts_quoted_sha256() {
        let hash = "a".repeat(64);
        assert_eq!(sha256_from_header(&format!("\"{}\"", hash)), Some(hash.clone()));
        assert_eq!(sha256_from_header(&format!("W/\"{}\"", hash)), Some(hash));
    }

    #[test]
    fn ignores_non_hash_etags() {
        assert_eq!(sha256_from_header("\"abc123\""), None);
        assert_eq!(sha256_from_header(&"z".repeat(64)), None);
    }
}
