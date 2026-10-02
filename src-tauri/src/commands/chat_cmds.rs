use log::info;
use serde::{Deserialize, Serialize};
use tauri::ipc::Channel;
use tauri::State;
use tokio_util::sync::CancellationToken;

use crate::inference::engine::{self, InferenceEvent, LoadedModel};
use crate::inference::sampler::LogitsSampler;
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
    on_event: Channel<InferenceEvent>,
) -> Result<(), String> {
    let cancel_token = CancellationToken::new();

    // Take the model out so generation can run WITHOUT holding the lock.
    let mut model = {
        let mut s = state.lock().await;
        let model = s
            .loaded_model
            .take()
            .ok_or_else(|| "No model loaded".to_string())?;
        s.inference_cancel = Some(cancel_token.clone());
        model
    };
    // Lock released: stop_inference and get_active_model can proceed.

    // Never let the reply budget swallow the whole context window.
    let max_tokens = max_tokens
        .clamp(16, MAX_REPLY_TOKENS)
        .min((model.context_length / 2) as u32);

    let history_pairs: Vec<(String, String)> = history
        .into_iter()
        .map(|h| (h.user, h.assistant))
        .collect();

    // Smart context management: trim oldest history pairs until the prompt
    // fits within context_length - max_tokens, counted with the real tokenizer.
    let prepared = engine::trim_history_to_fit(
        &model,
        &system_prompt,
        &history_pairs,
        &prompt,
        max_tokens,
    )
    .map(|(pairs, dropped)| {
        let mut formatted =
            engine::format_prompt(&model.chat_template, &system_prompt, &pairs, &prompt);
        if let Some(prefix) = assistant_prefix.as_deref() {
            formatted.push_str(prefix);
        }
        (formatted, dropped)
    });

    let (formatted, pairs_dropped) = match prepared {
        Ok(v) => v,
        Err(e) => {
            // The model must go back on every path, or the app is left with
            // "No model loaded" until the user reloads one by hand.
            return_model(&state, model).await;
            return Err(e);
        }
    };

    info!("Running inference, prompt length: {} chars", formatted.len());

    // Notify frontend if context was trimmed so it can show a subtle indicator
    if pairs_dropped > 0 {
        let _ = on_event.send(InferenceEvent::ContextTrimmed { pairs_dropped });
    }

    let mut sampler = LogitsSampler::new(
        temperature.clamp(0.0, 2.0),
        top_p.clamp(0.05, 1.0),
        0.05, // min_p: dynamically filters garbage tokens based on model confidence
        1.1,  // repetition_penalty: industry standard (llama.cpp default)
        64,   // repeat_last_n: only penalize last 64 generated tokens, never prompt
    );

    let joined = tokio::task::spawn_blocking(move || {
        let res = engine::run_generation(
            &mut model,
            &formatted,
            max_tokens,
            &mut sampler,
            &on_event,
            &cancel_token,
        );
        (model, res)
    })
    .await;

    match joined {
        Ok((model, gen_result)) => {
            return_model(&state, model).await;
            gen_result
        }
        Err(e) => {
            // The blocking task panicked and took the model with it. Clear
            // the active marker so the UI offers to load a model again.
            let mut s = state.lock().await;
            s.inference_cancel = None;
            s.active_model = None;
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
