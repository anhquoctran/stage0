use super::*;
use crate::features::git::runner::{run_git, run_git_strict};

#[test]
fn remote_credentials_are_redacted_from_ipc_metadata() {
    let temp_dir =
        std::env::temp_dir().join(format!("remote_redaction_test_{}", uuid::Uuid::new_v4()));
    std::fs::create_dir_all(&temp_dir).unwrap();
    let repo_path = temp_dir.to_string_lossy().to_string();
    let init = std::process::Command::new("git")
        .current_dir(&repo_path)
        .args(["init", "-q"])
        .status()
        .unwrap();
    assert!(init.success());

    std::process::Command::new("git")
        .current_dir(&repo_path)
        .args([
            "remote",
            "add",
            "origin",
            "https://user:pass@example.test/repo?access_token=supersecret",
        ])
        .status()
        .unwrap();
    let details = list_remotes_detailed(&repo_path).unwrap();
    assert_eq!(details.len(), 1);
    for secret in ["user:pass", "supersecret"] {
        assert!(!details[0].fetch_url.contains(secret));
        assert!(!get_remote_url(&repo_path, Some("origin"))
            .unwrap()
            .contains(secret));
    }
    assert!(details[0].fetch_url.contains("[REDACTED]"));

    std::fs::remove_dir_all(temp_dir).unwrap();
}

#[test]
fn rejects_urls_that_embed_secrets_or_select_external_transport_helpers() {
    for url in [
        "https://user:token@example.test/repo.git",
        "https://example.test/repo.git?access_token=secret",
        "ext::sh -c touch% /tmp/pwned",
        "file:///tmp/repo.git",
        "git@-oProxyCommand=touch:owner/repo.git",
        "ssh://-oProxyCommand=touch@host/owner/repo.git",
        "ssh://git@-oProxyCommand=touch/owner/repo.git",
        "ssh://git@example.test",
    ] {
        assert!(validate_remote_url(url).is_err(), "accepted {url:?}");
    }
    assert!(validate_remote_url("https://example.test/owner/repo.git").is_ok());
    assert!(validate_remote_url("git@example.test:owner/repo.git").is_ok());
    assert!(validate_remote_url("git@[::1]:owner/repo.git").is_ok());
    assert!(validate_remote_url("ssh://git@example.test/owner/repo.git").is_ok());
    assert!(validate_remote_url("ssh://git@[::1]:2222/owner/repo.git").is_ok());
}

#[test]
fn rebase_does_not_accept_git_options_as_a_branch_argument() {
    let temp_dir =
        std::env::temp_dir().join(format!("rebase_option_test_{}", uuid::Uuid::new_v4()));
    std::fs::create_dir_all(&temp_dir).unwrap();
    let repo_path = temp_dir.to_string_lossy().to_string();
    let result = git_sync(
        &repo_path,
        "rebase",
        Some(GitSyncOptions {
            branch: Some("--exec=touch /tmp/stage0-should-not-exist".to_string()),
            ..GitSyncOptions::default()
        }),
    );
    assert!(result.is_err());
    let _ = std::fs::remove_dir_all(temp_dir);
}

#[test]
fn merge_and_rebase_complete_with_the_progress_runner() {
    let directory = std::env::temp_dir().join(format!("git_task_test_{}", uuid::Uuid::new_v4()));
    std::fs::create_dir_all(&directory).unwrap();
    let path = directory.to_str().unwrap();
    run_git_strict(path, &["init", "-q", "-b", "main"]).unwrap();
    run_git_strict(path, &["config", "user.email", "task-test@example.test"]).unwrap();
    run_git_strict(path, &["config", "user.name", "Task Test"]).unwrap();
    run_git_strict(path, &["config", "commit.gpgsign", "false"]).unwrap();
    run_git_strict(path, &["commit", "--allow-empty", "-m", "Base"]).unwrap();
    run_git_strict(path, &["checkout", "-b", "feature"]).unwrap();
    run_git_strict(path, &["commit", "--allow-empty", "-m", "Feature"]).unwrap();
    run_git_strict(path, &["checkout", "main"]).unwrap();
    git_sync(
        path,
        "merge",
        Some(GitSyncOptions {
            branch: Some("feature".to_string()),
            ff_only: Some(true),
            ..Default::default()
        }),
    )
    .unwrap();
    assert_eq!(
        run_git_strict(path, &["rev-parse", "HEAD"]).unwrap(),
        run_git_strict(path, &["rev-parse", "feature"]).unwrap()
    );
    run_git_strict(path, &["checkout", "-b", "local-work"]).unwrap();
    std::fs::write(directory.join("local.txt"), "local\n").unwrap();
    run_git_strict(path, &["add", "local.txt"]).unwrap();
    run_git_strict(path, &["commit", "-m", "Local"]).unwrap();
    run_git_strict(path, &["checkout", "main"]).unwrap();
    std::fs::write(directory.join("upstream.txt"), "upstream\n").unwrap();
    run_git_strict(path, &["add", "upstream.txt"]).unwrap();
    run_git_strict(path, &["commit", "-m", "Upstream"]).unwrap();
    run_git_strict(path, &["checkout", "local-work"]).unwrap();
    git_sync(
        path,
        "rebase",
        Some(GitSyncOptions {
            branch: Some("main".to_string()),
            ..Default::default()
        }),
    )
    .unwrap();
    assert!(
        run_git(path, &["merge-base", "--is-ancestor", "main", "HEAD"])
            .unwrap()
            .success
    );
    assert!(directory.join("local.txt").exists());
    assert!(directory.join("upstream.txt").exists());
    std::fs::remove_dir_all(directory).unwrap();
}

#[test]
fn fetch_refuses_option_like_ssh_hosts_from_existing_remote_config() {
    let temp_dir =
        std::env::temp_dir().join(format!("ssh_remote_option_test_{}", uuid::Uuid::new_v4()));
    std::fs::create_dir_all(&temp_dir).unwrap();
    let repo_path = temp_dir.to_string_lossy().to_string();
    let init = std::process::Command::new("git")
        .current_dir(&repo_path)
        .args(["init", "-q"])
        .status()
        .unwrap();
    assert!(init.success());
    let add_remote = std::process::Command::new("git")
        .current_dir(&repo_path)
        .args([
            "remote",
            "add",
            "origin",
            "ssh://git@-oProxyCommand=touch/owner/repo.git",
        ])
        .status()
        .unwrap();
    assert!(add_remote.success());

    let error = git_sync(
        &repo_path,
        "fetch",
        Some(GitSyncOptions {
            remote: Some("origin".to_string()),
            ..GitSyncOptions::default()
        }),
    )
    .unwrap_err();
    assert!(error.contains("option-like"));
    let _ = std::fs::remove_dir_all(temp_dir);
}
