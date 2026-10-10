use serde::Deserialize;

#[derive(Deserialize)]
pub(super) struct OpenAiModelItem {
    pub(super) id: String,
}
