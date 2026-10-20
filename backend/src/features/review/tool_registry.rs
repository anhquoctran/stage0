use super::schemas;
use serde_json::Value;

/// Discovery is NOT authorization. External catalogs are staged separately and
/// cannot overwrite or join the active native tool set in this preparation phase.
pub struct ReviewToolRegistry {
    native: Vec<Value>,
}

impl ReviewToolRegistry {
    pub fn native() -> Self {
        Self {
            native: schemas::tools(),
        }
    }
    pub fn definitions(&self) -> &[Value] {
        &self.native
    }
    pub fn validate_call(&self, name: &str, arguments: &Value) -> Result<(), String> {
        let tool = self
            .native
            .iter()
            .find(|tool| tool["name"] == name)
            .ok_or("Unknown or unauthorized review tool")?;
        schemas::validate(&tool["parameters"], arguments)
    }
}

#[cfg(test)]
mod tests {
    #[test]
    fn external_and_native_looking_tools_cannot_bypass_the_active_registry() {
        let registry = super::ReviewToolRegistry::native();
        assert_eq!(registry.definitions().len(), 11);
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
