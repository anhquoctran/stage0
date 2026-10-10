pub(super) enum OpenPlan {
    Existing(String),
    Opening(String),
    AssignedHere(String),
    AssignedExternal(String),
    CreateRepoWindow(String),
}
