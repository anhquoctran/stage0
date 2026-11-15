//! Observed input is for planning/diagnostics only; total-token accounting is unchanged.
use serde_json::Value;

pub(crate) fn input_token_usage(provider: &str, response: &Value) -> Option<u64> {
    match provider {
        "openai" => response["usage"]["input_tokens"].as_u64(),
        "anthropic" => response["usage"]["input_tokens"].as_u64().map(|input| {
            input
                .saturating_add(
                    response["usage"]["cache_creation_input_tokens"]
                        .as_u64()
                        .unwrap_or(0),
                )
                .saturating_add(
                    response["usage"]["cache_read_input_tokens"]
                        .as_u64()
                        .unwrap_or(0),
                )
        }),
        "gemini" => response["usageMetadata"]["promptTokenCount"].as_u64(),
        "ollama" => response["prompt_eval_count"].as_u64(),
        _ => response["usage"]["prompt_tokens"].as_u64(),
    }
    .filter(|tokens| *tokens > 0)
}
