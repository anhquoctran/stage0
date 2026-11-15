use std::collections::{HashMap, HashSet, VecDeque};

/// One pending entry per repository, fair ordering, latest revision wins.
#[derive(Default)]
pub(super) struct SyncQueue {
    order: VecDeque<String>,
    pending: HashMap<String, (u64, u64)>,
}
impl SyncQueue {
    pub fn mark(&mut self, root: String, now: u64) {
        if let Some((_, last)) = self.pending.get_mut(&root) {
            *last = now;
        } else {
            self.order.push_back(root.clone());
            self.pending.insert(root, (now, now));
        }
    }
    pub fn take(&mut self, now: u64, active: &HashSet<String>) -> Option<String> {
        for _ in 0..self.order.len() {
            let root = self.order.pop_front()?;
            let (first, last) = self.pending[&root];
            if !active.contains(&root)
                && (now.saturating_sub(last) >= 750 || now.saturating_sub(first) >= 2000)
            {
                self.pending.remove(&root);
                return Some(root);
            }
            self.order.push_back(root);
        }
        None
    }
    pub fn prioritize(&mut self, root: String, now: u64) {
        self.mark(root.clone(), now);
        self.order.retain(|item| item != &root);
        self.order.push_front(root);
    }
    pub fn retain(&mut self, roots: &HashSet<String>) {
        self.pending.retain(|root, _| roots.contains(root));
        self.order.retain(|root| roots.contains(root));
    }
    pub fn delay(&self, now: u64, active: &HashSet<String>) -> u64 {
        self.pending
            .iter()
            .filter(|(root, _)| !active.contains(*root))
            .map(|(_, (first, last))| (last + 750).min(first + 2000).saturating_sub(now))
            .min()
            .unwrap_or(30_000)
            .max(1)
    }
}
