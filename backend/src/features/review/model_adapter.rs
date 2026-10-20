use super::{ReviewModelFailure, ReviewToolCall};
use serde_json::Value;
use std::{future::Future, pin::Pin};

/// Model adapters may produce tool requests, but never execute them. The common
/// runtime retains tool authorization, source filtering, budgets and publishing.
pub trait ReviewModelAdapter: Send + Sync {
    fn initial_history(&self, prompt: &str) -> Vec<Value>;
    fn payload(&self, system: &str, history: &[Value], tools: &[Value], max_tokens: u64) -> Value;

    /// Approximate bytes sent for this turn. Stateful adapters may send only a
    /// delta while retaining the full in-memory harness history.
    fn request_size(&self, body: &Value) -> usize {
        body.to_string().len()
    }

    /// Reserve one possible retry for stateless HTTP providers by default.
    fn retry_reserve_factor(&self) -> usize {
        2
    }

    fn request<'a>(
        &'a self,
        body: &'a Value,
    ) -> Pin<Box<dyn Future<Output = Result<Value, String>> + Send + 'a>>;
    fn decode(
        &self,
        response: &Value,
        history: &mut Vec<Value>,
    ) -> Result<(Vec<ReviewToolCall>, u64), String>;

    /// Stateful text bridges may ask the agent to repair an invalid response.
    /// The runtime bounds these attempts and never executes undecoded output.
    fn recover_decode_error(&self, _error: &str, _history: &mut Vec<Value>) -> bool {
        false
    }

    fn response_failure(&self, _response: &Value) -> Option<ReviewModelFailure> {
        None
    }

    fn append_request_retry(&self, _history: &mut Vec<Value>) {}

    fn append_results(&self, history: &mut Vec<Value>, results: &[(ReviewToolCall, Value)]);
}
