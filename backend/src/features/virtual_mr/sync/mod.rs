//! Bounded, local-only revision synchronization; never schedules model calls.
mod commands;
mod epochs;
mod git_refs;
mod migration;
mod persistence;
mod queue;
mod ref_watcher;
mod review_state;
mod runtime;
mod scan_result;
mod state;
mod state_reads;
mod subscription;
mod tracked_mr;
mod worker;
pub(crate) use commands::{membership, read_states, session_saved};
pub(crate) use migration::migrate;
pub(crate) use review_state::{complete_review, guard_saved, validate_publication};
pub(crate) use runtime::{registry_changed, repository_changed};
pub use runtime::{start, MrSyncRuntime};
pub use state::MrSyncState;
pub(crate) use worker::{check_refs, observe_review, verify_review};
#[cfg(test)]
mod tests;
