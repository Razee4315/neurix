//! The one model the app holds in memory, as an explicit state machine.
//!
//! ```text
//!            set_ready              checkout
//!   Empty ────────────▶ Ready ─────────────────▶ InUse
//!     ▲                  │  ▲     checkin(ticket)   │
//!     │      clear       │  └───────────────────────┤
//!     ├──────────────────┘                          │
//!     └──────────── clear (cancels the reply) / lost(ticket)
//! ```
//!
//! Loading is not a slot state: loads, unloads and deletes are serialized by
//! [`crate::state::ModelOps`], and the slot is `Empty` while a load reads the
//! file. See STATE_MACHINES.md (M1).
//!
//! The model is generic so the transitions can be tested without llama.cpp.

use tokio_util::sync::CancellationToken;

use crate::state::ActiveModel;

/// Identifies one checkout, so a reply that outlived an unload and reload
/// of the same model cannot put its stale copy back in place of the new one.
pub type Ticket = u64;

#[derive(Default)]
pub enum ModelSlot<M> {
    /// Nothing loaded (or a load is reading the file).
    #[default]
    Empty,
    /// Loaded and idle.
    Ready { active: ActiveModel, model: M },
    /// Taken out by a reply; `cancel` stops it. The UI still sees the model
    /// as active.
    InUse { active: ActiveModel, cancel: CancellationToken, ticket: Ticket },
}

#[derive(Debug, PartialEq, Eq)]
pub enum CheckoutError {
    NoModel,
    Busy,
}

impl CheckoutError {
    /// User-facing text. The front end retries on "still busy", so keep it.
    pub fn message(&self) -> &'static str {
        match self {
            CheckoutError::NoModel => "No model loaded",
            CheckoutError::Busy => "The model is still busy with the previous reply.",
        }
    }
}

impl<M> ModelSlot<M> {
    /// The selected model, loaded or in use by a reply.
    pub fn active(&self) -> Option<&ActiveModel> {
        match self {
            ModelSlot::Empty => None,
            ModelSlot::Ready { active, .. } | ModelSlot::InUse { active, .. } => Some(active),
        }
    }

    pub fn is_active(&self, model_id: &str) -> bool {
        self.active().is_some_and(|m| m.id == model_id)
    }

    /// A model has finished loading. Returns whatever was there before, so
    /// the caller can free it outside any lock.
    pub fn set_ready(&mut self, active: ActiveModel, model: M) -> Option<M> {
        let previous = self.clear();
        *self = ModelSlot::Ready { active, model };
        previous
    }

    /// Take the model out for a reply.
    pub fn checkout(&mut self, cancel: CancellationToken, ticket: Ticket) -> Result<M, CheckoutError> {
        match std::mem::take(self) {
            ModelSlot::Ready { active, model } => {
                *self = ModelSlot::InUse { active, cancel, ticket };
                Ok(model)
            }
            busy @ ModelSlot::InUse { .. } => {
                *self = busy;
                Err(CheckoutError::Busy)
            }
            ModelSlot::Empty => Err(CheckoutError::NoModel),
        }
    }

    /// Put a checked-out model back. If the slot moved on while it was out
    /// (unloaded, switched, or reloaded), the model is handed back to be
    /// dropped instead.
    pub fn checkin(&mut self, ticket: Ticket, model: M) -> Option<M> {
        match std::mem::take(self) {
            ModelSlot::InUse { active, ticket: held, .. } if held == ticket => {
                *self = ModelSlot::Ready { active, model };
                None
            }
            other => {
                *self = other;
                Some(model)
            }
        }
    }

    /// The reply holding this checkout died and took the model with it.
    pub fn lost(&mut self, ticket: Ticket) {
        if matches!(self, ModelSlot::InUse { ticket: held, .. } if *held == ticket) {
            *self = ModelSlot::Empty;
        }
    }

    /// Ask the running reply, if any, to stop.
    pub fn cancel_reply(&self) -> bool {
        match self {
            ModelSlot::InUse { cancel, .. } => {
                cancel.cancel();
                true
            }
            _ => false,
        }
    }

