use super::{SandboxCapabilities, SandboxType};
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct SandboxAdapterInfo {
    pub adapter_type: SandboxType,
    pub name: String,
    pub description: String,
    pub is_available: bool,
    pub version_info: Option<String>,
    pub status_message: String,
    pub capabilities: SandboxCapabilities,
}
