use std::path::{Path, PathBuf};
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
/// (llama.*, qwen2.*, phi3.*, gemma*.*) and dispatches forward() accordingly.
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
    /// `None` only transiently, while the weights are being replaced.
    pub weights: Option<ModelWeights>,
    pub tokenizer: Tokenizer,
    pub chat_template: ChatTemplate,
    pub device: Device,
    pub context_length: usize,
    pub model_path: PathBuf,
}

fn load_weights(
    template: &ChatTemplate,
    model_path: &Path,
    device: &Device,
) -> Result<ModelWeights, String> {
    let mut file =
        std::fs::File::open(model_path).map_err(|e| format!("Cannot open model: {}", e))?;
    let content =
        gguf_file::Content::read(&mut file).map_err(|e| format!("Invalid GGUF: {}", e))?;

    match template {
        ChatTemplate::Llama3 | ChatTemplate::SmolLM => {
            qllama::ModelWeights::from_gguf(content, &mut file, device)
                .map(ModelWeights::Llama)
                .map_err(|e| format!("Failed to load Llama weights: {}", e))
        }
        ChatTemplate::Qwen => qqwen2::ModelWeights::from_gguf(content, &mut file, device)
            .map(ModelWeights::Qwen2)
            .map_err(|e| format!("Failed to load Qwen2 weights: {}", e)),
        ChatTemplate::Phi3 => qphi3::ModelWeights::from_gguf(false, content, &mut file, device)
            .map(ModelWeights::Phi3)
            .map_err(|e| format!("Failed to load Phi3 weights: {}", e)),
        ChatTemplate::Gemma => qgemma::ModelWeights::from_gguf(content, &mut file, device)
            .map(ModelWeights::Gemma)
            .map_err(|e| format!("Failed to load Gemma weights: {}", e)),
    }
}

/// Reload just the model weights from disk (fresh KV cache).
/// The tokenizer is kept since it has no mutable state.
///
/// The old weights are dropped *before* the new ones are read, so peak
/// memory stays at one copy of the model instead of two.
pub fn reload_weights(model: &mut LoadedModel) -> Result<(), String> {
    info!("Reloading model weights for fresh KV cache");
    model.weights = None;
    model.weights = Some(load_weights(
        &model.chat_template,
        &model.model_path,
        &model.device,
    )?);
    info!("Model weights reloaded");
    Ok(())
}

/// Why generation ended. Sent to the UI so it can tell a finished answer
/// from one that was cut short.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum StopReason {
    /// The model emitted its end-of-turn token.
    Eos,
    /// The reply hit the max-token limit.
    Length,
    /// The user pressed stop.
    Cancelled,
    /// The model started writing the next turn itself.
    StopSequence,
    /// A degenerate repetition loop was detected.
    Repetition,
    /// The model's confidence collapsed for several tokens in a row.
    LowConfidence,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "event", content = "data")]
pub enum InferenceEvent {
    TokenGenerated { token: String, tokens_per_second: f32 },
    GenerationComplete { total_tokens: usize, duration_ms: u64, stop_reason: StopReason },
    ContextTrimmed { pairs_dropped: usize },
    Error { message: String },
}

