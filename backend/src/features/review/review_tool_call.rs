#[derive(Clone, Debug)]
pub struct ReviewToolCall {
    pub id: String,
    pub native_id: Option<String>,
    pub name: String,
    pub arguments: serde_json::Value,
}
