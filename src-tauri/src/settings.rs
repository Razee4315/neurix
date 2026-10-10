use std::sync::Mutex;

use log::warn;
use serde::{Deserialize, Serialize};
use serde_json::{Map, Value};
use tauri::AppHandle;
use tauri_plugin_store::StoreExt;

use crate::characters::Character;

const SETTINGS_STORE: &str = "settings.json";
const SETTINGS_KEY: &str = "settings";
/// Where an unreadable settings value is parked before defaults take over,
/// so nothing the user wrote is destroyed by a failed parse.
const SETTINGS_BACKUP_KEY: &str = "settings_backup";

/// Serialises read-modify-write cycles on the settings store. Every writer
/// goes through `patch`, so two commands can no longer overwrite each
/// other's fields with a stale copy.
static WRITE_LOCK: Mutex<()> = Mutex::new(());

/// Hard ceiling on user-created characters. Anything past this is almost
/// certainly programmatic abuse (a buggy import loop), not a real user.
const MAX_CUSTOM_CHARACTERS: usize = 100;
/// Storage ceilings for per-character text. The editor enforces tighter,
/// user-facing limits; these only stop a runaway paste from bloating the
/// store, and are deliberately generous so existing data is never cut.
const MAX_CHAR_NAME: usize = 64;
const MAX_CHAR_DESC: usize = 200;
const MAX_CHAR_SYSTEM_PROMPT: usize = 8192;
const MAX_CHAR_GREETING: usize = 500;
const MAX_CHAR_STARTERS: usize = 8;
const MAX_CHAR_STARTER_LEN: usize = 200;
/// Longest reply a character may request. The engine additionally caps a
/// reply at half the context window, so the prompt always has room.
pub const MAX_REPLY_TOKENS: u32 = 2048;
/// Bounds for a hand-picked context window. The floor keeps room for a
/// system prompt and a reply; the ceiling keeps memory use sane.
const MIN_CONTEXT_SIZE: u32 = 2048;
const MAX_CONTEXT_SIZE: u32 = 32_768;
const MAX_THREADS: u32 = 16;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(default)]
pub struct Settings {
    pub wifi_only: bool,
    pub save_history: bool,
    pub show_speed: bool,
    /// Legacy free-form system prompt. Read-only after the character feature
    /// landed; migrated into a custom character on first run.
    pub system_prompt: String,
    pub temperature: f64,
    pub top_p: f64,
    pub max_tokens: u32,
    pub font_size: String,
    pub theme: String,
    pub onboarding_done: bool,
    pub last_model_id: Option<String>,
    pub active_character_id: Option<String>,
    pub custom_characters: Vec<Character>,
    /// Context window in tokens; 0 picks one from the model and device RAM.
    pub context_size: u32,
    /// Inference threads; 0 picks the device's fast cores.
    pub threads: u32,
}

impl Default for Settings {
    fn default() -> Self {
        Self {
            wifi_only: true,
            save_history: true,
            show_speed: true,
            system_prompt:
                "You are a helpful assistant. Give clear, concise answers. Do not repeat yourself."
                    .to_string(),
            temperature: 0.7,
            top_p: 0.9,
            max_tokens: 512,
            font_size: "medium".to_string(),
            theme: "obsidian".to_string(),
            onboarding_done: false,
            last_model_id: None,
            active_character_id: Some("preset:default".to_string()),
            custom_characters: Vec::new(),
            context_size: 0,
            threads: 0,
        }
    }
}

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

