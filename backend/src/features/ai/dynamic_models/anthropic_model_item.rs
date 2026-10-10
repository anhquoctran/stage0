use serde::Deserialize;

#[derive(Deserialize)]
pub(super) struct AnthropicModelItem {
    pub(super) id: String,
    pub(super) display_name: Option<String>,
}
