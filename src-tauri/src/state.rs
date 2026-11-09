use std::collections::{HashMap, HashSet};

use serde::Serialize;
use tokio::sync::Mutex;
use tokio_util::sync::CancellationToken;

use crate::inference::engine::LoadedModel;
use crate::model_slot::{ModelSlot, Ticket};
use crate::models::catalog::Reasoning;

/// Identity of the model the user has selected. Kept apart from the weights
/// because the weights are checked out of the state while a reply is
/// generating, and the UI must still see the model as active then.
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
    /// The model in memory: empty, ready, or in use by a reply.
    pub model: ModelSlot<LoadedModel>,
    /// Hands out checkout tickets (see `ModelSlot::checkin`).
    pub next_ticket: Ticket,
    pub active_downloads: HashMap<String, CancellationToken>,
    /// Downloads whose partial file should be deleted once the transfer loop
    /// has stopped (user chose "cancel", not "pause").
    pub discard_on_cancel: HashSet<String>,
}

impl AppState {
    pub fn take_ticket(&mut self) -> Ticket {
        self.next_ticket = self.next_ticket.wrapping_add(1);
        self.next_ticket
    }
}

pub type SharedState = Mutex<AppState>;

/// Serializes everything that changes which model is in memory: load,
/// unload and delete. Held across the (slow) load itself, so two loads can
/// never hold two models in memory at once, the last one asked for is the
/// one that ends up loaded, and a delete never removes a file mid-load.
///
/// Lock order: `ModelOps` first, then `SharedState`, never the reverse.
/// `tokio::sync::Mutex` is fair, so waiting operations run in the order
/// they were requested.
#[derive(Default)]
pub struct ModelOps(pub Mutex<()>);
