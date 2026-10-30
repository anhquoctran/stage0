use serde::Deserialize;

#[derive(Deserialize)]
pub(super) struct OpenAiModelItem {
    pub(super) id: String,
    pub(super) name: Option<String>,
    pub(super) effort: Option<serde_json::Value>,
}
