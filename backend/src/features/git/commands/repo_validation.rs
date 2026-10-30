#[derive(serde::Serialize, serde::Deserialize, Clone, Debug)]
pub struct RepoValidation {
    pub is_valid: bool,
    pub exists: bool,
    pub has_git: bool,
    pub has_permission: bool,
    #[serde(serialize_with = "crate::common::messages::serialize_optional_error")]
    pub error_message: Option<String>,
}
