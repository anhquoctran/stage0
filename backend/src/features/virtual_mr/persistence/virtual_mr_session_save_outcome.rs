#[derive(serde::Serialize, Clone, Debug, PartialEq, Eq)]
#[serde(tag = "outcome", rename_all = "snake_case")]
pub enum VirtualMrSessionSaveOutcome {
    Saved,
    DuplicateOpen {
        existing_id: String,
        existing_title: String,
        base_branch: String,
        compare_branch: String,
    },
}
