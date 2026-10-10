use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct RepoInfo {
    pub id: String,
    pub name: String,
    pub local_path: String,
}
