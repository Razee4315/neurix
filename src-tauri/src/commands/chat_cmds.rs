use log::info;
use serde::{Deserialize, Serialize};
use tauri::ipc::Channel;
use tauri::State;
use tokio_util::sync::CancellationToken;

use crate::inference::engine::{GenerationRequest, InferenceEvent, LoadedModel};
use crate::settings::MAX_REPLY_TOKENS;
use crate::state::{ActiveModel, SharedState};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChatHistoryEntry {
    pub user: String,
    pub assistant: String,
}

#[tauri::command]
pub async fn get_active_model(
    state: State<'_, SharedState>,
) -> Result<Option<ActiveModel>, String> {
    let state = state.lock().await;
    Ok(state.active_model.clone())
}

/// Free the loaded model's memory without deleting it from disk.
#[tauri::command]
pub async fn unload_model(state: State<'_, SharedState>) -> Result<(), String> {
    let mut s = state.lock().await;
    if let Some(token) = &s.inference_cancel {
        token.cancel();
    }
    s.loaded_model = None;
    s.active_model = None;
    info!("Model unloaded");
    Ok(())
}

/// Take the model out of the shared state so generation can run WITHOUT
/// holding the lock: `stop_inference` and `get_active_model` stay responsive.
async fn checkout_model(
    state: &State<'_, SharedState>,
    cancel: &CancellationToken,
) -> Result<LoadedModel, String> {
    let mut s = state.lock().await;
    let Some(model) = s.loaded_model.take() else {
        return Err(if s.active_model.is_some() {
            "The model is still busy with the previous reply.".to_string()
        } else {
            "No model loaded".to_string()
        });
    };
    s.inference_cancel = Some(cancel.clone());
    Ok(model)
}

/// Put a checked-out model back, unless the user switched or unloaded models
/// while it was out — in that case it is simply dropped.
async fn return_model(state: &State<'_, SharedState>, model: LoadedModel) {
    let mut s = state.lock().await;
    s.inference_cancel = None;
    let still_active = s.active_model.as_ref().map(|m| m.id == model.id).unwrap_or(false);
    if still_active && s.loaded_model.is_none() {
        s.loaded_model = Some(model);
    }
}

/// The blocking task panicked and took the model with it. Clear the active
/// marker so the UI offers to load a model again.
async fn model_lost(state: &State<'_, SharedState>) {
    let mut s = state.lock().await;
    s.inference_cancel = None;
    s.active_model = None;
}

#[tauri::command]
#[allow(clippy::too_many_arguments)]
pub async fn run_inference(
    state: State<'_, SharedState>,
    prompt: String,
    system_prompt: String,
    history: Vec<ChatHistoryEntry>,
    temperature: f64,
    top_p: f64,
    max_tokens: u32,
    // Text the assistant has already produced for this turn. When present the
    // model continues that reply instead of starting a new one.
    assistant_prefix: Option<String>,
    // Ask the model to reason before answering, if it is able to.
    enable_thinking: Option<bool>,
    on_event: Channel<InferenceEvent>,
) -> Result<(), String> {
    let cancel_token = CancellationToken::new();
    let mut model = checkout_model(&state, &cancel_token).await?;

    let request = GenerationRequest {
        system_prompt,
        history: history.into_iter().map(|h| (h.user, h.assistant)).collect(),
        user_message: prompt,
        assistant_prefix: assistant_prefix.filter(|p| !p.is_empty()),
        max_tokens: max_tokens.clamp(16, MAX_REPLY_TOKENS),
        temperature: temperature.clamp(0.0, 2.0) as f32,
        top_p: top_p.clamp(0.05, 1.0) as f32,
        enable_thinking: enable_thinking.unwrap_or(false),
    };

    // Tokenizing, prompt reading and generation are all CPU work: keep them
    // off the async runtime.
    let joined = tokio::task::spawn_blocking(move || {
        let mut emit = |event: InferenceEvent| {
            let _ = on_event.send(event);
        };
        let result = model.generate(&request, &mut emit, &cancel_token);
        (model, result)
    })
    .await;

    match joined {
        Ok((model, result)) => {
            // The model goes back on every path, or the app is left with
            // "No model loaded" until the user reloads one by hand.
            return_model(&state, model).await;
            result.map(|_| ())
        }
        Err(e) => {
            model_lost(&state).await;
            Err(format!("Inference task failed: {}", e))
        }
    }
}

