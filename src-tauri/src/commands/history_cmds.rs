use tauri::{AppHandle, Manager};

use crate::chat::storage::{self, Conversation, ConversationMeta};

#[tauri::command]
pub async fn get_conversations(app: AppHandle) -> Result<Vec<ConversationMeta>, String> {
    let chats_dir = storage::get_chats_dir(
        &app.path().app_local_data_dir().map_err(|e| e.to_string())?,
    ).await?;
    storage::list_conversations(&chats_dir).await
}

#[tauri::command]
pub async fn load_conversation(app: AppHandle, id: String) -> Result<Option<Conversation>, String> {
    let chats_dir = storage::get_chats_dir(
        &app.path().app_local_data_dir().map_err(|e| e.to_string())?,
    ).await?;
    storage::load_conversation(&chats_dir, &id).await
}

#[tauri::command]
pub async fn save_conversation(app: AppHandle, conversation: Conversation) -> Result<(), String> {
    let chats_dir = storage::get_chats_dir(
        &app.path().app_local_data_dir().map_err(|e| e.to_string())?,
    ).await?;
    storage::save_conversation(&chats_dir, &conversation).await
}

#[tauri::command]
pub async fn delete_conversation(app: AppHandle, id: String) -> Result<(), String> {
    let chats_dir = storage::get_chats_dir(
        &app.path().app_local_data_dir().map_err(|e| e.to_string())?,
    ).await?;
    storage::delete_conversation(&chats_dir, &id).await
}

#[tauri::command]
pub async fn clear_all_conversations(app: AppHandle) -> Result<(), String> {
    let chats_dir = storage::get_chats_dir(
        &app.path().app_local_data_dir().map_err(|e| e.to_string())?,
    ).await?;
    storage::clear_all(&chats_dir).await
}
