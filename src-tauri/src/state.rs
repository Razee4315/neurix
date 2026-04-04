use std::collections::HashMap;
use tokio::sync::Mutex;
use tokio_util::sync::CancellationToken;

use crate::inference::engine::LoadedModel;

pub struct AppState {
    pub loaded_model: Option<LoadedModel>,
    pub active_downloads: HashMap<String, CancellationToken>,
    pub inference_cancel: Option<CancellationToken>,
}

impl Default for AppState {
    fn default() -> Self {
        Self {
            loaded_model: None,
            active_downloads: HashMap::new(),
            inference_cancel: None,
        }
    }
}

pub type SharedState = Mutex<AppState>;
