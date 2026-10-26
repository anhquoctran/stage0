use std::collections::{HashMap, HashSet};

/// Delivery state belongs to the host, never to fields supplied by the model.
pub(super) struct DiscussionObservation {
    pub revision: String,
    pub root_id: String,
    pub target_id: String,
    ends: HashMap<String, usize>,
    complete: HashSet<String>,
}

impl DiscussionObservation {
    pub fn new(revision: String, root_id: String, target_id: String) -> Self {
        Self {
            revision,
            root_id,
            target_id,
            ends: HashMap::new(),
            complete: HashSet::new(),
        }
    }

    pub fn record(&mut self, id: &str, offset: usize, end: usize, total: usize) {
        let delivered = self.ends.entry(id.to_owned()).or_default();
        if offset <= *delivered {
            *delivered = (*delivered).max(end);
            if *delivered == total {
                self.complete.insert(id.to_owned());
            }
        }
    }

    pub fn validate(&self, revision: &str, target: &str) -> Result<(), String> {
        if self.revision != revision || self.target_id != target {
            return Err(
                "Discussion changed or target does not match the context you read. Read it again."
                    .into(),
            );
        }
        if !self.complete.contains(&self.root_id) || !self.complete.contains(&self.target_id) {
            return Err("Read the complete root and latest comment with read_discussion_comment before acting.".into());
        }
        Ok(())
    }
}
