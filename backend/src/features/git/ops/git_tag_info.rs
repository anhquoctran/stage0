#[derive(serde::Deserialize, serde::Serialize, Clone, Debug)]
pub struct GitTagInfo {
    pub name: String,
    pub commit_hash: String,
    pub message: Option<String>,
    pub date: Option<String>,
}
