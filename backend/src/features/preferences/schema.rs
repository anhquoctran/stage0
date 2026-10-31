use super::supported_language::{is_supported_agent_output_language, is_supported_app_language};
use super::validation_fields::{
    object_section, validate_enum_string, validate_optional_bool, validate_optional_enum,
    validate_optional_integer, validate_optional_number, validate_optional_string,
};
use super::validation_records::{validate_git_credential, validate_mcp_server, validate_reviewer};
use serde_json::Value;

pub(super) fn validate_schema(value: &Value) -> Result<(), String> {
    if let Some(references) = value.get("credentialReferences") {
        let references = references
            .as_object()
            .ok_or_else(|| crate::common::messages::failure("backend.preferences.credentialReferencesMustBeObject", serde_json::json!({}), "credentialReferences must be an object".into()))?;
        if references.len() > 512
            || references.iter().any(|(logical, id)| {
                logical.len() > 280
                    || !(matches!(
                        logical.strip_prefix("ai/"),
                        Some(
                            "openai"
                                | "anthropic"
                                | "gemini"
                                | "xai_grok"
                                | "deepseek"
                                | "qwen"
                                | "kimi"
                                | "ollama"
                                | "custom"
                                | "zai"
                                | "z_ai"
                                | "opencode"
                        )
                    ) || logical.strip_prefix("mcp_server/").is_some_and(|id| {
                        !id.is_empty() && id.len() <= 256 && !id.chars().any(char::is_control)
                    }))
                    || !(id.is_null()
                        || id.as_str().is_some_and(|id| {
                            id.len() == 36
                                && id.starts_with("txn/")
                                && id[4..].bytes().all(|b| b.is_ascii_hexdigit())
                        }))
            })
        {
            return Err(crate::common::messages::failure("backend.preferences.credentialReferenceMetadataInvalid", serde_json::json!({}), "Invalid credential reference metadata".into()));
        }
    }
    if let Some(keymap) = value.get("keymap") {
        crate::core::keymaps::validate_settings(keymap)?;
    }
    let general = object_section(value, "general")?;
    validate_optional_bool(general, "showInlineBlame", "general")?;
    validate_optional_bool(general, "streamResponse", "general")?;
    validate_optional_bool(general, "enableCodeReviewAssist", "general")?;
    validate_optional_bool(general, "launchAtStartup", "general")?;
    validate_optional_bool(general, "startInBackground", "general")?;
    validate_optional_bool(general, "autoCheckUpdates", "general")?;
    validate_optional_bool(general, "explorerContextMenu", "general")?;
    validate_optional_bool(general, "addToPath", "general")?;

    let appearance = object_section(value, "appearance")?;
    if let Some(language) = appearance.get("language") {
        let language = language
            .as_str()
            .ok_or_else(|| crate::common::messages::failure("backend.preferences.appearanceLanguageInvalid", serde_json::json!({}), "appearance.language must be one of the supported app locales".into()))?;
        if !is_supported_app_language(language) {
            return Err(crate::common::messages::failure("backend.preferences.appearanceLanguageInvalid", serde_json::json!({}), "appearance.language must be one of the supported app locales".into()));
        }
    }
    if let Some(font) = appearance.get("uiFont") {
        let font = font
            .as_object()
            .ok_or_else(|| crate::common::messages::failure("backend.preferences.uiFontMustBeObject", serde_json::json!({}), "appearance.uiFont must be an object".into()))?;
        validate_optional_string(font, "fontFamily", "appearance.uiFont", 128, false)?;
    }
    if let Some(mode) = appearance.get("linuxTitleBar") {
        if !matches!(mode.as_str(), Some("system" | "custom")) {
            return Err(crate::common::messages::failure("backend.preferences.linuxTitleBarInvalid", serde_json::json!({}), "appearance.linuxTitleBar must be system or custom".into()));
        }
    }
    if let Some(theme) = appearance.get("themeMode") {
        if !matches!(theme.as_str(), Some("system" | "dark" | "light")) {
            return Err(crate::common::messages::failure("backend.preferences.themeModeInvalid", serde_json::json!({}), "appearance.themeMode must be 'system', 'dark', or 'light'".into()));
        }
    }
    if let Some(font) = appearance.get("viewerFont") {
        let font = font
            .as_object()
            .ok_or_else(|| crate::common::messages::failure("backend.preferences.viewerFontMustBeObject", serde_json::json!({}), "appearance.viewerFont must be an object".into()))?;
        validate_optional_string(font, "fontFamily", "appearance.viewerFont", 128, false)?;
        validate_optional_number(font, "fontSize", "appearance.viewerFont", 6.0, 96.0)?;
        validate_optional_bool(font, "isBold", "appearance.viewerFont")?;
        validate_optional_bool(font, "isItalic", "appearance.viewerFont")?;
        validate_optional_bool(font, "isUnderline", "appearance.viewerFont")?;
        validate_optional_number(font, "lineSpacing", "appearance.viewerFont", 0.5, 4.0)?;
        validate_optional_bool(font, "enableLigatures", "appearance.viewerFont")?;
    }

    let ai = object_section(value, "ai")?;
    if let Some(language) = ai.get("agentOutputLanguage") {
        let language = language
            .as_str()
            .ok_or_else(|| crate::common::messages::failure("backend.preferences.agentOutputLanguageInvalid", serde_json::json!({}), "ai.agentOutputLanguage must be a supported locale or follow-app".into()))?;
        if !is_supported_agent_output_language(language) {
            return Err(crate::common::messages::failure("backend.preferences.agentOutputLanguageInvalid", serde_json::json!({}), "ai.agentOutputLanguage must be a supported locale or follow-app".into()));
        }
    }
    if let Some(config) = ai.get("aiConfig") {
        let config = config.as_object().ok_or_else(|| crate::common::messages::failure("backend.preferences.aiConfigMustBeObject", serde_json::json!({}), "ai.aiConfig must be an object".into()))?;
        if !config.is_empty() {
            validate_enum_string(
                config,
                "provider",
                "ai.aiConfig",
                &[
                    "openai",
                    "anthropic",
                    "gemini",
                    "xai_grok",
                    "deepseek",
                    "qwen",
                    "kimi",
                    "github_copilot",
                    "ollama",
                    "custom",
                    "zai",
                    "z_ai",
                    "opencode",
                ],
            )?;
            validate_optional_enum(
                config,
                "authMode",
                "ai.aiConfig",
                &["api_key", "subscription_oauth", "cli_bridge"],
            )?;
            validate_optional_enum(
                config,
                "cliType",
                "ai.aiConfig",
                &["claude", "gh_copilot", "gcloud", "grok"],
            )?;
            validate_optional_string(config, "model", "ai.aiConfig", 512, false)?;
            validate_optional_string(config, "baseUrl", "ai.aiConfig", 4096, false)?;
            if let Some(api_key) = config.get("apiKey") {
                if api_key.as_str().is_none_or(|key| !key.is_empty()) {
                    return Err(crate::common::messages::failure("backend.preferences.apiKeyMustBeOmitted", serde_json::json!({}), "ai.aiConfig.apiKey must be omitted or empty; credentials belong in the OS keychain".into()));
                }
            }
            validate_optional_number(config, "temperature", "ai.aiConfig", 0.0, 2.0)?;
            validate_optional_enum(
                config,
                "reasoningEffort",
                "ai.aiConfig",
                &["none", "minimal", "low", "medium", "high", "xhigh", "max"],
            )?;
            validate_optional_bool(config, "fastMode", "ai.aiConfig")?;
            validate_optional_integer(config, "maxTokens", "ai.aiConfig", 1, 1_000_000)?;
            validate_optional_string(config, "reviewerInstructions", "ai.aiConfig", 32_000, true)?;
            validate_optional_bool(config, "streamResponse", "ai.aiConfig")?;
            validate_optional_bool(config, "enableCodeReviewAssist", "ai.aiConfig")?;
        }
    }
    if let Some(servers) = ai.get("mcpServers") {
        let servers = servers.as_array().ok_or_else(|| crate::common::messages::failure("backend.preferences.mcpServersMustBeArray", serde_json::json!({}), "ai.mcpServers must be an array".into()))?;
        if servers.len() > 256 {
            return Err(crate::common::messages::failure("backend.preferences.mcpServersLimitExceeded", serde_json::json!({}), "ai.mcpServers cannot contain more than 256 entries".into()));
        }
        for (index, server) in servers.iter().enumerate() {
            validate_mcp_server(server, index)?;
        }
    }
    if let Some(policy) = ai.get("guardrailPolicy") {
        serde_json::from_value::<crate::features::sandbox::GuardrailPolicy>(policy.clone())
            .map_err(|_| {
                "ai.guardrailPolicy does not match the supported policy schema".to_string()
            })?;
    }

    let reviewers = value["reviewers"]
        .as_array()
        .ok_or_else(|| crate::common::messages::failure("backend.preferences.reviewersMustBeArray", serde_json::json!({}), "reviewers must be an array".into()))?;
    if reviewers.len() > 256 {
        return Err(crate::common::messages::failure("backend.preferences.reviewersLimitExceeded", serde_json::json!({}), "reviewers cannot contain more than 256 entries".into()));
    }
    for (index, reviewer) in reviewers.iter().enumerate() {
        validate_reviewer(reviewer, index)?;
    }

    let sandbox = object_section(value, "sandbox")?;
    if let Some(kind) = sandbox.get("type") {
        serde_json::from_value::<crate::features::sandbox::SandboxType>(kind.clone()).map_err(
            |_| "sandbox.type must be 'in_memory', 'local_worktree', or 'docker'".to_string(),
        )?;
    }

    let git = object_section(value, "git")?;
    validate_optional_string(git, "binaryId", "git", 256, false)?;
    validate_optional_string(git, "binaryPath", "git", 4096, false)?;

    let notifications = object_section(value, "notifications")?;
    if let Some(channels) = notifications.get("channels") {
        let channels = channels
            .as_object()
            .ok_or_else(|| crate::common::messages::failure("backend.preferences.notificationChannelsMustBeObject", serde_json::json!({}), "notifications.channels must be an object".into()))?;
        validate_optional_bool(channels, "aiReview", "notifications.channels")?;
        validate_optional_bool(channels, "gitSync", "notifications.channels")?;
        validate_optional_bool(channels, "guardrails", "notifications.channels")?;
    }

    if let Some(credentials) = value.get("gitCredentials") {
        let credentials = credentials
            .as_array()
            .ok_or_else(|| crate::common::messages::failure("backend.preferences.gitCredentialsMustBeArray", serde_json::json!({}), "gitCredentials must be an array".into()))?;
        if credentials.len() > 10_000 {
            return Err(crate::common::messages::failure("backend.preferences.gitCredentialsLimitExceeded", serde_json::json!({}), "gitCredentials cannot contain more than 10,000 entries".into()));
        }
        for (index, credential) in credentials.iter().enumerate() {
            validate_git_credential(credential, index)?;
        }
    }
    Ok(())
}
