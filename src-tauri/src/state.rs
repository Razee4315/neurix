use std::collections::{HashMap, HashSet};

use serde::Serialize;
use tokio::sync::Mutex;
use tokio_util::sync::CancellationToken;

use crate::inference::engine::LoadedModel;
use crate::models::catalog::Reasoning;

/// Identity of the model the user has selected. Kept separately from
/// `loaded_model` because the model is checked out of the state while a
/// reply is generating — the UI must still see it as active then.
#[derive(Debug, Clone, Serialize)]
pub struct ActiveModel {
    pub id: String,
    pub name: String,
    /// Whether the model reasons before answering, and whether that can be
    /// switched. Drives the "Think" control in the chat composer.
    pub reasoning: Reasoning,
    /// Context window actually allocated, in tokens.
    pub context_length: usize,
    pub threads: u32,
}

#[derive(Default)]
pub struct AppState {
    pub loaded_model: Option<LoadedModel>,
    pub active_model: Option<ActiveModel>,
    pub active_downloads: HashMap<String, CancellationToken>,
    /// Downloads whose partial file should be deleted once the transfer loop
    /// has stopped (user chose "cancel", not "pause").
    pub discard_on_cancel: HashSet<String>,
    pub inference_cancel: Option<CancellationToken>,
}

pub type SharedState = Mutex<AppState>;
