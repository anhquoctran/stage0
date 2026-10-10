use serde::Deserialize;

#[derive(Deserialize)]
pub(super) struct CopilotModelItem {
    pub(super) id: String,
    pub(super) name: Option<String>,
}
