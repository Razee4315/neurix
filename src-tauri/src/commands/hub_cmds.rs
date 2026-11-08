//! "Add from Hugging Face": check a pasted link, then add one of its files
//! as a model the normal download flow can fetch.

use std::time::Duration;

use log::{info, warn};
use tauri::AppHandle;

use super::model_cmds::models_dir;
use super::settings_cmds::space_check_path;
use crate::device;
use crate::models::catalog::ModelInfo;
use crate::models::added;
use crate::models::hub::{self, ApiModel, HubModel, HF_ORIGIN};

/// The API answer for a repository with thousands of files is still well
/// under this; anything larger is not a normal answer.
const MAX_API_BYTES: usize = 16 * 1024 * 1024;
/// Enough of a GGUF to reach `general.architecture`, which comes first.
const HEADER_BYTES: usize = 1024 * 1024;
/// Free space to leave on top of the file itself.
const SPACE_HEADROOM: u64 = 500_000_000;

fn client() -> Result<reqwest::Client, String> {
    reqwest::Client::builder()
        .connect_timeout(Duration::from_secs(15))
        .timeout(Duration::from_secs(45))
        .https_only(true)
        .user_agent(concat!("Neurix/", env!("CARGO_PKG_VERSION")))
        .build()
        .map_err(|e| format!("Could not reach Hugging Face: {e}"))
}

const OFFLINE: &str = "Couldn't reach Hugging Face. Check your internet connection and try again.";

/// Read at most `limit` bytes of a response body.
async fn read_capped(mut response: reqwest::Response, limit: usize) -> Result<Vec<u8>, String> {
    let mut body = Vec::new();
    while let Some(chunk) = response.chunk().await.map_err(|_| OFFLINE.to_string())? {
        let room = limit - body.len();
        body.extend_from_slice(&chunk[..chunk.len().min(room)]);
        if body.len() >= limit {
            break;
        }
    }
    Ok(body)
}

async fn fetch_model(client: &reqwest::Client, repo: &str) -> Result<ApiModel, String> {
    if !hub::valid_repo(repo) {
        return Err("That link doesn't name a model.".to_string());
    }
    let url = format!("{HF_ORIGIN}/api/models/{repo}?blobs=true");
    let response = client.get(&url).send().await.map_err(|_| OFFLINE.to_string())?;
    match response.status().as_u16() {
        200 => {}
        401 | 403 | 404 => {
            return Err("Couldn't find that model on Hugging Face. Check the link; private models can't be added.".to_string())
        }
        429 => return Err("Hugging Face is busy right now. Wait a minute and try again.".to_string()),
        code => return Err(format!("Hugging Face answered with an error (HTTP {code}). Try again later.")),
    }
    let body = read_capped(response, MAX_API_BYTES).await?;
    serde_json::from_slice(&body).map_err(|e| {
        warn!("Unexpected answer from the Hugging Face API for {repo}: {e}");
        "Hugging Face sent an answer Neurix didn't understand. Try again later.".to_string()
    })
}

/// The architecture written in the file itself, read from its first bytes.
async fn file_architecture(client: &reqwest::Client, repo: &str, filename: &str) -> Result<Option<String>, String> {
    let url = format!("{HF_ORIGIN}/{repo}/resolve/main/{filename}");
    let response = client
        .get(&url)
        .header("Range", format!("bytes=0-{}", HEADER_BYTES - 1))
        .send()
        .await
        .map_err(|_| OFFLINE.to_string())?;
    if !response.status().is_success() {
        return Err(format!("Couldn't open that file on Hugging Face (HTTP {}).", response.status().as_u16()));
    }
    let head = read_capped(response, HEADER_BYTES).await?;
    hub::gguf_architecture(&head)
}

/// Check a pasted link and describe what it points at, or say plainly why
/// it can't be used.
#[tauri::command]
pub async fn inspect_hf_link(link: String) -> Result<HubModel, String> {
    let parsed = hub::parse_link(&link)?;
    let client = client()?;
    let model = fetch_model(&client, &parsed.repo).await?;
    hub::describe(&model, &parsed, device::total_memory_bytes())
}

/// Add one file of a repository as a model, after checking it again: the
/// repository, the file's size against this device and its free space, and
/// the architecture written in the file's own header. Returns the entry,
/// which the normal download flow then fetches and verifies.
#[tauri::command]
pub async fn add_hf_model(app: AppHandle, repo: String, filename: String) -> Result<ModelInfo, String> {
    if !hub::valid_filename(&filename) {
        return Err("That file can't be downloaded by Neurix.".to_string());
    }
    let client = client()?;
    let model = fetch_model(&client, &repo).await?;
    let ram = device::total_memory_bytes();
    // Check the API data first so a bad pick fails before any file request.
    hub::entry_for(&model, &filename, None, ram)?;

    let arch = file_architecture(&client, &model.id, &filename).await?;
    if arch.is_none() {
        warn!("Could not read the architecture of {}/{}", model.id, filename);
    }
    let entry = hub::entry_for(&model, &filename, arch.as_deref(), ram)?;

    let dir = models_dir(&app)?;
    let free = fs2::available_space(space_check_path(&app)?).map_err(|e| e.to_string())?;
    if free < entry.size_bytes.saturating_add(SPACE_HEADROOM) {
        return Err(format!(
            "Not enough free space: this model needs {} and {} is free.",
            entry.size_label,
            hub::size_label(free)
        ));
    }

    info!("Adding {} ({}/{})", entry.id, entry.hf_repo, entry.hf_filename);
    added::upsert(&dir, entry.clone())?;
    Ok(entry)
}