#[tauri::command]
pub async fn stop_inference(state: State<'_, SharedState>) -> Result<(), String> {
    let s = state.lock().await;
    if let Some(token) = &s.inference_cancel {
        info!("Stopping inference");
        token.cancel();
    }
    Ok(())
}

/// Result of the built-in speed test.
#[derive(Debug, Clone, Serialize)]
pub struct BenchmarkResult {
    /// Tokens per second while reading the prompt.
    pub prompt_tokens_per_second: f32,
    /// Tokens per second while writing the reply — the number that decides
    /// how fast answers appear.
    pub tokens_per_second: f32,
    pub prompt_tokens: usize,
    pub generated_tokens: usize,
    pub threads: u32,
    pub context_length: usize,
}

/// A fixed passage, long enough that reading speed is measured over a few
/// hundred tokens rather than a handful.
const BENCHMARK_PASSAGE: &str = "The Karakoram Highway runs for about 1,300 kilometres from Hasan Abdal in Pakistan to Kashgar in China, crossing the Khunjerab Pass at 4,693 metres. Construction began in 1959 and the road opened to the public in 1979. It follows one of the old routes of the Silk Road, threading between the Karakoram, Hindu Kush and Himalaya ranges along the Indus, Gilgit and Hunza rivers. Landslides, rockfall and glacial floods close parts of it most years, and crews work through every season to clear them. In 2010 a landslide at Attabad dammed the Hunza River and drowned a long stretch of the road; a series of tunnels opened in 2015 to carry traffic around the new lake. Travellers pass apricot orchards, terraced fields and villages built from stone, with peaks above 7,000 metres on both sides of the valley.";

fn per_second(tokens: usize, ms: u64) -> f32 {
    tokens as f32 / (ms.max(1) as f32 / 1000.0)
}

/// Run a short, fixed generation on the loaded model and report its speed
/// on this device.
#[tauri::command]
pub async fn benchmark_model(state: State<'_, SharedState>) -> Result<BenchmarkResult, String> {
    let cancel_token = CancellationToken::new();
    let mut model = checkout_model(&state, &cancel_token).await?;

    let request = GenerationRequest {
        system_prompt: "You are a helpful assistant.".to_string(),
        history: Vec::new(),
        user_message: format!(
            "{BENCHMARK_PASSAGE}\n\nSummarise the passage above in three sentences."
        ),
        assistant_prefix: None,
        max_tokens: 96,
        // Greedy decoding: the same tokens every run, so runs are comparable.
        temperature: 0.0,
        top_p: 1.0,
        enable_thinking: false,
    };

    let joined = tokio::task::spawn_blocking(move || {
        let mut ignore = |_event: InferenceEvent| {};
        let result = model.generate(&request, &mut ignore, &cancel_token);
        (model, result)
    })
    .await;

    let (model, result) = match joined {
        Ok(pair) => pair,
        Err(e) => {
            model_lost(&state).await;
            return Err(format!("Speed test failed: {}", e));
        }
    };
    let threads = model.threads;
    let context_length = model.context_length;
    return_model(&state, model).await;
    let stats = result?;

    Ok(BenchmarkResult {
        prompt_tokens_per_second: per_second(
            stats.prompt_tokens.saturating_sub(stats.cached_tokens),
            stats.prompt_ms,
        ),
        tokens_per_second: per_second(stats.generated_tokens, stats.generation_ms),
        prompt_tokens: stats.prompt_tokens,
        generated_tokens: stats.generated_tokens,
        threads,
        context_length,
    })
}

#[cfg(test)]
mod tests {
    use super::per_second;

    #[test]
    fn speed_is_tokens_over_seconds() {
        assert_eq!(per_second(50, 2000), 25.0);
        // A zero duration must not divide by zero.
        assert!(per_second(10, 0).is_finite());
    }
}
