#[derive(Clone, Copy)]
pub enum AuthCommand {
    Login,
    Check,
    Cancel,
    Logout,
    Stop,
}
