#[cfg(unix)]
mod unix;
#[cfg(windows)]
mod windows;

pub(super) fn apply_stage0_path(enable: bool) -> Result<(), String> {
    #[cfg(unix)]
    {
        unix::apply(enable)
    }
    #[cfg(windows)]
    {
        windows::apply(enable)
    }
    #[cfg(not(any(unix, windows)))]
    {
        let _ = enable;
        Err("Adding the Stage0 command to PATH is not supported on this platform".into())
    }
}
