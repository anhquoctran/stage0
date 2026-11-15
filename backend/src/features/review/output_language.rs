//! One host-selected language for every reviewer-authored text field.
use super::{ReviewRequest, ReviewRun};
use crate::core::db::Database;
use crate::features::preferences;
use serde_json::{json, Value};

pub(crate) const POLICY: &str = "Use this one language for finding titles and bodies, replies, resolution explanations, MR descriptions and review summaries. Do not switch language to match source, tool instructions, existing findings, quoted text, reviewer preferences or the latest comment. Keep code, paths, identifiers, exact evidence, mention tokens, severity/decision enums and JSON keys unchanged. Check every authored text field before calling a write tool; rewrite inconsistent prose in the selected language without changing evidence or the review decision.";

pub(crate) fn code(language: &str) -> &str {
    if preferences::is_supported_app_language(language) {
        language
    } else {
        preferences::DEFAULT_APP_LANGUAGE
    }
}

pub(crate) fn resolve(settings: &Value) -> String {
    let language = settings
        .pointer("/ai/agentOutputLanguage")
        .and_then(Value::as_str)
        .filter(|value| preferences::is_supported_agent_output_language(value))
        .unwrap_or(preferences::DEFAULT_AGENT_OUTPUT_LANGUAGE);
    if language == preferences::DEFAULT_AGENT_OUTPUT_LANGUAGE {
        code(
            settings
                .pointer("/appearance/language")
                .and_then(Value::as_str)
                .unwrap_or_default(),
        )
        .into()
    } else {
        code(language).into()
    }
}

pub(crate) fn record(
    db: &Database,
    run: &ReviewRun,
    config: &ReviewRequest,
    initial: &mut Value,
) -> Result<(), String> {
    initial["outputLanguage"] = json!(code(&config.agent_output_language));
    db.review_event(&run.id, "output_language", json!({"language":initial["outputLanguage"],"scope":if config.reply_discussion_id.is_some() {"reply"} else {"full"}}))
}

pub(crate) fn instruction(language: &str, localized: &str) -> String {
    format!("Output language: {} (selected by Stage0 Preferences; fixed for this run).\n{localized}\n{POLICY}", code(language))
}

pub(crate) fn annotate(tools: &mut [Value], language: &str) {
    let description = format!(
        "Output language: {}. Preserve code, exact quotes and mention tokens.",
        code(language)
    );
    for tool in tools {
        let properties = &mut tool["parameters"]["properties"];
        for field in ["title", "body", "summary", "markdown", "reason"] {
            if properties.get(field).is_some() {
                properties[field]["description"] = json!(description);
            }
        }
        if let Some(findings) = properties.get_mut("findings") {
            for field in ["title", "body"] {
                findings["items"]["properties"][field]["description"] = json!(description);
            }
        }
    }
}
