use std::collections::HashSet;

use chrono::Utc;
use serde::{Deserialize, Serialize};
use serde_json::{json, Map};
use tauri::{AppHandle, Manager};

use crate::characters::Character;
use crate::chat::storage::{self, Conversation};
use crate::settings;

const BACKUP_KIND: &str = "neurix.backup";
const BACKUP_VERSION: u32 = 1;

/// Everything a user would want to carry to another device: their chats and
/// their custom characters. Models are not included — they are large and can
/// be downloaded again.
#[derive(Debug, Serialize, Deserialize)]
pub struct Backup {
    pub kind: String,
    pub version: u32,
    pub exported_at: String,
    #[serde(default)]
    pub custom_characters: Vec<Character>,
    #[serde(default)]
    pub conversations: Vec<Conversation>,
}

#[derive(Debug, Serialize)]
pub struct ImportSummary {
    pub conversations: usize,
    pub characters: usize,
}

#[tauri::command]
pub async fn export_data(app: AppHandle) -> Result<Backup, String> {
    let chats_dir =
        storage::get_chats_dir(&app.path().app_local_data_dir().map_err(|e| e.to_string())?)
            .await?;
    Ok(Backup {
        kind: BACKUP_KIND.to_string(),
        version: BACKUP_VERSION,
        exported_at: Utc::now().to_rfc3339(),
        custom_characters: settings::load(&app)?.custom_characters,
        conversations: storage::load_all(&chats_dir).await?,
    })
}

/// Merge a backup into this device. Existing chats and characters with the
/// same id are replaced; everything else is left alone.
#[tauri::command]
pub async fn import_data(app: AppHandle, backup: Backup) -> Result<ImportSummary, String> {
    if backup.kind != BACKUP_KIND {
        return Err("This file is not a Neurix backup.".to_string());
    }
    if backup.version != BACKUP_VERSION {
        return Err(format!(
            "Unsupported backup version ({}). Update Neurix to import it.",
            backup.version
        ));
    }

    let chats_dir =
        storage::get_chats_dir(&app.path().app_local_data_dir().map_err(|e| e.to_string())?)
            .await?;

    let mut conversations = 0;
    for conv in &backup.conversations {
        // Ids are validated inside save; a bad entry is skipped, not fatal.
        if storage::save_conversation(&chats_dir, conv).await.is_ok() {
            conversations += 1;
        }
    }

    let incoming: Vec<Character> = backup
        .custom_characters
        .into_iter()
        .filter(|c| c.id.starts_with("custom:"))
        .collect();
    let characters = incoming.len();
    if characters > 0 {
        let incoming_ids: HashSet<&str> = incoming.iter().map(|c| c.id.as_str()).collect();
        let mut merged: Vec<Character> = settings::load(&app)?
            .custom_characters
            .into_iter()
            .filter(|c| !incoming_ids.contains(c.id.as_str()))
            .collect();
        merged.extend(incoming.iter().cloned());
        let mut patch = Map::new();
        patch.insert("custom_characters".to_string(), json!(merged));
        settings::patch(&app, patch)?;
    }

    Ok(ImportSummary { conversations, characters })
}
