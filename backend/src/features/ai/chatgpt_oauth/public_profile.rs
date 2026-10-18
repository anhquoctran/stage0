use serde::Serialize;

#[derive(Clone, Serialize)]
pub struct PublicProfile {
    pub id: String,
    pub label: String,
    pub email: Option<String>,
    pub signed_in: bool,
}
