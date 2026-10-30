use super::ollama_tag_item::OllamaTagItem;
use serde::Deserialize;

#[derive(Deserialize)]
pub(super) struct OllamaTagsResponse {
    pub(super) models: Option<Vec<OllamaTagItem>>,
}
