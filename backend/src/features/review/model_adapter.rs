use super::ReviewToolCall;
use serde_json::Value;
use std::{future::Future, pin::Pin};

/// Model adapters may produce tool requests, but never execute them. The common
/// runtime retains tool authorization, source filtering, budgets and publishing.
pub trait ReviewModelAdapter: Send + Sync {
    fn initial_history(&self, prompt: &str) -> Vec<Value>;
    fn payload(&self, system: &str, history: &[Value], tools: &[Value], max_tokens: u64) -> Value;
    fn request<'a>(
        &'a self,
        body: &'a Value,
    ) -> Pin<Box<dyn Future<Output = Result<Value, String>> + Send + 'a>>;
    fn decode(
        &self,
        response: &Value,
        history: &mut Vec<Value>,
    ) -> Result<(Vec<ReviewToolCall>, u64), String>;
    fn append_results(&self, history: &mut Vec<Value>, results: &[(ReviewToolCall, Value)]);
}
