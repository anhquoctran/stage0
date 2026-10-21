use super::AcpRegistryAgent;
use serde::Deserialize;

#[derive(Deserialize)]
pub(super) struct RegistryPayload {
    pub agents: Vec<AcpRegistryAgent>,
}
