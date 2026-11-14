//! Reserve replayed input before granting an output allowance; never change hard limits.
use crate::{
    core::db::Database,
    features::review::{model_adapter::ReviewModelAdapter, ReviewRun},
};
use serde_json::{json, Value};

const FINAL_OUTPUT_RESERVE: u64 = 4096;

#[derive(Default)]
pub(super) struct RequestBudget {
    observed_input: Option<u64>,
    observed_bytes: usize,
    pub finalizing: bool,
}
impl RequestBudget {
    pub fn prepare(
        &mut self,
        db: &Database,
        run: &ReviewRun,
        adapter: &dyn ReviewModelAdapter,
        system: &str,
        history: &mut Vec<Value>,
        tools: &[Value],
        requested_output: u64,
        token_limit: u64,
        allow_finalization: bool,
    ) -> Result<(Value, u64), String> {
        let remaining = token_limit.saturating_sub(run.usage_tokens);
        let preview = adapter.payload(system, history, tools, requested_output);
        if allow_finalization
            && !self.finalizing
            && self.should_finalize(remaining, adapter.request_size(&preview))
        {
            history.extend(
                adapter.initial_history(&self.begin_finalization(db, run, remaining)?.to_string()),
            );
        }
        let final_tools: Vec<_> = tools
            .iter()
            .filter(|tool| tool["name"] == "submit_review")
            .cloned()
            .collect();
        let active_tools = if self.finalizing {
            final_tools.as_slice()
        } else {
            tools
        };
        let preview = adapter.payload(system, history, active_tools, requested_output);
        let bytes = adapter.request_size(&preview);
        if let Some(input) = self.estimate(bytes).filter(|input| *input >= remaining) {
            db.review_event(&run.id,"budget_exhausted",json!({"resource":"estimated_request_tokens","used":run.usage_tokens,"limit":token_limit,"nextInputEstimate":input,"requestSent":false}))?;
            return Err(crate::common::messages::failure(
                "backend.review.tokenBudgetCannotContinue",
                json!({"used":run.usage_tokens,"limit":token_limit,"inputEstimate":input}),
                "Remaining review token budget cannot cover estimated next input; no request sent"
                    .into(),
            ));
        }
        let output = self.output_limit(requested_output, remaining, bytes);
        if let Some(input) = self.estimate(bytes) {
            db.review_event(&run.id,"request_budget_planned",json!({"estimatedInputTokens":input,"remainingTokens":remaining,"maxOutputTokens":output,"finalizing":self.finalizing}))?;
        }
        Ok((
            adapter.payload(system, history, active_tools, output),
            output,
        ))
    }
    pub fn observe(
        &mut self,
        db: &Database,
        run: &ReviewRun,
        adapter: &dyn ReviewModelAdapter,
        response: &Value,
        bytes: usize,
    ) -> Result<(), String> {
        self.observed_input = adapter.input_token_usage(response);
        self.observed_bytes = bytes;
        if let Some(input) = self.observed_input {
            db.review_event(
                &run.id,
                "model_input_usage",
                json!({"turn":run.turns,"reportedInputTokens":input,"requestBytes":bytes}),
            )?;
        }
        Ok(())
    }
    fn estimate(&self, bytes: usize) -> Option<u64> {
        let input = self.observed_input?;
        if bytes >= self.observed_bytes {
            // New Unicode/source/reasoning may tokenize more densely than old context.
            Some(
                input
                    .saturating_add(bytes.saturating_sub(self.observed_bytes) as u64)
                    .saturating_add(256),
            )
        } else {
            // Dropping schemas reduces framing too. This is an estimate, never billing.
            Some(
                input
                    .saturating_mul(bytes as u64)
                    .div_ceil(self.observed_bytes.max(1) as u64)
                    .saturating_add(256),
            )
        }
    }
    pub fn should_finalize(&self, remaining: u64, bytes: usize) -> bool {
        self.finalizing
            || self.estimate(bytes).is_some_and(|input| {
                remaining < input.saturating_mul(2).saturating_add(FINAL_OUTPUT_RESERVE)
            })
    }
    pub fn output_limit(&self, requested: u64, remaining: u64, bytes: usize) -> u64 {
        // Keep a positive protocol allowance; the post-response hard budget remains authoritative.
        requested.min(
            remaining
                .saturating_sub(self.estimate(bytes).unwrap_or(0))
                .max(1),
        )
    }
    pub fn begin_finalization(
        &mut self,
        db: &Database,
        run: &ReviewRun,
        remaining: u64,
    ) -> Result<Value, String> {
        self.finalizing = true;
        db.review_event(&run.id,"budget_finalization",json!({"remainingTokens":remaining,"observedInputTokens":self.observed_input,"hardLimitChanged":false}))?;
        Ok(
            json!({"kind":"review_budget_finalization","remainingTokens":remaining,
            "instruction":"The remaining cumulative token budget must cover replayed input and the final output. Only submit_review is available now. Submit findings already supported by observed evidence and summarize coverage limits. Use comment if investigation or discussion inspection remains incomplete. Never invent evidence, claim unread coverage, resolve unverified discussions or manufacture approval. Queued findings/actions remain staged for the same guarded submission."}),
        )
    }
}
