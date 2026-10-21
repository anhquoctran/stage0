//! Immutable snapshot state; reads and evidence validation use the same captured object IDs.
mod blob;
mod evidence;
mod snapshot;
mod tools;

use super::ReviewSnapshot;
use crate::features::sandbox::guardrails::GuardrailsEngine;
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
    guards: Arc<GuardrailsEngine>,
    diff_offsets: HashMap<String, usize>,
}

impl ReviewContext {
    pub fn new(snapshot: ReviewSnapshot, guards: Arc<GuardrailsEngine>) -> Self {
        Self {
            snapshot,
            guards,
            inspected: BTreeSet::new(),
            complete_diffs: BTreeSet::new(),
            limited: false,
            bytes: 0,
            diff_offsets: HashMap::new(),
        }
    }
}

#[cfg(test)]
mod tests;
