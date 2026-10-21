use crate::features::review::ReviewRequest;

const OPENAI_API_BASE_URL: &str = "https://api.openai.com/v1";

fn openai_reasoning_efforts(model: &str) -> &'static [&'static str] {
    match model {
        "gpt-6-astra" | "gpt-6.1-sol" => &["low", "medium", "high", "xhigh", "max"],
        "gpt-6-sol" | "gpt-6-luna" | "gpt-5.6-sol" | "gpt-5.6-terra" | "gpt-5.6-luna" => {
            &["none", "low", "medium", "high", "xhigh", "max"]
        }
        "gpt-5.5" => &["none", "low", "medium", "high", "xhigh"],
        _ => &[],
    }
}

fn openai_supports_fast_mode(model: &str) -> bool {
    matches!(
        model,
        "gpt-6-astra" | "gpt-6.1-sol" | "gpt-6-sol" | "gpt-6-luna" | "gpt-5.6-sol"
    )
}

pub(super) fn anthropic_supports_forced_tool_choice(model: &str) -> bool {
    // Claude 5.5/5.1 frontier models currently reject tool_choice=any. Only
    // force calls for the Anthropic models Stage0 explicitly knows support it;
    // unknown IDs use auto plus the review prompt and bounded retry instead.
    ["claude-haiku-4-5", "claude-3-7-sonnet", "claude-3-5-sonnet"]
        .iter()
        .any(|prefix| model.starts_with(prefix))
}

pub fn endpoint(config: &ReviewRequest) -> Result<String, String> {
    if config.model.trim().is_empty()
        || config.model.len() > 200
        || config.instructions.len() > 8000
    {
        return Err("Invalid model or instruction length".into());
    }
    if config.auth_mode != "api_key" {
        return Err("Built-in providers require API-key authentication. Use External Agents for cloud subscription sign-in.".into());
    }
    let url =
        reqwest::Url::parse(config.base_url.trim()).map_err(|_| "Invalid provider base URL")?;
    let local = matches!(
        url.host_str(),
        Some("localhost" | "127.0.0.1" | "[::1]" | "::1")
    );
    if !url.username().is_empty()
        || url.password().is_some()
        || url.query().is_some()
        || url.fragment().is_some()
        || (!local && url.scheme() != "https")
        || !matches!(url.scheme(), "https" | "http")
    {
        return Err("Provider URL must be HTTPS (HTTP only on loopback), without credentials/query/fragment".into());
    }
    if !local && !config.allow_remote {
        return Err(
            "Explicit consent is required before sharing source with a remote provider".into(),
        );
    }
    let root = url.as_str().trim_end_matches('/');
    if let Some(effort) = config.reasoning_effort.as_deref() {
        if config.provider != "openai"
            || root != OPENAI_API_BASE_URL
            || !openai_reasoning_efforts(&config.model).contains(&effort)
        {
            return Err(
                "The selected provider/model does not declare support for this reasoning effort"
                    .into(),
            );
        }
    }
    if config.fast_mode
        && (config.provider != "openai"
            || root != OPENAI_API_BASE_URL
            || !openai_supports_fast_mode(&config.model))
    {
        return Err("Fast mode is not supported for the selected provider/model".into());
    }
    let suffix=match config.provider.as_str(){
        "openai" if root=="https://api.openai.com/v1"=>"responses",
        "anthropic" if root=="https://api.anthropic.com/v1"=>"messages",
        "gemini" if root=="https://generativelanguage.googleapis.com/v1beta"=>"gemini",
        "xai_grok" if root=="https://api.x.ai/v1"=>"chat/completions",
        "custom"=>"chat/completions",
        "ollama" if local=>"api/chat",
        _=>return Err("Unsupported provider/base URL combination. Use its official endpoint, or a separately configured Custom API key.".into()),
    };
    if suffix == "gemini" {
        if !config
            .model
            .bytes()
            .all(|b| b.is_ascii_alphanumeric() || b == b'-' || b == b'_' || b == b'.')
        {
            return Err("Invalid Gemini model ID".into());
        }
        return Ok(format!("{root}/models/{}:generateContent", config.model));
    }
    Ok(format!("{root}/{suffix}"))
}
