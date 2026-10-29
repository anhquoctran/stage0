use super::*;
use std::sync::atomic::{AtomicBool, AtomicUsize, Ordering};
use std::sync::Arc;

#[tokio::test]
async fn simultaneous_repo_requests_share_one_creation_critical_section() {
    let state = Arc::new(PreferencesWindowState::default());
    let exists = Arc::new(AtomicBool::new(false));
    let builds = Arc::new(AtomicUsize::new(0));
    let focuses = Arc::new(AtomicUsize::new(0));
    let mut requests = Vec::new();
    for _ in 0..24 {
        let (state, exists, builds, focuses) = (
            state.clone(),
            exists.clone(),
            builds.clone(),
            focuses.clone(),
        );
        requests.push(tokio::spawn(async move {
            let _creation = state.creation.lock().await;
            if !exists.load(Ordering::Acquire) {
                // Native creation may yield before the window appears in Tauri's registry.
                tokio::time::sleep(std::time::Duration::from_millis(1)).await;
                builds.fetch_add(1, Ordering::Relaxed);
                exists.store(true, Ordering::Release);
            }
            focuses.fetch_add(1, Ordering::Relaxed);
        }));
    }
    for request in requests {
        request.await.unwrap();
    }
    assert_eq!(builds.load(Ordering::Relaxed), 1);
    assert_eq!(focuses.load(Ordering::Relaxed), 24);
}

#[tokio::test]
async fn creation_failure_releases_the_lock_for_retry() {
    let state = PreferencesWindowState::default();
    let failed: Result<(), &str> = async {
        let _creation = state.creation.lock().await;
        state.request_tab(Some("ai-providers".into()));
        state.destroyed();
        Err("window build failed")
    }
    .await;
    assert!(failed.is_err());
    let retry =
        tokio::time::timeout(std::time::Duration::from_millis(100), state.creation.lock()).await;
    assert!(retry.is_ok());
    assert!(!state.is_ready());
    assert_eq!(state.take_tab(), None);
}

#[test]
fn pending_sections_keep_the_latest_explicit_request_and_destroy_resets_readiness() {
    let state = PreferencesWindowState::default();
    state.request_tab(Some("ai-reviewers".into()));
    state.request_tab(None); // A generic focus request must not erase navigation.
    assert_eq!(state.take_tab().as_deref(), Some("ai-reviewers"));
    state.request_tab(Some("appearance-language".into()));
    state.request_tab(Some("general-keymaps".into()));
    assert_eq!(state.take_tab().as_deref(), Some("general-keymaps"));
    assert_eq!(state.take_tab(), None);
    state.set_ready(true);
    assert!(state.is_ready());
    state.destroyed();
    assert!(!state.is_ready());
}

#[test]
fn section_payloads_are_bounded_identifiers() {
    assert!(validate_tab(&None).is_ok());
    assert!(validate_tab(&Some("appearance-language".into())).is_ok());
    for value in ["", "../repository", "ai<script>", &"x".repeat(101)] {
        assert!(validate_tab(&Some(value.into())).is_err());
    }
}
