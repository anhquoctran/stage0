use super::open_ai_model_item::OpenAiModelItem;
use serde::Deserialize;

#[derive(Deserialize)]
pub(super) struct OpenAiModelListResponse {
    pub(super) data: Option<Vec<OpenAiModelItem>>,
}
