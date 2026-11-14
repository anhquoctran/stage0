use super::{model_adapter::ReviewModelAdapter, provider, ReviewRequest, ReviewToolCall};
use serde_json::Value;
use std::{future::Future, pin::Pin};

pub struct NativeModelAdapter {
    config: ReviewRequest,
    endpoint: String,
}

impl NativeModelAdapter {
    pub fn new(config: &ReviewRequest) -> Result<Self, String> {
        Ok(Self {
            endpoint: provider::endpoint(config)?,
            config: config.clone(),
        })
    }
}

impl ReviewModelAdapter for NativeModelAdapter {
    fn initial_history(&self, prompt: &str) -> Vec<Value> {
        provider::initial_history(&self.config.provider, prompt)
    }
    fn payload(&self, system: &str, history: &[Value], tools: &[Value], max_tokens: u64) -> Value {
        provider::payload(&self.config, system, history, tools, max_tokens)
    }
    fn output_token_limit(&self, expanded: bool) -> u64 {
        if self.config.provider == "deepseek" {
            let initial = if self.config.reasoning_effort.as_deref() == Some("none") {
                8192
            } else {
                16384
            };
            if expanded {
                initial * 2
            } else {
                initial
            }
        } else {
            2048
        }
    }
    fn input_token_usage(&self, response: &Value) -> Option<u64> {
        super::provider::input_token_usage(&self.config.provider, response)
    }
    fn truncated_output_usage(&self, response: &Value) -> Option<u64> {
        (self.config.provider == "deepseek" && response["choices"][0]["finish_reason"] == "length")
            .then(|| response["usage"]["total_tokens"].as_u64().unwrap_or(0))
    }
    fn request<'a>(
        &'a self,
        body: &'a Value,
    ) -> Pin<Box<dyn Future<Output = Result<Value, String>> + Send + 'a>> {
        Box::pin(provider::request(&self.config, &self.endpoint, body))
    }
    fn decode(
        &self,
        response: &Value,
        history: &mut Vec<Value>,
    ) -> Result<(Vec<ReviewToolCall>, u64), String> {
        provider::decode(&self.config.provider, response, history)
    }
    fn append_results(&self, history: &mut Vec<Value>, results: &[(ReviewToolCall, Value)]) {
        provider::append_results(&self.config.provider, history, results)
    }
}
