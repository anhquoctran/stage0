use super::NotificationActionEvent;
use std::collections::{HashMap, HashSet};

#[derive(Default)]
pub(super) struct RuntimeState {
    pub ready: HashSet<String>,
    pub generations: HashMap<String, u64>,
    pub pending: Vec<NotificationActionEvent>,
}

impl RuntimeState {
    pub fn accepts_action(label: &str, action_type: &str) -> bool {
        // The utility window has no notification history drawer or repository UI.
        label != "preferences" || matches!(action_type, "open_preferences" | "open_url")
    }

    pub fn take_pending_for(&mut self, label: &str) -> Vec<NotificationActionEvent> {
        let (deliver, pending) = std::mem::take(&mut self.pending)
            .into_iter()
            .partition(|event| Self::accepts_action(label, &event.action.action_type));
        self.pending = pending;
        deliver
    }

    pub fn set_ready(&mut self, label: &str, generation: u64, ready: bool) -> bool {
        if self
            .generations
            .get(label)
            .is_some_and(|current| *current > generation)
        {
            return false;
        }
        self.generations.insert(label.into(), generation);
        if ready {
            self.ready.insert(label.into());
        } else {
            self.ready.remove(label);
        }
        true
    }
    pub fn queue(&mut self, event: NotificationActionEvent) {
        if self.pending.len() == 50 {
            self.pending.remove(0);
        }
        self.pending.push(event);
    }
}
