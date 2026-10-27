//! Immutable snapshot state; reads and evidence validation use the same captured object IDs.
mod blob;
mod diff;
mod diff_batch;
mod discussion_snippet;
mod evidence;
mod snapshot;
mod tools;

use super::ReviewSnapshot;
use crate::features::sandbox::guardrails::GuardrailsEngine;
pub(crate) use diff_batch::PreparedDiffBatch;
pub use snapshot::{capture, git, resolve_snapshot_ref};
use std::{
    collections::{BTreeSet, HashMap},
    sync::Arc,
};

pub struct ReviewContext {
    pub snapshot: ReviewSnapshot,
    pub inspected: BTreeSet<String>,
    pub complete_diffs: BTreeSet<String>,
    pub limited: bool,
    pub bytes: usize,
    pub max_bytes: usize,
    guards: Arc<GuardrailsEngine>,
    diff_offsets: HashMap<String, usize>,
    diff_cache: HashMap<String, Arc<diff::SnapshotDiff>>,
    diff_cache_bytes: usize,
}

impl ReviewContext {
    pub(crate) fn deliver_external(
        &mut self,
        name: &str,
        value: serde_json::Value,
    ) -> Result<serde_json::Value, String> {
        let bytes = value.to_string().len();
        if self.guards.evaluate_review_output(name, bytes).is_err()
            || bytes > 24 * 1024
            || self.bytes.saturating_add(bytes) > self.max_bytes
        {
            self.limited = true;
            return Err(
                "Review context byte budget exceeded or discussion output blocked by policy".into(),
            );
        }
        self.bytes = self.bytes.saturating_add(bytes);
        Ok(value)
    }

    pub fn new(snapshot: ReviewSnapshot, guards: Arc<GuardrailsEngine>) -> Self {
        Self {
            snapshot,
            guards,
            inspected: BTreeSet::new(),
            complete_diffs: BTreeSet::new(),
            limited: false,
            bytes: 0,
            max_bytes: 128 * 1024,
            diff_offsets: HashMap::new(),
            diff_cache: HashMap::new(),
            diff_cache_bytes: 0,
        }
    }
}

#[cfg(test)]
mod tests;
