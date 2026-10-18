use super::{
    auth_command::AuthCommand, auth_runtime::AuthRuntime, process::CodexAuthProcess, protocol,
    CodexAuthStatus,
};
use serde_json::{json, Value};
use std::{
    collections::VecDeque,
    path::Path,
    sync::{mpsc::Receiver, Arc, Mutex},
    time::{Duration, Instant},
};

pub const CANCELLED: &str = "Device-code sign-in cancelled";
pub const STOPPED: &str = "Codex authentication stopped";

pub fn run(
    profile: &Path,
    action: AuthCommand,
    id: &str,
    state: &Arc<Mutex<AuthRuntime>>,
    control: &Receiver<AuthCommand>,
) -> Result<(), String> {
    prepare_profile(profile)?;
    let process = CodexAuthProcess::launch(profile)?;
    run_process(process, action, id, state, control)
}

pub(super) fn run_process(
    mut process: CodexAuthProcess,
    action: AuthCommand,
    id: &str,
    state: &Arc<Mutex<AuthRuntime>>,
    control: &Receiver<AuthCommand>,
) -> Result<(), String> {
    let mut events = VecDeque::new();
    rpc(
        &mut process,
        control,
        &mut events,
        1,
        "initialize",
        json!({"clientInfo":{"name":"stage0","title":"Stage0","version":env!("CARGO_PKG_VERSION")}}),
        None,
    )?;
    process.send(&json!({"method":"initialized","params":{}}))?;
    if matches!(action, AuthCommand::Logout) {
        rpc(
            &mut process,
            control,
            &mut events,
            2,
            "account/logout",
            json!({}),
            None,
        )?;
        update(state, id, |s| {
            s.phase = "signed_out".into();
            s.clear_pending();
            s.account_email = None;
            s.plan_type = None;
        });
        return Ok(());
    }
    let result = rpc(
        &mut process,
        control,
        &mut events,
        2,
        "account/read",
        json!({"refreshToken":false}),
        None,
    )?;
    let mut account_status = CodexAuthStatus::default();
    let signed_in = protocol::account(&result, &mut account_status)?;
    if signed_in || matches!(action, AuthCommand::Check) {
        update(state, id, |s| {
            s.phase = account_status.phase;
            s.account_email = account_status.account_email;
            s.plan_type = account_status.plan_type;
            s.clear_pending();
        });
        return Ok(());
    }
    let instructions = rpc(
        &mut process,
        control,
        &mut events,
        3,
        "account/login/start",
        json!({"type":"chatgptDeviceCode"}),
        None,
    )?;
    let mut pending = CodexAuthStatus::default();
    protocol::device_instructions(&instructions, &mut pending)?;
    let login_id = pending.login_id.clone().unwrap();
    update(state, id, |s| {
        s.phase = pending.phase;
        s.user_code = pending.user_code;
        s.verification_url = pending.verification_url;
        s.deadline_at = pending.deadline_at;
        s.login_id = pending.login_id;
    });
    let deadline = Instant::now() + Duration::from_secs(600);
    loop {
        cancellation(&mut process, control, Some(&login_id))?;
        if Instant::now() >= deadline {
            let _ = send_cancel(&mut process, &login_id);
            return Err("Device-code sign-in reached the local ten-minute deadline. Start a new attempt; the provider may expire its code earlier.".into());
        }
        let message = match events.pop_front() {
            Some(v) => Some(v),
            None => process.receive(Duration::from_millis(100))?,
        };
        let Some(message) = message else {
            continue;
        };
        if message.get("method").is_some() && message.get("id").is_some() {
            return Err(
                "Codex requested an unsupported client operation during authentication".into(),
            );
        }
        match protocol::login_completed(&message, &login_id) {
            Some(true) => {
                let result = rpc(
                    &mut process, control, &mut events, 4, "account/read",
                    json!({"refreshToken":false}), Some(&login_id),
                )?;
                let mut verified = CodexAuthStatus::default();
                if !protocol::account(&result, &mut verified)? {
                    return Err("Codex reported login completion but no ChatGPT account was available".into());
                }
                update(state, id, |s| {
                    s.phase = "signed_in".into();
                    s.account_email = verified.account_email;
                    s.plan_type = verified.plan_type;
                    s.clear_pending();
                });
                return Ok(());
            }
            Some(false) => return Err("ChatGPT device-code sign-in was denied, cancelled or expired. Enable device-code login in ChatGPT/workspace settings, then retry.".into()),
            None => {},
        }
    }
}

