use std::fmt;
use std::io::{Read, Write};
use std::marker::PhantomData;

use chrono::Utc;
use serde::de::{self, Deserializer, SeqAccess, Visitor};
use serde::{Deserialize, Serialize};
use serde_json::{json, Map};
use tauri::{AppHandle, Manager, Wry};
use tauri_plugin_dialog::{DialogExt, FileDialogBuilder, FilePath};
use tauri_plugin_fs::{FsExt, OpenOptions};

use crate::characters::Character;
use crate::chat::storage::{self, Conversation};
use crate::settings;

const BACKUP_KIND: &str = "neurix.backup";
const BACKUP_VERSION: u32 = 1;

/// Ceiling on an imported backup. Real backups are text and stay far below
/// it. The file is held in memory while it is parsed, and parsed structs take
/// several times the bytes, so the cap is sized for a phone's memory.
const MAX_BACKUP_BYTES: u64 = 128 * 1024 * 1024;
/// Ceiling on how many conversations one backup may carry. Enforced while
/// parsing, so a file of millions of tiny records is refused before they are
/// all built in memory, not after.
const MAX_BACKUP_CONVERSATIONS: usize = 10_000;
/// Ceiling on characters in one backup. Settings keeps at most 100; this only
/// bounds what is parsed before that trim.
const MAX_BACKUP_CHARACTERS: usize = 1_000;
/// Prefix that marks a limit error raised during parsing, so it can be shown
/// to the user instead of the generic "not a valid backup".
const LIMIT_ERROR: &str = "backup limit: ";

/// Everything a user would want to carry to another device: their chats and
/// their custom characters. Models are not included — they are large and can
/// be downloaded again.
#[derive(Debug, Serialize, Deserialize)]
pub struct Backup {
    pub kind: String,
    pub version: u32,
    pub exported_at: String,
    #[serde(default, deserialize_with = "bounded_characters")]
    pub custom_characters: Vec<Character>,
    #[serde(default, deserialize_with = "bounded_conversations")]
    pub conversations: Vec<Conversation>,
}

/// Deserialize a list, failing as soon as it grows past `max` elements.
fn bounded_seq<'de, D, T>(
    deserializer: D,
    max: usize,
    what: &'static str,
) -> Result<Vec<T>, D::Error>
where
    D: Deserializer<'de>,
    T: Deserialize<'de>,
{
    struct Bounded<T> {
        max: usize,
        what: &'static str,
        marker: PhantomData<T>,
    }

    impl<'de, T: Deserialize<'de>> Visitor<'de> for Bounded<T> {
        type Value = Vec<T>;

        fn expecting(&self, f: &mut fmt::Formatter) -> fmt::Result {
            write!(f, "a list of at most {} {}", self.max, self.what)
        }

        fn visit_seq<A: SeqAccess<'de>>(self, mut seq: A) -> Result<Vec<T>, A::Error> {
            let mut items = Vec::new();
            while let Some(item) = seq.next_element()? {
                if items.len() == self.max {
                    return Err(de::Error::custom(format!(
                        "{LIMIT_ERROR}This backup holds more than {} {}, the limit. \
                         Split it and import the parts.",
                        self.max, self.what
                    )));
                }
                items.push(item);
            }
            Ok(items)
        }
    }

    deserializer.deserialize_seq(Bounded { max, what, marker: PhantomData })
}

fn bounded_conversations<'de, D: Deserializer<'de>>(d: D) -> Result<Vec<Conversation>, D::Error> {
    bounded_seq(d, MAX_BACKUP_CONVERSATIONS, "conversations")
}

fn bounded_characters<'de, D: Deserializer<'de>>(d: D) -> Result<Vec<Character>, D::Error> {
    bounded_seq(d, MAX_BACKUP_CHARACTERS, "characters")
}

#[derive(Debug, Serialize)]
pub struct ImportSummary {
    pub conversations: usize,
    pub characters: usize,
}

/// Parse a backup file's contents. Split from the file reading so it can be
/// unit tested, and so the size limit is checked before the bytes are parsed.
fn parse_backup(data: &str) -> Result<Backup, String> {
    serde_json::from_str(data).map_err(|e| {
        let message = e.to_string();
        match message.strip_prefix(LIMIT_ERROR) {
            // serde_json appends " at line L column C"; the user needs none of it.
            Some(limit) => limit.split(" at line ").next().unwrap_or(limit).to_string(),
            None => "This file is not a valid Neurix backup.".to_string(),
        }
    })
}

