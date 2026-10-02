use std::collections::{HashMap, HashSet};

use serde::Serialize;
use tokio::sync::Mutex;
use tokio_util::sync::CancellationToken;

use crate::inference::engine::LoadedModel;

/// Identity of the model the user has selected. Kept separately from
/// `loaded_model` because the weights are checked out of the state while a
/// reply is generating — the UI must still see the model as active then.
#[derive(Debug, Clone, Serialize)]
pub struct ActiveModel {
    pub id: String,
    pub name: String,
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
