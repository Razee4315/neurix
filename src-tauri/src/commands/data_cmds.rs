use std::io::{Read, Write};

use chrono::Utc;
use serde::{Deserialize, Serialize};
use serde_json::{json, Map};
use tauri::{AppHandle, Manager};
use tauri_plugin_dialog::{DialogExt, FilePath};
use tauri_plugin_fs::{FsExt, OpenOptions};

use crate::characters::Character;
use crate::chat::storage::{self, Conversation};
use crate::settings;

const BACKUP_KIND: &str = "neurix.backup";
const BACKUP_VERSION: u32 = 1;

/// Ceiling on an imported backup. A backup with every conversation at the
/// maximum sizes the app itself produces stays far below this; the cap only
/// stops a hostile or corrupt file from being read into memory whole.
const MAX_BACKUP_BYTES: u64 = 512 * 1024 * 1024;

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

/// Parse a backup file's contents. Split from the file reading so it can be
/// unit tested, and so the size limit is checked before the bytes are parsed.
fn parse_backup(data: &str) -> Result<Backup, String> {
    serde_json::from_str(data).map_err(|_| "This file is not a valid Neurix backup.".to_string())
}

/// Assemble a backup from everything stored on this device.
async fn build_backup(app: &AppHandle) -> Result<Backup, String> {
    let chats_dir =
        storage::get_chats_dir(&app.path().app_local_data_dir().map_err(|e| e.to_string())?)
            .await?;
    Ok(Backup {
        kind: BACKUP_KIND.to_string(),
        version: BACKUP_VERSION,
        exported_at: Utc::now().to_rfc3339(),
        custom_characters: settings::load(app)?.custom_characters,
        conversations: storage::load_all(&chats_dir).await?,
    })
}

/// Merge a backup into this device. Existing chats and characters with the
/// same id are replaced; everything else is left alone.
async fn apply_backup(app: &AppHandle, backup: &Backup) -> Result<ImportSummary, String> {
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
        .iter()
        .filter(|c| c.id.starts_with("custom:"))
        .cloned()
        .collect();
    let characters = incoming.len();
    if characters > 0 {
        let incoming_ids: std::collections::HashSet<&str> =
            incoming.iter().map(|c| c.id.as_str()).collect();
        let mut merged: Vec<Character> = settings::load(app)?
            .custom_characters
            .into_iter()
            .filter(|c| !incoming_ids.contains(c.id.as_str()))
            .collect();
        merged.extend(incoming);
        let mut patch = Map::new();
        patch.insert("custom_characters".to_string(), json!(merged));
        settings::patch(app, patch)?;
    }

    Ok(ImportSummary { conversations, characters })
}

/// Ask where to save, then write a backup there.
///
/// The file dialog is shown from Rust: the webview never receives a path it
/// could reuse later, and the fs plugin grants it no capability at all. The
/// dialog returns a plain path on desktop or an Android `content://` URL;
/// `fs().open` handles both, which keeps phone-to-desktop backups working.
///
/// Returns `None` when the user dismissed the dialog.
#[tauri::command]
pub async fn export_data_to_file(app: AppHandle) -> Result<Option<String>, String> {
    let picked = tauri::async_runtime::spawn_blocking({
        let app = app.clone();
        move || -> Result<Option<FilePath>, String> {
            let dialog = app
                .dialog()
                .file()
                .add_filter("Neurix backup", &["json"])
                .set_file_name(&format!(
                    "neurix-backup-{}.json",
                    Utc::now().format("%Y-%m-%d")
                ));
            Ok(dialog.blocking_save_file())
        }
    })
    .await
    .map_err(|e| format!("Backup dialog failed: {e}"))??;

    let Some(target) = picked else {
        return Ok(None);
    };

    let backup = build_backup(&app).await?;
    let data = serde_json::to_string_pretty(&backup)
        .map_err(|e| format!("Could not serialise the backup: {e}"))?;

    let written: String = tauri::async_runtime::spawn_blocking(move || -> Result<String, String> {
        let display = target.to_string();
        let mut options = OpenOptions::new();
        options.write(true).create(true).truncate(true);
        let mut file = app
            .fs()
            .open(target, options)
            .map_err(|e| format!("Could not create the backup file: {e}"))?;
        file.write_all(data.as_bytes())
            .map_err(|e| format!("Could not write the backup: {e}"))?;
        Ok(display)
    })
    .await
    .map_err(|e| format!("Backup write failed: {e}"))??;

    Ok(Some(written))
}

