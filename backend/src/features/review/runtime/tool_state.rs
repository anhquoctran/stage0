use crate::features::review::{persistence::ReviewDiscussionAction, ReviewFinding};
use std::collections::HashSet;

/// Mutable state for a single bounded review run; actions remain staged until submission.
pub(super) struct ReviewToolState {
    pub had_errors: bool,
    pub pending_findings: Vec<ReviewFinding>,
    pub pending_discussion_actions: Vec<ReviewDiscussionAction>,
    pub description_updated: bool,
    pub replied_discussions: HashSet<String>,
    pub resolved_discussions: HashSet<String>,
}

impl ReviewToolState {
    pub fn new(generate_description: bool) -> Self {
        Self {
            had_errors: false,
            pending_findings: Vec::new(),
            pending_discussion_actions: Vec::new(),
            description_updated: !generate_description,
            replied_discussions: HashSet::new(),
            resolved_discussions: HashSet::new(),
        }
    }
}
