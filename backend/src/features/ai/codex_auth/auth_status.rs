#[derive(Clone, Default, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CodexAuthStatus {
    pub attempt_id: String,
    pub phase: String,
    pub user_code: Option<String>,
    pub verification_url: Option<String>,
    pub account_email: Option<String>,
    pub plan_type: Option<String>,
    pub deadline_at: Option<String>,
    #[serde(serialize_with = "crate::common::messages::serialize_optional_error")]
    pub error: Option<String>,
    // App-server owns tokens. This ID is only for its cancel RPC, not IPC.
    #[serde(skip)]
    pub login_id: Option<String>,
}

impl CodexAuthStatus {
    pub fn clear_pending(&mut self) {
        self.user_code = None;
        self.verification_url = None;
        self.deadline_at = None;
        self.login_id = None;
    }
    pub fn busy(&self) -> bool {
        matches!(
            self.phase.as_str(),
            "starting" | "pending" | "checking" | "signing_out" | "cancelling"
        )
    }
}
