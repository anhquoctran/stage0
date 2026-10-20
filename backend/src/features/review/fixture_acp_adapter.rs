use super::{
    acp_model_adapter::AcpModelAdapter, model_adapter::ReviewModelAdapter, ReviewToolCall,
};
use crate::features::ai::acp::AcpAgentConfig;
use serde_json::Value;
use std::{collections::VecDeque, future::Future, pin::Pin, sync::Mutex};

/// Replay ACP text responses through the production codec without launching
/// an agent, contacting a provider, or sharing repository data externally.
pub struct FixtureAcpAdapter {
    codec: AcpModelAdapter,
    replies: Mutex<VecDeque<Value>>,
    pub requests: Mutex<Vec<Value>>,
}

impl FixtureAcpAdapter {
    pub fn new(replies: Vec<Value>) -> Self {
        Self {
            codec: AcpModelAdapter::new(
                AcpAgentConfig {
                    id: "fixture-acp".into(),
                    name: "Fixture ACP".into(),
                    version: None,
                    description: None,
                    source: "custom".into(),
                    command: "unused".into(),
                    launch_mode: None,
                    args: vec![],
                },
                Value::Null,
            ),
            replies: Mutex::new(replies.into()),
            requests: Mutex::new(vec![]),
        }
    }
}

impl ReviewModelAdapter for FixtureAcpAdapter {
    fn initial_history(&self, prompt: &str) -> Vec<Value> {
        self.codec.initial_history(prompt)
    }

    fn payload(&self, system: &str, history: &[Value], tools: &[Value], max_tokens: u64) -> Value {
        self.codec.payload(system, history, tools, max_tokens)
    }

    fn request_size(&self, _body: &Value) -> usize {
        0
    }

    fn request<'a>(
        &'a self,
        body: &'a Value,
    ) -> Pin<Box<dyn Future<Output = Result<Value, String>> + Send + 'a>> {
        Box::pin(async move {
            self.requests.lock().unwrap().push(body.clone());
            self.replies
                .lock()
                .unwrap()
                .pop_front()
                .ok_or("Missing fixture ACP reply".into())
        })
    }

    fn decode(
        &self,
        response: &Value,
        history: &mut Vec<Value>,
    ) -> Result<(Vec<ReviewToolCall>, u64), String> {
        self.codec.decode(response, history)
    }

    fn recover_decode_error(&self, error: &str, history: &mut Vec<Value>) -> bool {
        self.codec.recover_decode_error(error, history)
    }

    fn append_results(&self, history: &mut Vec<Value>, results: &[(ReviewToolCall, Value)]) {
        self.codec.append_results(history, results)
    }
}
