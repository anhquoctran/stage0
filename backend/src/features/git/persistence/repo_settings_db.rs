#[derive(serde::Serialize, serde::Deserialize, Clone, Debug)]
pub struct RepoSettingsDb {
    pub repo_id: String,
    pub default_base_branch: String,
    pub inherit_global_agents: bool,
    pub custom_agent_rules: Option<String>,
}
