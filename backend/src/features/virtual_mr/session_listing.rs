use super::{persistence::VirtualMrSessionDb,sync::MrSyncState};

/// Existing session arrays retain their wire shape; the explicit lightweight
/// mode uses the same repository-scoped read operation without loading threads.
#[derive(serde::Serialize)]
#[serde(untagged)]
pub enum SessionListing {
    Sessions(Vec<VirtualMrSessionDb>),
    Revisions(Vec<MrSyncState>),
}
