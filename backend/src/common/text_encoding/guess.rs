use super::TextEncoding;
use serde::Serialize;

/// Confidence describes evidence strength, never a probability of certainty.
#[derive(Debug, Clone, Serialize)]
pub struct EncodingGuess {
    pub encoding: TextEncoding,
    pub confidence: f32,
    pub method: &'static str,
    pub bom: bool,
    pub alternatives: Vec<TextEncoding>,
}
