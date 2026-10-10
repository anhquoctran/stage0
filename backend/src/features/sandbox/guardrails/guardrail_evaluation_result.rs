use super::GuardrailViolation;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GuardrailEvaluationResult {
    pub allowed: bool,
    pub risk_score: u32,
    pub violations: Vec<GuardrailViolation>,
    pub requires_confirmation: bool,
}
