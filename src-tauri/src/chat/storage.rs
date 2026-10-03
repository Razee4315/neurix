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
    /// Excerpt around a search hit inside a message. Only set by search.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub snippet: Option<String>,
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

/// The fields needed to list a conversation. Deserialising into this
/// instead of `Conversation` lets serde skip over the message bodies, so
/// listing does not allocate every message of every chat.
#[derive(Debug, Deserialize)]
struct ConversationHeader {
    id: String,
    title: String,
    model_name: String,
    #[serde(default)]
    character_id: Option<String>,
    #[serde(default)]
    character_name: Option<String>,
    created_at: DateTime<Utc>,
    updated_at: DateTime<Utc>,
}

impl ConversationHeader {
    fn into_meta(self, snippet: Option<String>) -> ConversationMeta {
        ConversationMeta {
            id: self.id,
            title: self.title,
            model_name: self.model_name,
            character_id: self.character_id,
            character_name: self.character_name,
            updated_at: self.updated_at.to_rfc3339(),
            snippet,
        }
    }
}

async fn read_json_files(chats_dir: &Path) -> Result<Vec<String>, String> {
    let mut files = Vec::new();
    if !chats_dir.exists() {
        return Ok(files);
    }
    let mut entries = fs::read_dir(chats_dir).await.map_err(|e| e.to_string())?;
    while let Some(entry) = entries.next_entry().await.map_err(|e| e.to_string())? {
        let path = entry.path();
        if path.extension().and_then(|e| e.to_str()) == Some("json") {
            if let Ok(data) = fs::read_to_string(&path).await {
                files.push(data);
            }
        }
    }
    Ok(files)
}

pub async fn list_conversations(chats_dir: &Path) -> Result<Vec<ConversationMeta>, String> {
    let mut result: Vec<ConversationMeta> = read_json_files(chats_dir)
        .await?
        .iter()
        .filter_map(|data| serde_json::from_str::<ConversationHeader>(data).ok())
        .map(|header| header.into_meta(None))
        .collect();

    result.sort_by(|a, b| b.updated_at.cmp(&a.updated_at));
    Ok(result)
}

/// Cut a short excerpt around the first match, on character boundaries.
fn snippet_around(content: &str, query_lower: &str) -> Option<String> {
    let lower = content.to_lowercase();
    let byte_pos = lower.find(query_lower)?;
    // Work in characters: lowercasing can change byte lengths, so the byte
    // offset is only used to locate the match in the lowercased copy.
    let match_char = lower[..byte_pos].chars().count();
    let chars: Vec<char> = content.chars().collect();
    let start = match_char.saturating_sub(40).min(chars.len());
    let end = (match_char + query_lower.chars().count() + 60).min(chars.len());
    let mut out: String = chars[start..end]
        .iter()
        .map(|c| if c.is_whitespace() { ' ' } else { *c })
        .collect();
    if start > 0 {
        out.insert(0, '…');
    }
    if end < chars.len() {
        out.push('…');
    }
    Some(out)
}

/// Find conversations whose title or any message contains `query`
/// (case-insensitive). Message hits carry a snippet for display.
pub async fn search_conversations(
    chats_dir: &Path,
    query: &str,
) -> Result<Vec<ConversationMeta>, String> {
    let needle = query.trim().to_lowercase();
    if needle.is_empty() {
        return list_conversations(chats_dir).await;
    }

    let mut result = Vec::new();
    for data in read_json_files(chats_dir).await? {
        let Ok(conv) = serde_json::from_str::<Conversation>(&data) else {
            continue;
        };
        let snippet = conv
            .messages
            .iter()
            .find_map(|m| snippet_around(&m.content, &needle));
        if snippet.is_none() && !conv.title.to_lowercase().contains(&needle) {
            continue;
        }
        result.push(ConversationMeta {
            id: conv.id,
            title: conv.title,
            model_name: conv.model_name,
            character_id: conv.character_id,
            character_name: conv.character_name,
            updated_at: conv.updated_at.to_rfc3339(),
            snippet,
        });
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

pub async fn load_all(chats_dir: &Path) -> Result<Vec<Conversation>, String> {
    Ok(read_json_files(chats_dir)
        .await?
        .iter()
        .filter_map(|data| serde_json::from_str::<Conversation>(data).ok())
        .collect())
}

pub async fn save_conversation(chats_dir: &Path, conversation: &Conversation) -> Result<(), String> {
    validate_id(&conversation.id)?;
    fs::create_dir_all(chats_dir).await.map_err(|e| e.to_string())?;
    let path = chats_dir.join(format!("{}.json", conversation.id));

    // A conversation is created once. Callers resend the whole object on
    // every save, so keep the original creation time from disk.
    let mut to_write = conversation.clone();
    if let Ok(existing) = fs::read_to_string(&path).await {
        if let Ok(header) = serde_json::from_str::<ConversationHeader>(&existing) {
            to_write.created_at = header.created_at;
        }
    }

    let data = serde_json::to_string_pretty(&to_write).map_err(|e| e.to_string())?;
    // Write to a temp file and rename, so a crash mid-write cannot leave a
    // truncated conversation behind.
    let tmp = chats_dir.join(format!("{}.json.tmp", conversation.id));
    fs::write(&tmp, data).await.map_err(|e| e.to_string())?;
    fs::rename(&tmp, &path).await.map_err(|e| e.to_string())?;
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
    use super::{snippet_around, validate_id};

    #[test]
    fn snippet_marks_truncation() {
        let text = format!("{}needle{}", "a".repeat(100), "b".repeat(100));
        let snip = snippet_around(&text, "needle").unwrap();
        assert!(snip.starts_with('…') && snip.ends_with('…'));
        assert!(snip.contains("needle"));
    }

    #[test]
    fn snippet_is_case_insensitive_and_unicode_safe() {
        assert!(snippet_around("Ünïcödé Karakoram highway", "karakoram").is_some());
        assert!(snippet_around("nothing here", "glacier").is_none());
    }

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
