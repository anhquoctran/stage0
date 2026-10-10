use super::AnthropicModelItem;
use serde::Deserialize;

#[derive(Deserialize)]
pub(super) struct AnthropicModelListResponse {
    pub(super) data: Option<Vec<AnthropicModelItem>>,
}
