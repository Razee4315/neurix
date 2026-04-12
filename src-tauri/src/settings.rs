use serde::{Deserialize, Serialize};

fn default_font_size() -> String {
    "medium".to_string()
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Settings {
    pub wifi_only: bool,
    pub save_history: bool,
    pub show_speed: bool,
    pub system_prompt: String,
    pub temperature: f64,
    pub top_p: f64,
    pub max_tokens: u32,
    #[serde(default = "default_font_size")]
    pub font_size: String,
    #[serde(default)]
    pub last_model_id: Option<String>,
}

impl Default for Settings {
    fn default() -> Self {
        Self {
            wifi_only: true,
            save_history: true,
            show_speed: true,
            system_prompt: "You are a helpful assistant. Give clear, concise answers. Do not repeat yourself.".to_string(),
            temperature: 0.7,
            top_p: 0.9,
            max_tokens: 256,
            font_size: "medium".to_string(),
            last_model_id: None,
        }
    }
}
