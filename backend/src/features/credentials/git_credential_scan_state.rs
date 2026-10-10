#[derive(Default)]
pub(super) struct GitCredentialScanState {
    pub(super) running: bool,
    pub(super) requested_again: bool,
}
