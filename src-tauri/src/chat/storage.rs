use std::path::Path;

use chrono::{DateTime, Utc};
use log::info;
use serde::{Deserialize, Serialize};
use tokio::fs;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Conversation {
    pub id: String,
    pub title: String,
    pub model_id: String,
    pub model_name: String,
    /// Character active when this conversation was last saved. Optional for
    /// back-compat with conversations stored before the field existed.
    #[serde(default)]
    pub character_id: Option<String>,
    #[serde(default)]
    pub character_name: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub messages: Vec<ChatMessage>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChatMessage {
    pub role: MessageRole,
    pub content: String,
    pub timestamp: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum MessageRole {
    User,
    Assistant,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConversationMeta {
    pub id: String,
    pub title: String,
    pub model_name: String,
    #[serde(default)]
    pub character_id: Option<String>,
    #[serde(default)]
    pub character_name: Option<String>,
    pub updated_at: String,
}

pub async fn get_chats_dir(base: &Path) -> Result<std::path::PathBuf, String> {
    let dir = base.join("chats");
    fs::create_dir_all(&dir).await.map_err(|e| e.to_string())?;
    Ok(dir)
}

/// Validate that a conversation id is a safe filename component.
///
/// The frontend always supplies UUIDs (or a few legacy hashes), but the id is
/// crossing a process boundary into the filesystem. Without this check, a
/// crafted id like `"../../etc/passwd"` would resolve outside the chats
/// directory in `chats_dir.join(format!("{id}.json"))`. We accept only
/// `[A-Za-z0-9_-]` and bound the length so an attacker can't smuggle path
/// separators, NUL bytes, or oversized filenames.
fn validate_id(id: &str) -> Result<(), String> {
    if id.is_empty() || id.len() > 128 {
        return Err("Invalid conversation id".into());
    }
    if !id
        .bytes()
        .all(|b| b.is_ascii_alphanumeric() || b == b'-' || b == b'_')
    {
        return Err("Invalid conversation id".into());
    }
    Ok(())
}

pub async fn list_conversations(chats_dir: &Path) -> Result<Vec<ConversationMeta>, String> {
    if !chats_dir.exists() {
        return Ok(vec![]);
    }

    let mut result = Vec::new();
    let mut entries = fs::read_dir(chats_dir).await.map_err(|e| e.to_string())?;

    while let Some(entry) = entries.next_entry().await.map_err(|e| e.to_string())? {
        let path = entry.path();
        if path.extension().and_then(|e| e.to_str()) == Some("json") {
            if let Ok(data) = fs::read_to_string(&path).await {
                if let Ok(conv) = serde_json::from_str::<Conversation>(&data) {
                    result.push(ConversationMeta {
                        id: conv.id,
                        title: conv.title,
                        model_name: conv.model_name,
                        character_id: conv.character_id,
                        character_name: conv.character_name,
                        updated_at: conv.updated_at.to_rfc3339(),
                    });
                }
            }
        }
    }

    result.sort_by(|a, b| b.updated_at.cmp(&a.updated_at));
    Ok(result)
}

pub async fn load_conversation(chats_dir: &Path, id: &str) -> Result<Option<Conversation>, String> {
    validate_id(id)?;
    let path = chats_dir.join(format!("{}.json", id));
    if !path.exists() {
        return Ok(None);
    }
    let data = fs::read_to_string(&path).await.map_err(|e| e.to_string())?;
    let conv = serde_json::from_str(&data).map_err(|e| e.to_string())?;
    Ok(Some(conv))
}

pub async fn save_conversation(chats_dir: &Path, conversation: &Conversation) -> Result<(), String> {
    validate_id(&conversation.id)?;
    fs::create_dir_all(chats_dir).await.map_err(|e| e.to_string())?;
    let path = chats_dir.join(format!("{}.json", conversation.id));
    let data = serde_json::to_string_pretty(conversation).map_err(|e| e.to_string())?;
    fs::write(&path, data).await.map_err(|e| e.to_string())?;
    Ok(())
}

pub async fn delete_conversation(chats_dir: &Path, id: &str) -> Result<(), String> {
    validate_id(id)?;
    let path = chats_dir.join(format!("{}.json", id));
    if path.exists() {
        fs::remove_file(&path).await.map_err(|e| e.to_string())?;
        info!("Deleted conversation: {}", id);
    }
    Ok(())
}

pub async fn clear_all(chats_dir: &Path) -> Result<(), String> {
    if chats_dir.exists() {
        fs::remove_dir_all(chats_dir).await.map_err(|e| e.to_string())?;
        fs::create_dir_all(chats_dir).await.map_err(|e| e.to_string())?;
        info!("Cleared all conversations");
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::validate_id;

    #[test]
    fn accepts_uuid() {
        assert!(validate_id("3f29c5d4-9c4e-4a7b-9a4c-1234567890ab").is_ok());
    }

    #[test]
    fn accepts_hex_and_underscore() {
        assert!(validate_id("abc_DEF-123").is_ok());
    }

    #[test]
    fn rejects_traversal() {
        assert!(validate_id("../../etc/passwd").is_err());
        assert!(validate_id("..").is_err());
        assert!(validate_id("a/b").is_err());
        assert!(validate_id("a\\b").is_err());
    }

    #[test]
    fn rejects_empty_and_oversized() {
        assert!(validate_id("").is_err());
        assert!(validate_id(&"a".repeat(129)).is_err());
    }

    #[test]
    fn rejects_nul_and_punctuation() {
        assert!(validate_id("abc\0").is_err());
        assert!(validate_id("a.b").is_err());
        assert!(validate_id("a b").is_err());
    }
}
