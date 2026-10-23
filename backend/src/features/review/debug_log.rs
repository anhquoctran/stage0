use std::fmt;

/// Review diagnostics are intentionally emitted only by development builds.
/// Keep log call sites metadata-only: never pass prompts, source, tool arguments,
/// model output, credentials, or ACP configuration values here.
#[cfg(debug_assertions)]
pub(super) fn log(message: fmt::Arguments<'_>) {
    eprintln!(
        "[Stage0 AI review {}] {}",
        chrono::Utc::now().to_rfc3339(),
        message
    );
}

#[cfg(not(debug_assertions))]
pub(super) fn log(_: fmt::Arguments<'_>) {}

pub(super) fn safe_label(value: &str, max_chars: usize) -> String {
    value
        .chars()
        .filter(|character| !character.is_control())
        .take(max_chars)
        .collect()
}

/// Convert possibly agent/provider-controlled errors to a non-sensitive category.
pub(super) fn error_class(error: &str) -> &'static str {
    let error = error.to_ascii_lowercase();
    if error.contains("http 429") || error.contains("rate limiting") || error.contains("rate limit")
    {
        "rate_limit"
    } else if error.contains("quota") || error.contains("account usage limit") {
        "quota_exhausted"
    } else if error.contains("timeout") || error.contains("timed out") || error.contains("deadline")
    {
        "timeout"
    } else if error.contains("credential")
        || error.contains("authentication")
        || error.contains("api key")
        || error.contains("unauthorized")
    {
        "authentication"
    } else if error.contains("tool call")
        || error.contains("tool-call")
        || error.contains("function call")
    {
        "tool_call_protocol"
    } else if error.contains("budget") || error.contains("limit") {
        "safety_limit"
    } else if error.contains("cancel") {
        "cancelled"
    } else {
        "runtime_error"
    }
}
