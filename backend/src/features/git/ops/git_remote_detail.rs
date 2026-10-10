#[derive(serde::Deserialize, serde::Serialize, Clone, Debug)]
pub struct GitRemoteDetail {
    pub name: String,
    pub fetch_url: String,
    pub push_url: String,
}
