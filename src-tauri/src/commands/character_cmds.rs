use crate::characters::{self, Character};

/// Returns the built-in character presets. The frontend uses this to render
/// the picker; presets are not stored in the settings store.
#[tauri::command]
pub fn get_preset_characters() -> Vec<Character> {
    characters::get_preset_characters()
}
