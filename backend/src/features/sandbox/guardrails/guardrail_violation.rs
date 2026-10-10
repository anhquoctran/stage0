use super::GuardrailSeverity;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GuardrailViolation {
    pub rule: String,
    pub severity: GuardrailSeverity,
    pub message: String,
}
