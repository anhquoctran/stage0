use super::OllamaTagItem;
use serde::Deserialize;

#[derive(Deserialize)]
pub(super) struct OllamaTagsResponse {
    pub(super) models: Option<Vec<OllamaTagItem>>,
}