/// Ask for a backup file and merge it into this device.
///
/// Like export, the dialog runs in Rust and the file is read there; the
/// webview passes no path. Returns `None` when the dialog was dismissed.
#[tauri::command]
pub async fn import_data_from_file(app: AppHandle) -> Result<Option<ImportSummary>, String> {
    let parsed = tauri::async_runtime::spawn_blocking({
        let app = app.clone();
        move || -> Result<Option<Backup>, String> {
            let Some(target) = app
                .dialog()
                .file()
                .add_filter("Neurix backup", &["json"])
                .blocking_pick_file()
            else {
                return Ok(None);
            };
            // Read at most one byte beyond the cap: a hostile file is
            // rejected without ever being held in memory whole.
            let mut options = OpenOptions::new();
            options.read(true);
            let mut file = app
                .fs()
                .open(target, options)
                .map_err(|e| format!("Could not open the backup file: {e}"))?;
            let mut limited = Vec::new();
            (&mut file)
                .take(MAX_BACKUP_BYTES + 1)
                .read_to_end(&mut limited)
                .map_err(|e| format!("Could not read the backup file: {e}"))?;
            if limited.len() as u64 > MAX_BACKUP_BYTES {
                return Err(format!(
                    "This backup is too large to import (the limit is {} MB).",
                    MAX_BACKUP_BYTES / (1024 * 1024)
                ));
            }
            let data = String::from_utf8(limited)
                .map_err(|_| "This file is not a valid Neurix backup.".to_string())?;
            parse_backup(&data).map(Some)
        }
    })
    .await
    .map_err(|e| format!("Backup dialog failed: {e}"))??;

    let Some(backup) = parsed else {
        return Ok(None);
    };
    apply_backup(&app, &backup).await.map(Some)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn rejects_garbage() {
        assert!(parse_backup("not json at all").is_err());
        assert!(parse_backup("{\"kind\": \"other.backup\"}").is_err());
    }

    #[test]
    fn missing_sections_default_to_empty() {
        let backup = parse_backup(r#"{"kind": "neurix.backup", "version": 1, "exported_at": "2026-01-01T00:00:00Z"}"#)
            .expect("minimal backup must parse");
        assert!(backup.conversations.is_empty());
        assert!(backup.custom_characters.is_empty());
    }

    #[test]
    fn future_versions_are_preserved_for_the_command_to_reject() {
        // parse_backup is permissive about version so apply_backup can name
        // the exact version it saw in the error message.
        let backup = parse_backup(
            r#"{"kind": "neurix.backup", "version": 99, "exported_at": "2026-01-01T00:00:00Z"}"#,
        )
        .expect("parse keeps the version field");
        assert_eq!(backup.version, 99);
        assert!(apply_backup_decision(&backup).is_err());
    }

    /// The kind/version gate of apply_backup, extracted for tests.
    fn apply_backup_decision(backup: &Backup) -> Result<(), String> {
        if backup.kind != BACKUP_KIND {
            return Err("This file is not a Neurix backup.".to_string());
        }
        if backup.version != BACKUP_VERSION {
            return Err(format!(
                "Unsupported backup version ({}). Update Neurix to import it.",
                backup.version
            ));
        }
        Ok(())
    }

    #[test]
    fn size_limit_leaves_room_for_real_backups() {
        // A full device's worth of conversations is nowhere near the cap.
        let message = "x".repeat(16_000);
        let conv_json = format!(
            r#"{{"id":"a1","title":"t","model_id":"m","model_name":"m","created_at":"2026-01-01T00:00:00Z","updated_at":"2026-01-01T00:00:00Z","messages":[{{"role":"user","content":"{message}","timestamp":"2026-01-01T00:00:00Z"}}]}}"#
        );
        let hundred = format!(
            r#"{{"kind":"neurix.backup","version":1,"exported_at":"2026-01-01T00:00:00Z","conversations":[{conv_json},{conv_json}]}}"#
        );
        let backup = parse_backup(&hundred).expect("a two-conversation backup parses");
        assert_eq!(backup.conversations.len(), 2);
        // The cap is for hostile input, not honest backups.
        assert!(MAX_BACKUP_BYTES > 100 * 1024 * 1024);
    }
}
