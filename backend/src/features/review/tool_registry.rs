use super::schemas;
use serde_json::Value;

/// Discovery is NOT authorization. External catalogs are staged separately and
/// cannot overwrite or join the active native tool set in this preparation phase.
pub struct ReviewToolRegistry {
    native: Vec<Value>,
}

impl ReviewToolRegistry {
    pub fn for_request(config: &super::ReviewRequest) -> Self {
        let mut registry = Self::native_for_review(config.generate_description);
        if config.reply_discussion_id.is_some() {
            registry.native.retain(|tool| {
                matches!(
                    tool["name"].as_str(),
                    Some(
                        "list_open_discussions"
                            | "read_discussion_comment"
                            | "read_file_range"
                            | "get_file_diff"
                            | "reply_to_discussion"
                            | "submit_review"
                    )
                )
            });
            for tool in &mut registry.native {
                if tool["name"] == "submit_review" {
                    tool["description"] = serde_json::json!("Finish this discussion-reply-only run after reading its complete root and latest comment. Reply only if the direct mention warrants a useful response; otherwise finish without queuing a reply and explain why no reply is needed in the summary. Use decision comment and an empty findings list; this is not a full MR review or verdict.");
                    tool["parameters"]["properties"]["decision"]["enum"] =
                        serde_json::json!(["comment"]);
                    tool["parameters"]["properties"]["findings"]["maxItems"] = serde_json::json!(0);
                }
            }
        }
        registry
    }
    pub(crate) fn enable_related_context(&mut self) {
        self.native.push(schemas::related_context_tool());
    }
    pub fn native() -> Self {
        Self::native_for_review(false)
    }

    pub fn native_for_review(allow_description_update: bool) -> Self {
        let mut native = schemas::tools();
        if !allow_description_update {
            native.retain(|tool| tool["name"] != "update_mr_description");
        }
        Self { native }
    }
    pub fn definitions(&self) -> &[Value] {
        &self.native
    }
    pub fn validate_call(&self, name: &str, arguments: &Value) -> Result<(), String> {
        let tool = self
            .native
            .iter()
            .find(|tool| tool["name"] == name)
            .ok_or_else(|| {
                crate::common::messages::failure(
                    "backend.review.unknownOrUnauthorizedTool",
                    serde_json::json!({}),
                    "Unknown or unauthorized review tool".into(),
                )
            })?;
        schemas::validate(&tool["parameters"], arguments)
    }
}

#[cfg(test)]
mod tests {
    #[test]
    fn external_and_native_looking_tools_cannot_bypass_the_active_registry() {
        let registry = super::ReviewToolRegistry::native();
        assert_eq!(registry.definitions().len(), 13);
        for name in [
            "mcp_deadbeef_search",
            "execute_terminal_cmd",
            "tools/call",
            "submit_review_override",
        ] {
            assert!(registry
                .validate_call(name, &serde_json::json!({}))
                .is_err());
        }
        assert!(registry
            .validate_call("get_diff", &serde_json::json!({}))
            .is_ok());
    }
}
