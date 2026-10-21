use super::AcpRegistryAgent;
use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AcpRegistry {
    pub agents: Vec<AcpRegistryAgent>,
    pub supported_binary_target: Option<String>,
}
