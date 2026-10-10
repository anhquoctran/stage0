#[derive(serde::Deserialize, serde::Serialize, Clone, Debug)]
pub struct GitCommitItem {
    pub hash: String,
    pub short_hash: String,
    pub subject: String,
    pub body: Option<String>,
    pub author_name: String,
    pub author_email: String,
    pub authored_date: String,
}
