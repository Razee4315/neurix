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
    pub updated_at: String,
}

pub async fn get_chats_dir(base: &Path) -> Result<std::path::PathBuf, String> {
    let dir = base.join("chats");
    fs::create_dir_all(&dir).await.map_err(|e| e.to_string())?;
    Ok(dir)
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
    let path = chats_dir.join(format!("{}.json", id));
    if !path.exists() {
        return Ok(None);
    }
    let data = fs::read_to_string(&path).await.map_err(|e| e.to_string())?;
    let conv = serde_json::from_str(&data).map_err(|e| e.to_string())?;
    Ok(Some(conv))
}

pub async fn save_conversation(chats_dir: &Path, conversation: &Conversation) -> Result<(), String> {
    fs::create_dir_all(chats_dir).await.map_err(|e| e.to_string())?;
    let path = chats_dir.join(format!("{}.json", conversation.id));
    let data = serde_json::to_string_pretty(conversation).map_err(|e| e.to_string())?;
    fs::write(&path, data).await.map_err(|e| e.to_string())?;
    Ok(())
}

pub async fn delete_conversation(chats_dir: &Path, id: &str) -> Result<(), String> {
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
