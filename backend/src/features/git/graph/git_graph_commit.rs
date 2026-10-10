use serde::Serialize;

#[derive(Debug, Serialize, Clone)]
pub struct GitGraphCommit {
    pub hash: String,
    pub short_hash: String,
    pub parents: Vec<String>,
    pub subject: String,
    pub author_name: String,
    pub author_email: String,
    pub authored_date: String,
    pub refs: Vec<String>,
}
