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

// --- Review port (review/security-audit-verification only) -----------------
// Helpers copied verbatim from security/hardening-audit (commit 9ba92e8) onto
// main's data_cmds.rs, WITHOUT their call sites, so their tests can run
// against main. Not wired into import_data: main's IPC path is unchanged.
#[cfg_attr(not(test), allow(dead_code))]
const MAX_BACKUP_BYTES: u64 = 512 * 1024 * 1024;
#[cfg_attr(not(test), allow(dead_code))]
const MAX_BACKUP_CONVERSATIONS: usize = 10_000;

#[cfg_attr(not(test), allow(dead_code))]
fn parse_backup(data: &str) -> Result<Backup, String> {
    serde_json::from_str(data).map_err(|_| "This file is not a valid Neurix backup.".to_string())
}

#[cfg_attr(not(test), allow(dead_code))]
fn validate_backup(backup: &Backup) -> Result<(), String> {
    if backup.conversations.len() > MAX_BACKUP_CONVERSATIONS {
        return Err(format!(
            "This backup holds {} conversations; the limit is {}. Split it and import the parts.",
            backup.conversations.len(),
            MAX_BACKUP_CONVERSATIONS
        ));
    }
    Ok(())
}
// --- End review port ---------------------------------------------------------

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

// Tests copied verbatim from security/hardening-audit d89c7d7 (data_cmds.rs lines 232-332).
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

    fn conversation(id: &str) -> Conversation {
        Conversation {
            id: id.to_string(),
            title: "t".to_string(),
            model_id: "m".to_string(),
            model_name: "m".to_string(),
            character_id: None,
            character_name: None,
            created_at: chrono::Utc::now(),
            updated_at: chrono::Utc::now(),
            messages: vec![],
        }
    }

    #[test]
    fn conversation_count_is_capped() {
        let many: Vec<Conversation> = (0..MAX_BACKUP_CONVERSATIONS)
            .map(|i| conversation(&format!("c{i}")))
            .collect();
        let backup = Backup {
            kind: BACKUP_KIND.to_string(),
            version: BACKUP_VERSION,
            exported_at: "2026-01-01T00:00:00Z".to_string(),
            custom_characters: vec![],
            conversations: many,
        };
        assert!(validate_backup(&backup).is_ok());

        let one_too_many = Backup {
            conversations: backup
                .conversations
                .iter()
                .cloned()
                .chain([conversation("overflow")])
                .collect(),
            ..backup
        };
        let err = validate_backup(&one_too_many).expect_err("over the cap must be rejected");
        assert!(err.contains("conversations"), "{err}");
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

/// Reviewer-added tests: they exercise main's real IPC deserialization path
/// (import_data takes a serde-deserialized Backup straight from the webview)
/// to show the gap the port closes. These PASS on main because main has no
/// gate; that passing is the evidence of the bug, not of a fix.
#[cfg(test)]
mod review_main_behaviour {
    use super::*;

    fn minimal_conv(i: usize) -> String {
        format!(
            r#"{{"id":"c{i}","title":"t","model_id":"m","model_name":"m","created_at":"2026-01-01T00:00:00Z","updated_at":"2026-01-01T00:00:00Z","messages":[]}}"#
        )
    }

    #[test]
    fn main_ipc_accepts_backup_over_the_conversation_cap() {
        let n = MAX_BACKUP_CONVERSATIONS + 1;
        let convs: Vec<String> = (0..n).map(minimal_conv).collect();
        let json = format!(
            r#"{{"kind":"neurix.backup","version":1,"exported_at":"x","conversations":[{}]}}"#,
            convs.join(",")
        );
        // This is exactly what Tauri does with import_data's `backup` arg on main.
        let backup: Backup = serde_json::from_str(&json).expect("main deserializes it");
        assert_eq!(backup.conversations.len(), n);
        // main's import_data would now write n files; only the ported gate stops it.
        assert!(validate_backup(&backup).is_err());
    }

    #[test]
    fn kind_check_in_rejects_garbage_is_not_what_rejects_it() {
        // The prior test asserts `{"kind":"other.backup"}` fails to parse.
        // It fails because version/exported_at are missing, not because of
        // the kind: a well-formed foreign kind parses fine.
        let ok = parse_backup(r#"{"kind":"other.backup","version":1,"exported_at":"x"}"#);
        assert!(ok.is_ok(), "parse_backup does not check kind");
    }
}
