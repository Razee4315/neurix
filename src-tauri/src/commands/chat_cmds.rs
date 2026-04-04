use log::info;
use serde::{Deserialize, Serialize};
use tauri::ipc::Channel;
use tauri::State;
use tokio_util::sync::CancellationToken;

use crate::inference::engine::{self, InferenceEvent};
use crate::inference::sampler::LogitsSampler;
use crate::state::SharedState;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChatHistoryEntry {
    pub user: String,
    pub assistant: String,
}

#[tauri::command]
pub async fn get_active_model(state: State<'_, SharedState>) -> Result<Option<String>, String> {
    let state = state.lock().await;
    Ok(state.loaded_model.as_ref().map(|m| m.name.clone()))
}

#[tauri::command]
pub async fn run_inference(
    state: State<'_, SharedState>,
    prompt: String,
    system_prompt: String,
    history: Vec<ChatHistoryEntry>,
    temperature: f64,
    top_p: f64,
    max_tokens: u32,
    on_event: Channel<InferenceEvent>,
) -> Result<(), String> {
    let cancel_token = CancellationToken::new();

    // Take the model out briefly to format prompt, then run generation WITHOUT holding the lock
    let (mut model, formatted) = {
        let mut s = state.lock().await;
        s.inference_cancel = Some(cancel_token.clone());

        let model = s.loaded_model.take()
            .ok_or_else(|| "No model loaded".to_string())?;

        let history_pairs: Vec<(String, String)> = history
            .iter()
            .map(|h| (h.user.clone(), h.assistant.clone()))
            .collect();

        let formatted = engine::format_prompt(
            &model.chat_template,
            &system_prompt,
            &history_pairs,
            &prompt,
        );

        (model, formatted)
    };
    // Lock is released here -- other commands (stop_inference, get_active_model) can proceed

    info!("Running inference, prompt length: {} chars", formatted.len());

    let mut sampler = LogitsSampler::new(temperature, top_p, 1.1);

    let result = tokio::task::spawn_blocking(move || {
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
    .await
    .map_err(|e| format!("Inference task failed: {}", e))?;

    let (model, gen_result) = result;

    // Put model back and clear cancel token
    {
        let mut s = state.lock().await;
        s.loaded_model = Some(model);
        s.inference_cancel = None;
    }

    gen_result
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
