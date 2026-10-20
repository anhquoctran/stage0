use super::{
    connectors::cli_protocol, model_adapter::ReviewModelAdapter, tool_registry::ReviewToolRegistry,
    ReviewToolCall,
};
use serde_json::{json, Value};
use std::{collections::VecDeque, future::Future, pin::Pin, sync::Mutex};

/// Test-only structured CLI emulator. It never starts an actual CLI process.
pub struct FixtureCliAdapter {
    replies: Mutex<VecDeque<Value>>,
    pub requests: Mutex<Vec<Value>>,
}
impl FixtureCliAdapter {
    pub fn new(replies: Vec<Value>) -> Self {
        Self {
            replies: Mutex::new(replies.into()),
            requests: Mutex::new(vec![]),
        }
    }
}
impl ReviewModelAdapter for FixtureCliAdapter {
    fn initial_history(&self, prompt: &str) -> Vec<Value> {
        vec![json!({"role":"user","content":prompt})]
    }
    fn payload(&self, system: &str, history: &[Value], tools: &[Value], max_tokens: u64) -> Value {
        cli_protocol::turn_request(system, history, tools, max_tokens).unwrap()
    }
    fn request_size(&self, _body: &Value) -> usize {
        0
    }
    fn retry_reserve_factor(&self) -> usize {
        1
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
                .ok_or("Missing fixture CLI reply".into())
        })
    }
    fn decode(
        &self,
        response: &Value,
        history: &mut Vec<Value>,
    ) -> Result<(Vec<ReviewToolCall>, u64), String> {
        let result = cli_protocol::decode_turn(
            response.to_string().as_bytes(),
            &ReviewToolRegistry::native(),
        )?;
        history.push(json!({"role":"assistant","toolCalls":response["toolCalls"]}));
        Ok(result)
    }
    fn append_results(&self, history: &mut Vec<Value>, results: &[(ReviewToolCall, Value)]) {
        history.push(json!({"role":"tool","results":results.iter().map(|(call,value)|json!({"id":call.id,"result":value})).collect::<Vec<_>>()}));
    }
}