    /// Unload: stop any reply and empty the slot. Returns the model if it
    /// was idle, so the caller can free it outside the lock.
    pub fn clear(&mut self) -> Option<M> {
        self.cancel_reply();
        match std::mem::take(self) {
            ModelSlot::Ready { model, .. } => Some(model),
            _ => None,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::models::catalog::Reasoning;

    fn active(id: &str) -> ActiveModel {
        ActiveModel {
            id: id.to_string(),
            name: id.to_uppercase(),
            reasoning: Reasoning::None,
            context_length: 4096,
            threads: 4,
        }
    }

    fn ready(id: &str) -> ModelSlot<String> {
        let mut slot = ModelSlot::Empty;
        slot.set_ready(active(id), format!("weights:{id}"));
        slot
    }

    #[test]
    fn empty_has_no_active_model_and_cannot_be_checked_out() {
        let mut slot: ModelSlot<String> = ModelSlot::Empty;
        assert!(slot.active().is_none());
        assert_eq!(slot.checkout(CancellationToken::new(), 1), Err(CheckoutError::NoModel));
    }

    #[test]
    fn a_model_stays_active_while_a_reply_uses_it() {
        let mut slot = ready("a");
        let model = slot.checkout(CancellationToken::new(), 1).unwrap();
        assert_eq!(model, "weights:a");
        assert!(slot.is_active("a"));
        assert_eq!(slot.checkout(CancellationToken::new(), 2), Err(CheckoutError::Busy));
        assert_eq!(slot.checkin(1, model), None);
        assert!(matches!(slot, ModelSlot::Ready { .. }));
    }

    #[test]
    fn busy_message_is_the_one_the_front_end_retries_on() {
        assert!(CheckoutError::Busy.message().contains("still busy"));
    }

    #[test]
    fn unload_during_a_reply_cancels_it_and_drops_the_model_when_it_returns() {
        let mut slot = ready("a");
        let cancel = CancellationToken::new();
        let model = slot.checkout(cancel.clone(), 1).unwrap();
        assert_eq!(slot.clear(), None);
        assert!(cancel.is_cancelled());
        assert!(slot.active().is_none());
        assert_eq!(slot.checkin(1, model), Some("weights:a".to_string()));
        assert!(slot.active().is_none());
    }

    #[test]
    fn a_stale_reply_cannot_replace_a_reloaded_copy_of_the_same_model() {
        let mut slot = ready("a");
        let old = slot.checkout(CancellationToken::new(), 1).unwrap();
        slot.clear();
        slot.set_ready(active("a"), "weights:a-reloaded".to_string());
        let new = slot.checkout(CancellationToken::new(), 2).unwrap();
        // The first reply comes back while the second has the new copy out.
        assert_eq!(slot.checkin(1, old), Some("weights:a".to_string()));
        assert_eq!(slot.checkin(2, new), None);
        match &slot {
            ModelSlot::Ready { model, .. } => assert_eq!(model, "weights:a-reloaded"),
            _ => panic!("expected the reloaded model to be ready"),
        }
    }

    #[test]
    fn switching_returns_the_previous_model_to_free() {
        let mut slot = ready("a");
        assert_eq!(slot.set_ready(active("b"), "weights:b".to_string()), Some("weights:a".to_string()));
        assert!(slot.is_active("b"));
    }

    #[test]
    fn a_lost_reply_empties_the_slot_only_for_its_own_checkout() {
        let mut slot = ready("a");
        slot.checkout(CancellationToken::new(), 1).unwrap();
        slot.lost(7);
        assert!(slot.is_active("a"));
        slot.lost(1);
        assert!(slot.active().is_none());
    }

    #[test]
    fn stop_only_signals_a_running_reply() {
        let idle = ready("a");
        assert!(!idle.cancel_reply());
        let mut busy = ready("a");
        let cancel = CancellationToken::new();
        busy.checkout(cancel.clone(), 1).unwrap();
        assert!(busy.cancel_reply());
        assert!(cancel.is_cancelled());
        // Stopping does not unload: the reply returns the model as usual.
        assert!(busy.is_active("a"));
    }
}
