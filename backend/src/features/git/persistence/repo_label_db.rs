#[derive(serde::Serialize, serde::Deserialize, Clone, Debug)]
pub struct RepoLabelDb {
    pub id: String,
    pub repo_id: String,
    pub name: String,
    pub color: String,
    pub description: Option<String>,
}
