use super::persistence::VirtualMrDeletionActivity;

#[derive(serde::Serialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct DiscussionDeletionOutcome {
    pub discussion_id: String,
    pub deleted_discussion: bool,
    pub activity: VirtualMrDeletionActivity,
    #[serde(skip)]
    pub session_title: String,
}
