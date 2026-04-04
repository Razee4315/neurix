use std::path::PathBuf;
use std::time::Instant;

use candle_core::{quantized::gguf_file, Device, Result as CandleResult, Tensor};
use candle_transformers::models::quantized_gemma3 as qgemma;
use candle_transformers::models::quantized_llama as qllama;
use candle_transformers::models::quantized_phi3 as qphi3;
use candle_transformers::models::quantized_qwen2 as qqwen2;
use log::info;
use serde::{Deserialize, Serialize};
use tauri::ipc::Channel;
use tokenizers::Tokenizer;
use tokio_util::sync::CancellationToken;

use super::sampler::LogitsSampler;
use crate::models::catalog::ChatTemplate;

/// Wraps architecture-specific model weights behind a unified interface.
/// Each variant loads from GGUF using the correct metadata prefix
/// (llama.*, qwen2.*, phi3.*, gemma2.*) and dispatches forward() accordingly.
pub enum ModelWeights {
    Llama(qllama::ModelWeights),
    Qwen2(qqwen2::ModelWeights),
    Phi3(qphi3::ModelWeights),
    Gemma(qgemma::ModelWeights),
}

impl ModelWeights {
    pub fn forward(&mut self, x: &Tensor, index_pos: usize) -> CandleResult<Tensor> {
        match self {
            Self::Llama(m) => m.forward(x, index_pos),
            Self::Qwen2(m) => m.forward(x, index_pos),
            Self::Phi3(m) => m.forward(x, index_pos),
            Self::Gemma(m) => m.forward(x, index_pos),
        }
    }
}

pub struct LoadedModel {
    pub id: String,
    pub name: String,
    pub weights: ModelWeights,
    pub tokenizer: Tokenizer,
    pub chat_template: ChatTemplate,
    pub device: Device,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "event", content = "data")]
pub enum InferenceEvent {
    ModelLoading,
    ModelReady,
    TokenGenerated { token: String, tokens_per_second: f32 },
    GenerationComplete { total_tokens: usize, duration_ms: u64 },
    Error { message: String },
}

pub fn load_model_from_disk(
    model_id: &str,
    name: &str,
    model_path: &PathBuf,
    tokenizer_path: &PathBuf,
    chat_template: ChatTemplate,
) -> Result<LoadedModel, String> {
    let device = Device::Cpu;

    info!("Loading GGUF model from {:?}", model_path);
    let mut file = std::fs::File::open(model_path).map_err(|e| format!("Cannot open model: {}", e))?;
    let content = gguf_file::Content::read(&mut file).map_err(|e| format!("Invalid GGUF: {}", e))?;

    info!("Loading weights for architecture: {:?}", chat_template);
    let weights = match &chat_template {
        ChatTemplate::Llama3 | ChatTemplate::SmolLM => {
            let w = qllama::ModelWeights::from_gguf(content, &mut file, &device)
                .map_err(|e| format!("Failed to load Llama weights: {}", e))?;
            ModelWeights::Llama(w)
        }
        ChatTemplate::Qwen => {
            let w = qqwen2::ModelWeights::from_gguf(content, &mut file, &device)
                .map_err(|e| format!("Failed to load Qwen2 weights: {}", e))?;
            ModelWeights::Qwen2(w)
        }
        ChatTemplate::Phi3 => {
            let w = qphi3::ModelWeights::from_gguf(false, content, &mut file, &device)
                .map_err(|e| format!("Failed to load Phi3 weights: {}", e))?;
            ModelWeights::Phi3(w)
        }
        ChatTemplate::Gemma => {
            let w = qgemma::ModelWeights::from_gguf(content, &mut file, &device)
                .map_err(|e| format!("Failed to load Gemma weights: {}", e))?;
            ModelWeights::Gemma(w)
        }
    };
    info!("Model weights loaded");

    let tokenizer = Tokenizer::from_file(tokenizer_path)
        .map_err(|e| format!("Failed to load tokenizer: {}", e))?;
    info!("Tokenizer loaded");

    Ok(LoadedModel {
        id: model_id.to_string(),
        name: name.to_string(),
        weights,
        tokenizer,
        chat_template,
        device,
    })
}

pub fn format_prompt(
    template: &ChatTemplate,
    system_prompt: &str,
    messages: &[(String, String)],
    user_msg: &str,
) -> String {
    match template {
        ChatTemplate::Llama3 => {
            let mut prompt = String::from("<|begin_of_text|>");
            if !system_prompt.is_empty() {
                prompt.push_str(&format!(
                    "<|start_header_id|>system<|end_header_id|>\n\n{}<|eot_id|>",
                    system_prompt
                ));
            }
            for (user, assistant) in messages {
                prompt.push_str(&format!(
                    "<|start_header_id|>user<|end_header_id|>\n\n{}<|eot_id|><|start_header_id|>assistant<|end_header_id|>\n\n{}<|eot_id|>",
                    user, assistant
                ));
            }
            prompt.push_str(&format!(
                "<|start_header_id|>user<|end_header_id|>\n\n{}<|eot_id|><|start_header_id|>assistant<|end_header_id|>\n\n",
                user_msg
            ));
            prompt
        }
        ChatTemplate::Gemma => {
            let mut prompt = String::new();
            // Gemma doesn't have a system role — prepend system prompt to first user turn
            if !system_prompt.is_empty() {
                prompt.push_str(&format!(
                    "<start_of_turn>user\nSystem: {}<end_of_turn>\n",
                    system_prompt
                ));
            }
            for (user, assistant) in messages {
                prompt.push_str(&format!(
                    "<start_of_turn>user\n{}<end_of_turn>\n<start_of_turn>model\n{}<end_of_turn>\n",
                    user, assistant
                ));
            }
            prompt.push_str(&format!(
                "<start_of_turn>user\n{}<end_of_turn>\n<start_of_turn>model\n",
                user_msg
            ));
            prompt
        }
        ChatTemplate::SmolLM | ChatTemplate::Phi3 => {
            let mut prompt = String::new();
            if !system_prompt.is_empty() {
                prompt.push_str(&format!("<|system|>\n{}<|end|>\n", system_prompt));
            }
            for (user, assistant) in messages {
                prompt.push_str(&format!(
                    "<|user|>\n{}<|end|>\n<|assistant|>\n{}<|end|>\n",
                    user, assistant
                ));
            }
            prompt.push_str(&format!("<|user|>\n{}<|end|>\n<|assistant|>\n", user_msg));
            prompt
        }
        ChatTemplate::Qwen => {
            let mut prompt = String::new();
            if !system_prompt.is_empty() {
                prompt.push_str(&format!(
                    "<|im_start|>system\n{}<|im_end|>\n",
                    system_prompt
                ));
            }
            for (user, assistant) in messages {
                prompt.push_str(&format!(
                    "<|im_start|>user\n{}<|im_end|>\n<|im_start|>assistant\n{}<|im_end|>\n",
                    user, assistant
                ));
            }
            prompt.push_str(&format!(
                "<|im_start|>user\n{}<|im_end|>\n<|im_start|>assistant\n",
                user_msg
            ));
            prompt
        }
    }
}