/// Reject a backup that is not ours or not a version this build can read.
/// Runs before anything is written.
fn check_header(backup: &Backup) -> Result<(), String> {
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
    check_header(backup)?;

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

/// A file dialog for backups, parented to the main window on desktop so it
/// stays in front of the app and modal to it, as the JS dialog was.
fn backup_dialog(app: &AppHandle) -> FileDialogBuilder<Wry> {
    let dialog = app.dialog().file().add_filter("Neurix backup", &["json"]);
    #[cfg(desktop)]
    {
        if let Some(window) = app.get_webview_window("main") {
            return dialog.set_parent(&window);
        }
    }
    dialog
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
            let dialog = backup_dialog(&app)
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
            let Some(target) = backup_dialog(&app).blocking_pick_file()
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
            let backup = parse_backup(&data)?;
            check_header(&backup)?;
            Ok(Some(backup))
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

    const HEADER: &str = r#""kind":"neurix.backup","version":1,"exported_at":"2026-01-01T00:00:00Z""#;

    fn minimal_conv(i: usize) -> String {
        format!(
            r#"{{"id":"c{i}","title":"t","model_id":"m","model_name":"m","created_at":"2026-01-01T00:00:00Z","updated_at":"2026-01-01T00:00:00Z","messages":[]}}"#
        )
    }

    fn backup_with(conversations: usize) -> String {
        let convs: Vec<String> = (0..conversations).map(minimal_conv).collect();
        format!(r#"{{{HEADER},"conversations":[{}]}}"#, convs.join(","))
    }

    #[test]
    fn rejects_text_that_is_not_a_backup() {
        assert!(parse_backup("not json at all").is_err());
        // Valid JSON, but missing the required header fields.
        assert!(parse_backup(r#"{"conversations": []}"#).is_err());
    }

    #[test]
    fn foreign_kind_parses_but_the_gate_refuses_it() {
        let backup = parse_backup(r#"{"kind":"other.backup","version":1,"exported_at":"x"}"#)
            .expect("well-formed JSON of another kind still parses");
        let err = check_header(&backup).expect_err("the gate refuses it");
        assert!(err.contains("not a Neurix backup"), "{err}");
    }

    #[test]
    fn future_version_is_refused_by_name() {
        let backup = parse_backup(r#"{"kind":"neurix.backup","version":99,"exported_at":"x"}"#)
            .expect("parse keeps the version field");
        let err = check_header(&backup).expect_err("version 99 is refused");
        assert!(err.contains("(99)"), "{err}");
    }

    #[test]
    fn current_header_passes_the_gate() {
        let backup = parse_backup(&format!("{{{HEADER}}}")).expect("minimal backup parses");
        assert!(check_header(&backup).is_ok());
        assert!(backup.conversations.is_empty());
        assert!(backup.custom_characters.is_empty());
    }

    #[test]
    fn conversation_count_is_capped_while_parsing() {
        let at_cap = parse_backup(&backup_with(MAX_BACKUP_CONVERSATIONS))
            .expect("exactly the cap is allowed");
        assert_eq!(at_cap.conversations.len(), MAX_BACKUP_CONVERSATIONS);

        let err = parse_backup(&backup_with(MAX_BACKUP_CONVERSATIONS + 1))
            .expect_err("one over the cap is refused");
        assert!(err.contains("more than 10000 conversations"), "{err}");
        assert!(!err.contains(" at line "), "parser position leaked: {err}");
    }

    #[test]
    fn character_count_is_capped_while_parsing() {
        let ch = r#"{"id":"custom:x","name":"n","description":"","icon":"school","system_prompt":"","temperature":0.7,"top_p":0.9,"max_tokens":512,"is_preset":false}"#;
        let many = vec![ch; MAX_BACKUP_CHARACTERS + 1].join(",");
        let err = parse_backup(&format!(r#"{{{HEADER},"custom_characters":[{many}]}}"#))
            .expect_err("over the character cap is refused");
        assert!(err.contains("characters"), "{err}");
    }
}
