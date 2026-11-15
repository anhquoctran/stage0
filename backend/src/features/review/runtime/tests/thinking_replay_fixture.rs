//! Shared replay support must survive replacement of frozen test case files.
use super::continuation_tests::PlanningModel;
use crate::features::review::{model_adapter::ReviewModelAdapter, ReviewToolCall};
use serde_json::Value;
use std::{future::Future, pin::Pin};

pub(super) fn replay(responses: Vec<Value>) -> impl ReviewModelAdapter {
    ThinkingReplay {
        inner: PlanningModel::new(responses),
    }
}

struct ThinkingReplay {
    inner: PlanningModel,
}

impl ReviewModelAdapter for ThinkingReplay {
    fn initial_history(&self, prompt: &str) -> Vec<Value> {
        self.inner.initial_history(prompt)
    }
    fn payload(&self, system: &str, history: &[Value], tools: &[Value], limit: u64) -> Value {
        self.inner.payload(system, history, tools, limit)
    }
    fn output_token_limit(&self, expanded: bool) -> u64 {
        if expanded {
            32768
        } else {
            16384
        }
    }
    fn minimum_output_tokens(&self) -> u64 {
        4096
    }
    fn input_token_usage(&self, response: &Value) -> Option<u64> {
        self.inner.input_token_usage(response)
    }
    fn truncated_output_usage(&self, response: &Value) -> Option<u64> {
        self.inner.truncated_output_usage(response)
    }
    fn request<'a>(
        &'a self,
        body: &'a Value,
    ) -> Pin<Box<dyn Future<Output = Result<Value, String>> + Send + 'a>> {
        self.inner.request(body)
    }
    fn decode(
        &self,
        response: &Value,
        history: &mut Vec<Value>,
    ) -> Result<(Vec<ReviewToolCall>, u64), String> {
        self.inner.decode(response, history)
    }
    fn append_results(&self, history: &mut Vec<Value>, results: &[(ReviewToolCall, Value)]) {
        self.inner.append_results(history, results)
    }
}
