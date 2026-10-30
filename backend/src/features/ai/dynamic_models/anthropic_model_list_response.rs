use super::anthropic_model_item::AnthropicModelItem;
use serde::Deserialize;

#[derive(Deserialize)]
pub(super) struct AnthropicModelListResponse {
    pub(super) data: Option<Vec<AnthropicModelItem>>,
}
