pub(super) struct CloneCredentialLease {
    pub(super) token_ref: String,
    pub(super) expected_origin: String,
    pub(super) username: String,
    pub(super) delete_secret_on_drop: bool,
}

impl Drop for CloneCredentialLease {
    fn drop(&mut self) {
        if self.delete_secret_on_drop {
            let _ = crate::features::credentials::delete_secret(&self.token_ref);
        }
    }
}
