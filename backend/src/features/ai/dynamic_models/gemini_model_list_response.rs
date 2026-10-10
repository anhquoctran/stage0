use super::GeminiModelItem;
use serde::Deserialize;

#[derive(Deserialize)]
pub(super) struct GeminiModelListResponse {
    pub(super) models: Option<Vec<GeminiModelItem>>,
}
