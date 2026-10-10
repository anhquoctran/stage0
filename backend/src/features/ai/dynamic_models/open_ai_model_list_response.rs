use super::OpenAiModelItem;
use serde::Deserialize;

#[derive(Deserialize)]
pub(super) struct OpenAiModelListResponse {
    pub(super) data: Option<Vec<OpenAiModelItem>>,
}
