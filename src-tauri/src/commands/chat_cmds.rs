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
    {
        let mut s = state.lock().await;
        s.inference_cancel = Some(cancel_token.clone());
    }

    let result = {
        let mut s = state.lock().await;
        let model = s
            .loaded_model
            .as_mut()
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

        info!("Running inference, prompt length: {} chars", formatted.len());

        let mut sampler = LogitsSampler::new(temperature, top_p, 1.1);

        engine::run_generation(
            model,
            &formatted,
            max_tokens,
            &mut sampler,
            &on_event,
            &cancel_token,
        )
    };

    {
        let mut s = state.lock().await;
        s.inference_cancel = None;
    }

    result
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
