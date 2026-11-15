use super::super::git_refs;
use super::fixture::*;
use crate::features::review::context::resolve_snapshot_ref;
use std::collections::HashSet;

#[test]
fn batch_resolution_matches_review_refs_including_remote_fallbacks_and_packed_refs() {
    let repo = TestRepo::new();
    let sha = repo.git(&["rev-parse", "feature"]).trim().to_owned();
    repo.git(&["update-ref", "refs/remotes/origin/feature", &sha]);
    repo.git(&["tag", "fixture-tag"]);
    repo.git(&["pack-refs", "--all"]);
    let names = HashSet::from(
        [
            "main",
            "feature",
            "origin/feature",
            "refs/heads/feature",
            "HEAD",
            "HEAD~1",
            "fixture-tag",
            "missing",
            "--help",
            "bad\nname",
        ]
        .map(str::to_owned),
    );
    let refs = git_refs::inventory(repo.path(), &names).unwrap();
    for name in &names {
        assert_eq!(
            refs[name],
            resolve_snapshot_ref(repo.path(), name).ok(),
            "{name}"
        );
    }
    repo.write("source.rs", "local working tree only\n");
    repo.git(&["add", "source.rs"]);
    repo.git(&["commit", "-m", "Local commit"]);
    let refs = git_refs::inventory(repo.path(), &names).unwrap();
    assert_eq!(refs["origin/feature"], Some(sha));
    assert_ne!(refs["feature"], refs["origin/feature"]);
    let local = repo.git(&["rev-parse", "feature"]).trim().to_owned();
    repo.git(&["update-ref", "refs/remotes/origin/feature", &local]);
    assert_eq!(
        git_refs::inventory(repo.path(), &names).unwrap()["origin/feature"],
        Some(local)
    );
}

#[test]
fn gitdir_indirection_and_metadata_filters_do_not_watch_source_or_object_contents() {
    let repo = TestRepo::new();
    std::fs::rename(repo.path.join(".git"), repo.path.join("git metadata")).unwrap();
    repo.write(".git", "gitdir: git metadata\n");
    let roots = git_refs::watch_paths(repo.path()).unwrap();
    assert_eq!(roots.len(), 1);
    assert!(roots[0].ends_with("git metadata"));
    for name in [
        "HEAD",
        "packed-refs",
        "refs/heads/new/nested",
        "refs/remotes/origin/feature",
        "reftable/tables.list",
    ] {
        assert!(git_refs::relevant(&roots[0].join(name), &roots));
    }
    for name in [
        "index",
        "index.lock",
        "objects/ab/blob",
        "logs/HEAD",
        "refs/heads/feature.lock",
    ] {
        assert!(!git_refs::relevant(&roots[0].join(name), &roots));
    }
    assert!(!git_refs::relevant(&repo.path.join("source.rs"), &roots));
    assert_eq!(
        git_refs::inventory(repo.path(), &HashSet::from(["feature".into()])).unwrap()["feature"],
        Some(repo.git(&["rev-parse", "feature"]).trim().into())
    );
}

#[test]
fn native_metadata_watcher_observes_a_commit_created_outside_stage0() {
    let repo = TestRepo::new();
    let paths = git_refs::watch_paths(repo.path()).unwrap();
    let (send, receive) = std::sync::mpsc::sync_channel(1);
    let mut watcher = super::super::ref_watcher::RefWatcher::new(move |root| {
        let _ = send.try_send(root);
    });
    assert!(watcher.install("fixture", paths));
    commit(&repo);
    receive
        .recv_timeout(std::time::Duration::from_secs(10))
        .expect("A native ref event must wake the shared monitor");
    let refs = git_refs::inventory(repo.path(), &HashSet::from(["feature".into()])).unwrap();
    assert_eq!(
        refs["feature"],
        Some(repo.git(&["rev-parse", "feature"]).trim().into())
    );
}

#[test]
fn shared_native_watches_keep_other_subscribers_alive_after_one_is_removed() {
    let first = TestRepo::new();
    let second = TestRepo::new();
    let (send, receive) = std::sync::mpsc::channel();
    let mut watcher = super::super::ref_watcher::RefWatcher::new(move |root| {
        let _ = send.send(root);
    });
    let paths = git_refs::watch_paths(first.path()).unwrap();
    assert!(watcher.install("removed", paths.clone()));
    assert!(watcher.install("retained", paths));
    assert!(watcher.install("independent", git_refs::watch_paths(second.path()).unwrap()));
    watcher.remove("removed");
    commit(&first);
    let deadline = std::time::Instant::now() + std::time::Duration::from_secs(10);
    loop {
        let root = receive
            .recv_timeout(deadline.saturating_duration_since(std::time::Instant::now()))
            .unwrap();
        if root == "retained" {
            break;
        }
    }
    watcher.remove("retained");
    commit(&second);
    let deadline = std::time::Instant::now() + std::time::Duration::from_secs(10);
    loop {
        let root = receive
            .recv_timeout(deadline.saturating_duration_since(std::time::Instant::now()))
            .unwrap();
        if root == "independent" {
            break;
        }
    }
}
