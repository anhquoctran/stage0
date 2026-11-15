use super::state::MrSyncState;
use std::{collections::HashMap, path::PathBuf};

pub(super) struct ScanResult {
    pub states: Vec<MrSyncState>,
    pub paths: Vec<PathBuf>,
    pub healthy: bool,
    pub epochs: HashMap<String, i64>,
}