/// Stop sequences that indicate the model is starting a new turn (talking to itself).
const STOP_SEQUENCES: &[&str] = &[
    "Human:",
    "User:",
    "human:",
    "user:",
    "<|im_start|>",
    "<|im_end|>",
    "<start_of_turn>",
    "<end_of_turn>",
    "<|eot_id|>",
    "<|start_header_id|>",
    "<|end|>",
    "<|user|>",
    "<|endoftext|>",
];

/// Check if the recent generated text contains any stop sequence.
fn contains_stop_sequence(generated: &str) -> Option<usize> {
    for stop in STOP_SEQUENCES {
        if let Some(pos) = generated.find(stop) {
            return Some(pos);
        }
    }
    None
}

pub fn run_generation(
    model: &mut LoadedModel,
    prompt: &str,
    max_tokens: u32,
    sampler: &mut LogitsSampler,
    channel: &Channel<InferenceEvent>,
    cancel_token: &CancellationToken,
) -> Result<(), String> {
    let tokens = model
        .tokenizer
        .encode(prompt, true)
        .map_err(|e| format!("Tokenization failed: {}", e))?;
    let prompt_tokens = tokens.get_ids().to_vec();
    let mut all_tokens = prompt_tokens.clone();

    let eos_token = model
        .tokenizer
        .token_to_id("<|eot_id|>")
        .or_else(|| model.tokenizer.token_to_id("</s>"))
        .or_else(|| model.tokenizer.token_to_id("<end_of_turn>"))
        .or_else(|| model.tokenizer.token_to_id("<|end|>"))
        .or_else(|| model.tokenizer.token_to_id("<|endoftext|>"))
        .or_else(|| model.tokenizer.token_to_id("<|im_end|>"));

    let start = Instant::now();
    let mut generated_count: usize = 0;
    let mut generated_text = String::new();

    let mut logits = {
        let input = Tensor::new(prompt_tokens.as_slice(), &model.device)
            .map_err(|e| format!("Tensor error: {}", e))?
            .unsqueeze(0)
            .map_err(|e| format!("Unsqueeze error: {}", e))?;
        model.weights.forward(&input, 0)
            .map_err(|e| format!("Forward pass error: {}", e))?
    };

    let mut next_token = sampler.sample(&logits, &all_tokens)?;
    all_tokens.push(next_token);
    generated_count += 1;

    if let Some(text) = decode_token(&model.tokenizer, next_token) {
        generated_text.push_str(&text);
        let tps = generated_count as f32 / start.elapsed().as_secs_f32().max(0.001);
        let _ = channel.send(InferenceEvent::TokenGenerated {
            token: text,
            tokens_per_second: tps,
        });
    }

    for i in 1..(max_tokens as usize) {
        if cancel_token.is_cancelled() {
            break;
        }

        if let Some(eos) = eos_token {
            if next_token == eos {
                break;
            }
        }

        // Check for text-based stop sequences (model trying to start a new turn)
        if contains_stop_sequence(&generated_text).is_some() {
            break;
        }

        logits = {
            let input = Tensor::new(&[next_token], &model.device)
                .map_err(|e| format!("Tensor error: {}", e))?
                .unsqueeze(0)
                .map_err(|e| format!("Unsqueeze error: {}", e))?;
            model.weights.forward(&input, prompt_tokens.len() + i)
                .map_err(|e| format!("Forward pass error: {}", e))?
        };

        next_token = sampler.sample(&logits, &all_tokens)?;
        all_tokens.push(next_token);
        generated_count += 1;

        if let Some(text) = decode_token(&model.tokenizer, next_token) {
            generated_text.push_str(&text);
            let tps = generated_count as f32 / start.elapsed().as_secs_f32().max(0.001);
            let _ = channel.send(InferenceEvent::TokenGenerated {
                token: text,
                tokens_per_second: tps,
            });
        }
    }

    let duration = start.elapsed();
    let _ = channel.send(InferenceEvent::GenerationComplete {
        total_tokens: generated_count,
        duration_ms: duration.as_millis() as u64,
    });

    Ok(())
}

fn decode_token(tokenizer: &Tokenizer, token_id: u32) -> Option<String> {
    tokenizer.decode(&[token_id], true).ok()
}
