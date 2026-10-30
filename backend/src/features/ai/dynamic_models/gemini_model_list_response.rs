use super::gemini_model_item::GeminiModelItem;
use serde::Deserialize;

#[derive(Deserialize)]
pub(super) struct GeminiModelListResponse {
    pub(super) models: Option<Vec<GeminiModelItem>>,
}
