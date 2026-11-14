use super::discussion_observation::DiscussionObservation;
use crate::features::review::{persistence::ReviewDiscussionAction, ReviewFinding};
use std::collections::{HashMap, HashSet};

/// Mutable state for a single bounded review run; actions remain staged until submission.
pub(super) struct ReviewToolState {
    pub had_errors: bool,
    pub finalizing: bool,
    pub workflow_phase: Option<&'static str>,
    pub pending_findings: Vec<ReviewFinding>,
    pub pending_discussion_actions: Vec<ReviewDiscussionAction>,
    pub description_updated: bool,
    pub description_must_be_empty: bool,
    pub replied_discussions: HashSet<String>,
    pub resolved_discussions: HashSet<String>,
    pub observations: HashMap<String, DiscussionObservation>,
    pub reply_discussion_id: Option<String>,
    pub reply_file_path: Option<String>,
}

impl ReviewToolState {
    pub fn new(generate_description: bool) -> Self {
        Self {
            had_errors: false,
            finalizing: false,
            workflow_phase: None,
            pending_findings: Vec::new(),
            pending_discussion_actions: Vec::new(),
            description_updated: !generate_description,
            description_must_be_empty: false,
            replied_discussions: HashSet::new(),
            resolved_discussions: HashSet::new(),
            observations: HashMap::new(),
            reply_discussion_id: None,
            reply_file_path: None,
        }
    }
}
