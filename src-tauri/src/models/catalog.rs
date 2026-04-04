use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModelInfo {
    pub id: String,
    pub name: String,
    pub description: String,
    pub size_bytes: u64,
    pub size_label: String,
    pub tag: String,
    pub hf_repo: String,
    pub hf_filename: String,
    pub tokenizer_repo: String,
    pub chat_template: ChatTemplate,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ChatTemplate {
    Llama3,
    SmolLM,
    Gemma,
    Phi3,
}

pub fn get_catalog() -> Vec<ModelInfo> {
    vec![
        ModelInfo {
            id: "llama-3.2-1b".into(),
            name: "Llama 3.2 1B".into(),
            description: "Compact model great for quick tasks and chat.".into(),
            size_bytes: 700_000_000,
            size_label: "~700 MB".into(),
            tag: "Tiny".into(),
            hf_repo: "bartowski/Llama-3.2-1B-Instruct-GGUF".into(),
            hf_filename: "Llama-3.2-1B-Instruct-Q4_K_M.gguf".into(),
            tokenizer_repo: "meta-llama/Llama-3.2-1B-Instruct".into(),
            chat_template: ChatTemplate::Llama3,
        },
        ModelInfo {
            id: "smollm2-1.7b".into(),
            name: "SmolLM2 1.7B".into(),
            description: "Fast and efficient for general tasks.".into(),
            size_bytes: 1_000_000_000,
            size_label: "~1.0 GB".into(),
            tag: "Popular".into(),
            hf_repo: "bartowski/SmolLM2-1.7B-Instruct-GGUF".into(),
            hf_filename: "SmolLM2-1.7B-Instruct-Q4_K_M.gguf".into(),
            tokenizer_repo: "HuggingFaceTB/SmolLM2-1.7B-Instruct".into(),
            chat_template: ChatTemplate::SmolLM,
        },
        ModelInfo {
            id: "gemma-2-2b".into(),
            name: "Gemma 2 2B".into(),
            description: "Lightweight model by Google for on-device use.".into(),
            size_bytes: 1_500_000_000,
            size_label: "~1.5 GB".into(),
            tag: "Fast".into(),
            hf_repo: "bartowski/gemma-2-2b-it-GGUF".into(),
            hf_filename: "gemma-2-2b-it-Q4_K_M.gguf".into(),
            tokenizer_repo: "google/gemma-2-2b-it".into(),
            chat_template: ChatTemplate::Gemma,
        },
        ModelInfo {
            id: "llama-3.2-3b".into(),
            name: "Llama 3.2 3B".into(),
            description: "Great for chat, reasoning, and creative writing.".into(),
            size_bytes: 2_000_000_000,
            size_label: "~2.0 GB".into(),
            tag: "Popular".into(),
            hf_repo: "bartowski/Llama-3.2-3B-Instruct-GGUF".into(),
            hf_filename: "Llama-3.2-3B-Instruct-Q4_K_M.gguf".into(),
            tokenizer_repo: "meta-llama/Llama-3.2-3B-Instruct".into(),
            chat_template: ChatTemplate::Llama3,
        },
        ModelInfo {
            id: "phi-3.5-mini".into(),
            name: "Phi-3.5 Mini".into(),
            description: "Optimized for code generation and debugging.".into(),
            size_bytes: 2_200_000_000,
            size_label: "~2.2 GB".into(),
            tag: "Code".into(),
            hf_repo: "bartowski/Phi-3.5-mini-instruct-GGUF".into(),
            hf_filename: "Phi-3.5-mini-instruct-Q4_K_M.gguf".into(),
            tokenizer_repo: "microsoft/Phi-3.5-mini-instruct".into(),
            chat_template: ChatTemplate::Phi3,
        },
    ]
}