pub fn load_model_from_disk(
    model_id: &str,
    name: &str,
    model_path: &Path,
    tokenizer_path: &Path,
    chat_template: ChatTemplate,
    context_length: usize,
) -> Result<LoadedModel, String> {
    let device = Device::Cpu;

    info!("Loading GGUF model from {:?}", model_path);
    let weights = load_weights(&chat_template, model_path, &device)?;
    info!("Model weights loaded");

    let tokenizer = Tokenizer::from_file(tokenizer_path)
        .map_err(|e| format!("Failed to load tokenizer: {}", e))?;
    info!("Tokenizer loaded");

    Ok(LoadedModel {
        id: model_id.to_string(),
        name: name.to_string(),
        weights: Some(weights),
        tokenizer,
        chat_template,
        device,
        context_length,
        model_path: model_path.to_path_buf(),
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
        ChatTemplate::Phi3 => {
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
        ChatTemplate::SmolLM | ChatTemplate::Qwen => {
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

/// Count tokens in a text string using the model's tokenizer.
pub fn count_tokens(model: &LoadedModel, text: &str) -> Result<usize, String> {
    let tokens = model
        .tokenizer
        .encode(text, true)
        .map_err(|e| format!("Tokenization failed: {}", e))?;
    Ok(tokens.get_ids().len())
}

/// Trim history pairs so that the full formatted prompt fits within the context budget.
/// Returns the trimmed history (newest pairs preserved) and the number of pairs dropped.
pub fn trim_history_to_fit(
    model: &LoadedModel,
    system_prompt: &str,
    history: &[(String, String)],
    user_msg: &str,
    max_tokens: u32,
) -> Result<(Vec<(String, String)>, usize), String> {
    let safety_margin: usize = 32; // Buffer for special tokens and template overhead
    let budget = model
        .context_length
        .saturating_sub(max_tokens as usize)
        .saturating_sub(safety_margin);

    let mut included: Vec<(String, String)> = history.to_vec();

    loop {
        let formatted = format_prompt(&model.chat_template, system_prompt, &included, user_msg);
        let token_count = count_tokens(model, &formatted)?;

        if token_count <= budget {
            let dropped = history.len() - included.len();
            if dropped > 0 {
                info!(
                    "Context management: dropped {} oldest pairs, using {}/{} tokens (budget={})",
                    dropped, token_count, model.context_length, budget
                );
            }
            return Ok((included, dropped));
        }

        // Remove oldest pair
        if included.is_empty() {
            // Even without history, prompt is too long — let run_generation handle raw truncation
            info!(
                "Context management: all history dropped, prompt still {} tokens (budget={})",
                count_tokens(model, &format_prompt(&model.chat_template, system_prompt, &[], user_msg))
                    .unwrap_or(0),
                budget
            );
            return Ok((vec![], history.len()));
        }
        included.remove(0);
    }
}

/// Chat-template control tokens. If one of these shows up in the decoded
/// text the model has finished its turn (or is starting the next one).
const TEMPLATE_STOP_TOKENS: &[&str] = &[
    "<|im_start|>",
    "<|im_end|>",
    "<start_of_turn>",
    "<end_of_turn>",
    "<|eot_id|>",
    "<|start_header_id|>",
    "<|end|>",
    "<|user|>",
    "<|system|>",
    "<|assistant|>",
    "<|endoftext|>",
];

/// Role labels a model writes when it starts talking to itself. These are
/// only treated as a stop when they begin a line: "user:" in the middle of a
/// sentence, a YAML key, or a line of code is ordinary output.
const ROLE_LABEL_STOPS: &[&str] = &["User:", "Human:"];

/// True if the generated text shows the model starting a new turn.
fn contains_stop_sequence(generated: &str) -> bool {
    if TEMPLATE_STOP_TOKENS.iter().any(|stop| generated.contains(stop)) {
        return true;
    }
    generated
        .lines()
        .any(|line| ROLE_LABEL_STOPS.iter().any(|label| line.starts_with(label)))
}

/// Detect degenerate n-gram repetition loops.
/// Returns true if the same `n`-gram of tokens appears `max_repeats` or more times
/// in the last portion of generated tokens. This catches the "death spiral" where
/// the model endlessly repeats phrases like "haha haha haha" or emoji sequences.
fn has_repeated_ngram(tokens: &[u32], n: usize, max_repeats: usize) -> bool {
    // Need at least enough tokens to contain the pattern repeated max_repeats times
    if tokens.len() < n * max_repeats {
        return false;
    }
    // Only scan the recent window to keep this fast
    let scan_len = (n * (max_repeats + 2) * 2).min(tokens.len());
    let recent = &tokens[tokens.len() - scan_len..];
    if recent.len() < n {
        return false;
    }
    // The target n-gram is the most recently generated one
    let target = &recent[recent.len() - n..];
    let count = recent.windows(n).filter(|w| *w == target).count();
    count >= max_repeats
}

/// One forward pass. Takes the weights and device separately (rather than the
/// whole model) so the caller can keep borrowing the tokenizer meanwhile.
fn forward(
    weights: &mut Option<ModelWeights>,
    device: &Device,
    tokens: &[u32],
    index_pos: usize,
) -> Result<Tensor, String> {
    let input = Tensor::new(tokens, device)
        .map_err(|e| format!("Tensor error: {}", e))?
        .unsqueeze(0)
        .map_err(|e| format!("Unsqueeze error: {}", e))?;
    weights
        .as_mut()
        .ok_or_else(|| "Model weights are not loaded".to_string())?
        .forward(&input, index_pos)
        .map_err(|e| format!("Forward pass error: {}", e))
}

pub fn run_generation(
    model: &mut LoadedModel,
    prompt: &str,
    max_tokens: u32,
    sampler: &mut LogitsSampler,
    channel: &Channel<InferenceEvent>,
    cancel_token: &CancellationToken,
) -> Result<(), String> {
    // Reload weights to guarantee a fresh KV cache.
    // Candle 0.9.2's quantized models accumulate KV cache entries across calls,
    // and the pos=0 reset is unreliable with reused model instances.
    // This takes ~1-3s but prevents "cannot broadcast [X] to [Y]" errors.
    reload_weights(model)?;

    let tokens = model
        .tokenizer
        .encode(prompt, true)
        .map_err(|e| format!("Tokenization failed: {}", e))?;
    let mut prompt_tokens = tokens.get_ids().to_vec();

    // Truncate prompt to fit within context window: prompt + max_tokens must not exceed it.
    let max_prompt_len = model.context_length.saturating_sub(max_tokens as usize).max(1);
    if prompt_tokens.len() > max_prompt_len {
        info!(
            "Truncating prompt from {} to {} tokens (context_length={}, max_tokens={})",
            prompt_tokens.len(), max_prompt_len, model.context_length, max_tokens
        );
        let start = prompt_tokens.len() - max_prompt_len;
        prompt_tokens = prompt_tokens[start..].to_vec();
    }
    if prompt_tokens.is_empty() {
        return Err("Prompt is empty after tokenization".to_string());
    }
    let prompt_len = prompt_tokens.len();

    // The sampler only ever sees generated tokens for the repetition penalty,
    // never the prompt.
    let mut generated_tokens: Vec<u32> = Vec::with_capacity(max_tokens as usize);

    let eos_token = model
        .tokenizer
        .token_to_id("<|eot_id|>")
        .or_else(|| model.tokenizer.token_to_id("</s>"))
        .or_else(|| model.tokenizer.token_to_id("<end_of_turn>"))
        .or_else(|| model.tokenizer.token_to_id("<|end|>"))
        .or_else(|| model.tokenizer.token_to_id("<|endoftext|>"))
        .or_else(|| model.tokenizer.token_to_id("<|im_end|>"));

    let start = Instant::now();
    let mut generated_text = String::new();

    // Process the entire prompt in one forward pass at position 0.
    let mut logits = forward(&mut model.weights, &model.device, prompt_tokens.as_slice(), 0)?;

    // Use DecodeStream for incremental decoding instead of decoding each token
    // in isolation. Single-token decode loses leading spaces because
    // BPE/SentencePiece tokenizers encode spaces as part of the token.
    // DecodeStream keeps state so multi-byte sequences and space prefixes are
    // handled correctly across successive .step() calls.
    let mut decode_stream = model.tokenizer.decode_stream(false);

    // Minimum confidence threshold — if the model's top probability drops below this
    // for several consecutive tokens, it has nothing useful left to say.
    const LOW_CONFIDENCE_THRESHOLD: f32 = 0.05;
    const LOW_CONFIDENCE_STREAK_LIMIT: usize = 4;
    let mut low_confidence_streak: usize = 0;

    let mut stop_reason = StopReason::Length;

    // First token: nothing generated yet, so the penalty has nothing to penalise.
    let (mut next_token, _) = sampler.sample(&logits, &generated_tokens)?;

    loop {
        // End-of-turn: stop before emitting the control token as text.
        if eos_token == Some(next_token) {
            stop_reason = StopReason::Eos;
            break;
        }

        generated_tokens.push(next_token);

        if let Some(text) = decode_stream
            .step(next_token)
            .map_err(|e| format!("Decode error: {}", e))?
        {
            generated_text.push_str(&text);
            let tps = generated_tokens.len() as f32 / start.elapsed().as_secs_f32().max(0.001);
            let _ = channel.send(InferenceEvent::TokenGenerated {
                token: text,
                tokens_per_second: tps,
            });
        }

        // Model trying to start a new turn.
        if contains_stop_sequence(&generated_text) {
            stop_reason = StopReason::StopSequence;
            break;
        }

        // N-gram repetition detection — catches degenerate loops that penalties miss.
        if generated_tokens.len() >= 12
            && (has_repeated_ngram(&generated_tokens, 4, 3)
                || has_repeated_ngram(&generated_tokens, 3, 4)
                || has_repeated_ngram(&generated_tokens, 2, 5))
        {
            info!(
                "Stopping: n-gram repetition loop detected after {} tokens",
                generated_tokens.len()
            );
            stop_reason = StopReason::Repetition;
            break;
        }

        if generated_tokens.len() >= max_tokens as usize {
            break;
        }

        if cancel_token.is_cancelled() {
            stop_reason = StopReason::Cancelled;
            break;
        }

        // The n-th generated token (0-based) sits at position prompt_len + n.
        let index_pos = prompt_len + generated_tokens.len() - 1;
        logits = forward(&mut model.weights, &model.device, &[next_token], index_pos)?;

        let (sampled_token, confidence) = sampler.sample(&logits, &generated_tokens)?;

        // Early low-confidence stopping: if the model's top probability is very low
        // for several tokens in a row, it's lost and generating noise. Stop early.
        if confidence < LOW_CONFIDENCE_THRESHOLD {
            low_confidence_streak += 1;
            if low_confidence_streak >= LOW_CONFIDENCE_STREAK_LIMIT {
                info!(
                    "Stopping: low confidence ({:.3}) for {} consecutive tokens",
                    confidence, low_confidence_streak
                );
                stop_reason = StopReason::LowConfidence;
                break;
            }
        } else {
            low_confidence_streak = 0;
        }

        next_token = sampled_token;
    }

    let _ = channel.send(InferenceEvent::GenerationComplete {
        total_tokens: generated_tokens.len(),
        duration_ms: start.elapsed().as_millis() as u64,
        stop_reason,
    });

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn template_tokens_stop() {
        assert!(contains_stop_sequence("Sure.<|im_end|>"));
        assert!(contains_stop_sequence("Done<|eot_id|>"));
    }

    #[test]
    fn role_labels_stop_only_at_line_start() {
        assert!(contains_stop_sequence("Hello there.\nUser: next question"));
        assert!(contains_stop_sequence("Human: hi"));
        assert!(!contains_stop_sequence("Ask the user: what do they need?"));
        assert!(!contains_stop_sequence("db:\n  user: admin\n  port: 5432"));
        assert!(!contains_stop_sequence("    User: indented example"));
    }

    #[test]
    fn repetition_is_detected() {
        let looping = [1, 2, 3, 4, 7, 8, 7, 8, 7, 8, 7, 8, 7, 8];
        assert!(has_repeated_ngram(&looping, 2, 5));
        let varied = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
        assert!(!has_repeated_ngram(&varied, 2, 5));
    }
}
