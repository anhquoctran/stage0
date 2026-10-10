use serde::Deserialize;

#[derive(Deserialize)]
pub(super) struct OllamaTagItem {
    pub(super) name: String,
}
