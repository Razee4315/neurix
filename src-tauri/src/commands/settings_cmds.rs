use crate::settings::Settings;
use serde::{Deserialize, Serialize};
use std::path::Path;
use tauri::{AppHandle, Manager};
use tauri_plugin_store::StoreExt;
use tokio::fs;

const SETTINGS_STORE: &str = "settings.json";
const SETTINGS_KEY: &str = "settings";

#[tauri::command]
pub async fn get_settings(app: AppHandle) -> Result<Settings, String> {
    let store = app.store(SETTINGS_STORE).map_err(|e| e.to_string())?;
    match store.get(SETTINGS_KEY) {
        Some(val) => serde_json::from_value(val).map_err(|e| e.to_string()),
        None => Ok(Settings::default()),
    }
}

/// Hard ceiling on user-created characters. Anything past this is almost
/// certainly programmatic abuse (a buggy import loop, a malicious frontend),
/// not a real user. Picker UX also degrades long before this point.
const MAX_CUSTOM_CHARACTERS: usize = 100;
/// Caps on per-character text fields. The picker truncates display, but the
/// store keeps the original — so a 1 MB system_prompt would be persisted and
/// re-read on every settings load until the user notices.
const MAX_CHAR_NAME: usize = 64;
const MAX_CHAR_DESC: usize = 200;
const MAX_CHAR_SYSTEM_PROMPT: usize = 8192;
const MAX_CHAR_GREETING: usize = 500;
const MAX_CHAR_STARTERS: usize = 8;
const MAX_CHAR_STARTER_LEN: usize = 200;

fn truncate_in_place(s: &mut String, max: usize) {
    if s.len() > max {
        // Avoid splitting a multibyte UTF-8 codepoint mid-byte.
        let mut cut = max;
        while cut > 0 && !s.is_char_boundary(cut) {
            cut -= 1;
        }
        s.truncate(cut);
    }
}

#[tauri::command]
pub async fn update_settings(app: AppHandle, mut settings: Settings) -> Result<(), String> {
    // Clamp inference parameters to safe ranges. The frontend sliders already
    // enforce these, but the Tauri command is part of the public IPC surface
    // so we re-validate here as defense in depth.
    settings.temperature = settings.temperature.clamp(0.0, 2.0);
    settings.top_p = settings.top_p.clamp(0.05, 1.0);
    settings.max_tokens = settings.max_tokens.clamp(1, 8192);
    // Cap system prompt length so a runaway paste can't bloat the store.
    truncate_in_place(&mut settings.system_prompt, 8192);

    // Bound the custom-character collection. A maliciously crafted import (or
    // a buggy share loop) could otherwise grow the store unbounded.
    if settings.custom_characters.len() > MAX_CUSTOM_CHARACTERS {
        settings.custom_characters.truncate(MAX_CUSTOM_CHARACTERS);
    }
    for ch in settings.custom_characters.iter_mut() {
        ch.temperature = ch.temperature.clamp(0.0, 2.0);
        ch.top_p = ch.top_p.clamp(0.05, 1.0);
        ch.max_tokens = ch.max_tokens.clamp(1, 8192);
        truncate_in_place(&mut ch.name, MAX_CHAR_NAME);
        truncate_in_place(&mut ch.description, MAX_CHAR_DESC);
        truncate_in_place(&mut ch.system_prompt, MAX_CHAR_SYSTEM_PROMPT);
        if let Some(g) = ch.greeting.as_mut() {
            truncate_in_place(g, MAX_CHAR_GREETING);
        }
        if ch.conversation_starters.len() > MAX_CHAR_STARTERS {
            ch.conversation_starters.truncate(MAX_CHAR_STARTERS);
        }
        for s in ch.conversation_starters.iter_mut() {
            truncate_in_place(s, MAX_CHAR_STARTER_LEN);
        }
    }

    let store = app.store(SETTINGS_STORE).map_err(|e| e.to_string())?;
    let val = serde_json::to_value(&settings).map_err(|e| e.to_string())?;
    store.set(SETTINGS_KEY, val);
    store.save().map_err(|e| e.to_string())?;
    Ok(())
}

#[derive(Debug, Serialize, Deserialize)]
pub struct StorageInfo {
    pub used_bytes: u64,
    pub models_count: u32,
}

#[tauri::command]
pub async fn get_storage_info(app: AppHandle) -> Result<StorageInfo, String> {
    let models_dir = app
        .path()
        .app_local_data_dir()
        .map_err(|e| e.to_string())?
        .join("models");

    if !models_dir.exists() {
        return Ok(StorageInfo { used_bytes: 0, models_count: 0 });
    }

    let mut total_bytes: u64 = 0;
    let mut models_count: u32 = 0;

    let mut entries = fs::read_dir(&models_dir).await.map_err(|e| e.to_string())?;
    while let Some(entry) = entries.next_entry().await.map_err(|e| e.to_string())? {
        let path = entry.path();
        if path.is_dir() {
            let model_file = path.join("model.gguf");
            if model_file.exists() {
                models_count += 1;
                if let Ok(meta) = fs::metadata(&model_file).await {
                    total_bytes += meta.len();
                }
                let tok_file = path.join("tokenizer.json");
                if let Ok(meta) = fs::metadata(&tok_file).await {
                    total_bytes += meta.len();
                }
            }
        }
    }

    Ok(StorageInfo { used_bytes: total_bytes, models_count })
}

#[tauri::command]
pub async fn check_available_space(app: AppHandle, required_bytes: u64) -> Result<bool, String> {
    let data_dir = app.path().app_local_data_dir().map_err(|e| e.to_string())?;

    // Use the data directory's parent or itself to check free space
    let check_path = if data_dir.exists() {
        data_dir.clone()
    } else {
        data_dir.parent().unwrap_or(Path::new("/")).to_path_buf()
    };

    let available = fs2::available_space(&check_path).map_err(|e| e.to_string())?;
    // Require extra 100MB headroom beyond model size
    Ok(available > required_bytes + 100_000_000)
}

#[tauri::command]
pub async fn get_available_space(app: AppHandle) -> Result<u64, String> {
    let data_dir = app.path().app_local_data_dir().map_err(|e| e.to_string())?;
    let check_path = if data_dir.exists() {
        data_dir.clone()
    } else {
        data_dir.parent().unwrap_or(Path::new("/")).to_path_buf()
    };
    fs2::available_space(&check_path).map_err(|e| e.to_string())
}
