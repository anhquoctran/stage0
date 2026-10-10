use super::CopilotModelItem;
use serde::Deserialize;

#[derive(Deserialize)]
pub(super) struct CopilotModelListResponse {
    pub(super) data: Option<Vec<CopilotModelItem>>,
}
