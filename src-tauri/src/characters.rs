use serde::{Deserialize, Serialize};

/// A character is a named bundle of prompt + sampling parameters. Built-in
/// presets are returned by `get_preset_characters()` and never written to
/// disk; custom characters live inside `Settings.custom_characters`.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Character {
    pub id: String,
    pub name: String,
    pub description: String,
    /// Material Symbols icon name (e.g. "auto_awesome").
    pub icon: String,
    /// Hex color used to tint the character's icon bubble. Optional — the
    /// frontend falls back to the primary accent when missing.
    #[serde(default)]
    pub accent_color: Option<String>,
    pub system_prompt: String,
    pub temperature: f64,
    pub top_p: f64,
    pub max_tokens: u32,
    /// Tappable example prompts shown on the empty-chat state. Up to 4 are
    /// surfaced; each entry is a single-line string.
    #[serde(default)]
    pub conversation_starters: Vec<String>,
    pub is_preset: bool,
    #[serde(default)]
    pub created_at: Option<String>,
}

/// Returns the built-in character presets.
///
/// Prompts are deliberately short (under 200 chars) because Neurix runs
/// small quantized models (1B–4B). Research on Phi-3, Llama 3.2, Gemma 2
/// shows that heavy roleplay/persona framing drops accuracy by 20–30
/// percentage points — so we describe tone & style only, not personas.
pub fn get_preset_characters() -> Vec<Character> {
    vec![
        Character {
            id: "preset:default".into(),
            name: "Default".into(),
            description: "Helpful and balanced".into(),
            icon: "auto_awesome".into(),
            accent_color: Some("#8ff5ff".into()),
            system_prompt: "You are a helpful assistant. Give clear, concise answers. Do not repeat yourself.".into(),
            temperature: 0.7,
            top_p: 0.9,
            max_tokens: 512,
            conversation_starters: vec![
                "Summarize a topic I'm trying to learn".into(),
                "Help me draft a short message".into(),
                "Explain something simply".into(),
                "Brainstorm ideas with me".into(),
            ],
            is_preset: true,
            created_at: None,
        },
        Character {
            id: "preset:friendly".into(),
            name: "Friendly".into(),
            description: "Warm and casual".into(),
            icon: "sentiment_satisfied".into(),
            accent_color: Some("#ffb86c".into()),
            system_prompt: "Reply in a warm, casual tone. Use plain language and contractions. Be encouraging.".into(),
            temperature: 0.7,
            top_p: 0.9,
            max_tokens: 512,
            conversation_starters: vec![
                "Cheer me up — I had a rough day".into(),
                "Help me reply to a tricky text".into(),
                "Give me a small win to try today".into(),
            ],
            is_preset: true,
            created_at: None,
        },
        Character {
            id: "preset:professional".into(),
            name: "Professional".into(),
            description: "Formal and precise".into(),
            icon: "business_center".into(),
            accent_color: Some("#65afff".into()),
            system_prompt: "Reply in a professional, precise tone. Use formal language and complete sentences. Be accurate and avoid filler.".into(),
            temperature: 0.4,
            top_p: 0.85,
            max_tokens: 768,
            conversation_starters: vec![
                "Draft a polite follow-up email".into(),
                "Summarize meeting notes I'll paste".into(),
                "Rewrite this to sound more formal".into(),
                "Outline a one-page proposal".into(),
            ],
            is_preset: true,
            created_at: None,
        },
        Character {
            id: "preset:concise".into(),
            name: "Concise".into(),
            description: "Short and direct".into(),
            icon: "bolt".into(),
            accent_color: Some("#2ff801".into()),
            system_prompt: "Reply as briefly as possible. One or two sentences. No filler, no preamble.".into(),
            temperature: 0.3,
            top_p: 0.85,
            max_tokens: 256,
            conversation_starters: vec![
                "Define a term in one line".into(),
                "Yes-or-no: should I…".into(),
                "TL;DR this for me".into(),
            ],
            is_preset: true,
            created_at: None,
        },
        Character {
            id: "preset:tutor".into(),
            name: "Tutor".into(),
            description: "Explains step by step".into(),
            icon: "school".into(),
            accent_color: Some("#c792ea".into()),
            system_prompt: "Explain step by step. Use simple words. Give one short example when useful. Check understanding at the end.".into(),
            temperature: 0.5,
            top_p: 0.9,
            max_tokens: 768,
            conversation_starters: vec![
                "Teach me something I'm curious about".into(),
                "Walk me through a concept slowly".into(),
                "Quiz me on what I just learned".into(),
                "Explain it like I'm a beginner".into(),
            ],
            is_preset: true,
            created_at: None,
        },
        Character {
            id: "preset:creative".into(),
            name: "Creative".into(),
            description: "Playful and imaginative".into(),
            icon: "palette".into(),
            accent_color: Some("#ff79c6".into()),
            system_prompt: "Be playful and imaginative. Use varied phrasing and the occasional metaphor. Have fun with the response.".into(),
            temperature: 0.9,
            top_p: 0.95,
            max_tokens: 768,
            conversation_starters: vec![
                "Write a tiny story from one prompt".into(),
                "Give me a wild metaphor for…".into(),
                "Help me name something".into(),
                "Spin a 'what if' scenario".into(),
            ],
            is_preset: true,
            created_at: None,
        },
    ]
}

/// Returns the preset character with the given id, if any.
pub fn get_preset(id: &str) -> Option<Character> {
    get_preset_characters().into_iter().find(|c| c.id == id)
}
