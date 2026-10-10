use super::GuardrailViolation;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GuardrailAuditEvent {
    pub id: String,
    pub timestamp: i64,
    pub tool_name: String,
    pub action_summary: String,
    pub allowed: bool,
    pub risk_score: u32,
    pub violations: Vec<GuardrailViolation>,
}