fn rpc(
    process: &mut CodexAuthProcess,
    control: &Receiver<AuthCommand>,
    events: &mut VecDeque<Value>,
    id: u64,
    method: &str,
    params: Value,
    login_id: Option<&str>,
) -> Result<Value, String> {
    process.send(&protocol::request(id, method, params)?)?;
    let deadline = Instant::now() + Duration::from_secs(15);
    loop {
        cancellation(process, control, login_id)?;
        if Instant::now() >= deadline {
            return Err("Codex authentication request timed out. Update Codex and check OS keyring availability.".into());
        }
        let Some(message) = process.receive(Duration::from_millis(100))? else {
            continue;
        };
        if message.get("method").is_some() {
            if message.get("id").is_some() || events.len() >= 16 {
                return Err("Unexpected or excessive Codex authentication events".into());
            }
            events.push_back(message);
            continue;
        }
        if message["id"].as_u64() != Some(id) {
            return Err("Mismatched Codex authentication response".into());
        }
        if message.get("error").is_some() {
            return Err("Codex rejected the authentication request. Update Codex, check the OS keyring, and ensure device-code login is enabled for your account/workspace. No raw error payload was retained.".into());
        }
        return message
            .get("result")
            .filter(|v| v.is_object())
            .cloned()
            .ok_or("Missing Codex authentication result".into());
    }
}
fn cancellation(
    process: &mut CodexAuthProcess,
    control: &Receiver<AuthCommand>,
    login: Option<&str>,
) -> Result<(), String> {
    match control.try_recv() {
        Ok(AuthCommand::Cancel) => {
            if let Some(login) = login {
                let _ = send_cancel(process, login);
            }
            Err(CANCELLED.into())
        }
        Ok(AuthCommand::Stop) | Err(std::sync::mpsc::TryRecvError::Disconnected) => {
            if let Some(login) = login {
                let _ = send_cancel(process, login);
            }
            Err(STOPPED.into())
        }
        _ => Ok(()),
    }
}
fn send_cancel(process: &mut CodexAuthProcess, login: &str) -> Result<(), String> {
    process.send(&protocol::request(
        90,
        "account/login/cancel",
        json!({"loginId":login}),
    )?)
}
pub(super) fn update(
    state: &Arc<Mutex<AuthRuntime>>,
    id: &str,
    change: impl FnOnce(&mut CodexAuthStatus),
) {
    if let Ok(mut state) = state.lock() {
        if state.status.attempt_id == id && state.status.phase != "cancelling" {
            change(&mut state.status);
        }
    }
}
fn prepare_profile(profile: &Path) -> Result<(), String> {
    if std::fs::symlink_metadata(profile).is_ok_and(|m| m.file_type().is_symlink() || !m.is_dir()) {
        return Err("Codex authentication profile must be a real private directory".into());
    }
    std::fs::create_dir_all(profile)
        .map_err(|_| "Could not create the isolated Stage0 Codex profile")?;
    let metadata = std::fs::symlink_metadata(profile)
        .map_err(|_| "Could not inspect the isolated Codex profile")?;
    if metadata.file_type().is_symlink() || !metadata.is_dir() {
        return Err("Codex authentication profile must not be a symlink or ordinary file".into());
    }
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        std::fs::set_permissions(profile, std::fs::Permissions::from_mode(0o700))
            .map_err(|_| "Could not secure the isolated Codex profile")?;
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn cancellation_cannot_be_overwritten_by_a_late_completion() {
        let state = state();
        state.lock().unwrap().status.phase = "cancelling".into();
        update(&state, "fixture", |s| s.phase = "signed_in".into());
        assert_eq!(state.lock().unwrap().status.phase, "cancelling");
    }
    fn fixture(scenario: &str) -> CodexAuthProcess {
        let mut command = std::process::Command::new("node");
        command
            .arg(
                std::path::Path::new(env!("CARGO_MANIFEST_DIR"))
                    .join("../scripts/fixtures/codex-auth-app-server.mjs"),
            )
            .arg(scenario);
        CodexAuthProcess::spawn(command).unwrap()
    }
    fn state() -> Arc<Mutex<AuthRuntime>> {
        Arc::new(Mutex::new(AuthRuntime {
            status: CodexAuthStatus {
                attempt_id: "fixture".into(),
                phase: "starting".into(),
                ..Default::default()
            },
            sender: None,
            done: None,
        }))
    }
    #[test]
    fn real_stdio_device_code_completion_requires_a_matching_login_and_a_chatgpt_account() {
        let state = state();
        let (_sender, receiver) = std::sync::mpsc::channel();
        run_process(
            fixture("success"),
            AuthCommand::Login,
            "fixture",
            &state,
            &receiver,
        )
        .unwrap();
        let status = &state.lock().unwrap().status;
        assert_eq!(status.phase, "signed_in");
        assert_eq!(
            status.account_email.as_deref(),
            Some("fixture@example.test")
        );
        assert!(status.user_code.is_none());
        let public = serde_json::to_string(status).unwrap();
        assert!(!public.contains("fixture-not-for-ui") && !public.contains("ABCD-1234"));
    }
    #[test]
    fn denied_unsupported_wrong_ids_spoofed_urls_api_keys_and_oversized_output_never_succeed() {
        for scenario in [
            "denied",
            "unsupported",
            "wrong-id",
            "spoofed",
            "api-key",
            "oversized",
        ] {
            let state = state();
            let (_sender, receiver) = std::sync::mpsc::channel();
            let error = run_process(
                fixture(scenario),
                AuthCommand::Login,
                "fixture",
                &state,
                &receiver,
            )
            .unwrap_err();
            assert!(!error.contains("fixture-secret-error-body"));
            assert_ne!(state.lock().unwrap().status.phase, "signed_in");
        }
    }
    #[test]
    fn pending_login_can_be_cancelled_without_waiting_for_provider_expiry() {
        let state = state();
        let (sender, receiver) = std::sync::mpsc::channel();
        let state_for_cancel = Arc::clone(&state);
        let task = std::thread::spawn(move || {
            let deadline = Instant::now() + Duration::from_secs(3);
            while state_for_cancel.lock().unwrap().status.phase != "pending" {
                assert!(Instant::now() < deadline);
                std::thread::sleep(Duration::from_millis(5));
            }
            sender.send(AuthCommand::Cancel).unwrap();
        });
        let started = Instant::now();
        assert_eq!(
            run_process(
                fixture("pending"),
                AuthCommand::Login,
                "fixture",
                &state,
                &receiver
            ),
            Err(CANCELLED.into())
        );
        task.join().unwrap();
        assert!(started.elapsed() < Duration::from_secs(3));
    }
    #[test]
    fn saved_sign_in_and_logout_use_the_same_auth_only_stdio_service() {
        let state = state();
        let (_sender, receiver) = std::sync::mpsc::channel();
        run_process(
            fixture("saved"),
            AuthCommand::Check,
            "fixture",
            &state,
            &receiver,
        )
        .unwrap();
        assert_eq!(state.lock().unwrap().status.phase, "signed_in");
        run_process(
            fixture("saved"),
            AuthCommand::Logout,
            "fixture",
            &state,
            &receiver,
        )
        .unwrap();
        assert_eq!(state.lock().unwrap().status.phase, "signed_out");
        assert!(state.lock().unwrap().status.account_email.is_none());
    }
}