impl Settings {
    /// Clamp every value to a safe range. The frontend already enforces
    /// these, but the command is part of the IPC surface so we re-validate.
    fn sanitize(&mut self) {
        self.temperature = self.temperature.clamp(0.0, 2.0);
        self.top_p = self.top_p.clamp(0.05, 1.0);
        self.max_tokens = self.max_tokens.clamp(16, MAX_REPLY_TOKENS);
        if self.context_size != 0 {
            self.context_size = self.context_size.clamp(MIN_CONTEXT_SIZE, MAX_CONTEXT_SIZE);
        }
        self.threads = self.threads.min(MAX_THREADS);
        truncate_in_place(&mut self.system_prompt, MAX_CHAR_SYSTEM_PROMPT);
        truncate_in_place(&mut self.font_size, 16);
        truncate_in_place(&mut self.theme, 32);

        if self.custom_characters.len() > MAX_CUSTOM_CHARACTERS {
            self.custom_characters.truncate(MAX_CUSTOM_CHARACTERS);
        }
        for ch in self.custom_characters.iter_mut() {
            ch.is_preset = false;
            ch.temperature = ch.temperature.clamp(0.0, 2.0);
            ch.top_p = ch.top_p.clamp(0.05, 1.0);
            ch.max_tokens = ch.max_tokens.clamp(16, MAX_REPLY_TOKENS);
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
    }
}

/// Read settings. A missing store yields defaults; missing fields are filled
/// from defaults; an unreadable value is backed up and replaced by defaults
/// so the app stays usable instead of running with no settings at all.
pub fn load(app: &AppHandle) -> Result<Settings, String> {
    let store = app.store(SETTINGS_STORE).map_err(|e| e.to_string())?;
    let Some(raw) = store.get(SETTINGS_KEY) else {
        return Ok(Settings::default());
    };
    match serde_json::from_value::<Settings>(raw.clone()) {
        Ok(settings) => Ok(settings),
        Err(e) => {
            warn!("Settings unreadable ({}); backing up and using defaults", e);
            store.set(SETTINGS_BACKUP_KEY, raw);
            let defaults = Settings::default();
            if let Ok(v) = serde_json::to_value(&defaults) {
                store.set(SETTINGS_KEY, v);
            }
            let _ = store.save();
            Ok(defaults)
        }
    }
}

fn write(app: &AppHandle, settings: &Settings) -> Result<(), String> {
    let store = app.store(SETTINGS_STORE).map_err(|e| e.to_string())?;
    let val = serde_json::to_value(settings).map_err(|e| e.to_string())?;
    store.set(SETTINGS_KEY, val);
    store.save().map_err(|e| e.to_string())
}

/// Merge `patch` (top-level keys only) into the stored settings and persist.
/// Returns the settings as stored after sanitising.
pub fn patch(app: &AppHandle, patch: Map<String, Value>) -> Result<Settings, String> {
    let _guard = WRITE_LOCK.lock().map_err(|e| e.to_string())?;
    let current = load(app)?;
    let mut merged = match serde_json::to_value(&current).map_err(|e| e.to_string())? {
        Value::Object(map) => map,
        _ => return Err("Settings did not serialise to an object".to_string()),
    };
    for (key, value) in patch {
        merged.insert(key, value);
    }
    let mut next: Settings = serde_json::from_value(Value::Object(merged))
        .map_err(|e| format!("Invalid settings: {}", e))?;
    next.sanitize();
    write(app, &next)?;
    Ok(next)
}

/// Replace everything except the user's characters and last model with
/// defaults.
pub fn reset(app: &AppHandle) -> Result<Settings, String> {
    let _guard = WRITE_LOCK.lock().map_err(|e| e.to_string())?;
    let current = load(app)?;
    let next = Settings {
        last_model_id: current.last_model_id,
        custom_characters: current.custom_characters,
        onboarding_done: current.onboarding_done,
        ..Settings::default()
    };
    write(app, &next)?;
    Ok(next)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn missing_fields_fall_back_to_defaults() {
        let s: Settings = serde_json::from_str(r#"{"wifi_only": false}"#).unwrap();
        assert!(!s.wifi_only);
        assert!(s.save_history);
        assert_eq!(s.theme, "obsidian");
    }

    #[test]
    fn sanitize_clamps_reply_length() {
        let mut s = Settings { max_tokens: 9000, ..Settings::default() };
        s.sanitize();
        assert_eq!(s.max_tokens, MAX_REPLY_TOKENS);
    }

    #[test]
    fn sanitize_bounds_engine_settings() {
        let mut s = Settings { context_size: 100, threads: 99, ..Settings::default() };
        s.sanitize();
        assert_eq!(s.context_size, MIN_CONTEXT_SIZE);
        assert_eq!(s.threads, MAX_THREADS);

        // Zero means automatic and must survive untouched.
        let mut auto = Settings::default();
        auto.sanitize();
        assert_eq!(auto.context_size, 0);
        assert_eq!(auto.threads, 0);
    }

    #[test]
    fn truncate_respects_char_boundaries() {
        let mut s = "héllo".to_string();
        truncate_in_place(&mut s, 2);
        assert_eq!(s, "h");
    }
}
