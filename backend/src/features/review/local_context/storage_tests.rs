use super::{files, repository_cache::RepositoryCache, runtime::LocalContextRuntime};
use serde_json::json;
use std::sync::{Arc, Mutex, RwLock};

fn cache(root: &std::path::Path) -> RepositoryCache {
    RepositoryCache {
        directory: root.join("repo"),
        epoch: Arc::new(RwLock::new(0)),
        generation: 0,
        policy: "policy-one".into(),
        integrity_key: Arc::new([7; 32]),
        read_gate: Arc::new(Mutex::new(())),
    }
}
fn vector(index: usize) -> Vec<f32> {
    let mut v = vec![0.; 384];
    v[index] = 1.;
    v
}

#[test]
fn exact_cache_is_durable_versioned_and_rejects_corruption() {
    let root = tempfile::tempdir().unwrap();
    let cache = cache(root.path());
    let key = cache.key("blob", &json!(["head", "src.rs"]));
    let value = json!("sanitized immutable source");
    cache.put(&key, &value);
    assert_eq!(cache.get(&key), Some(value.clone()));
    let restarted = RepositoryCache {
        integrity_key: Arc::new([8; 32]),
        ..cache.clone()
    };
    assert_eq!(restarted.get(&key), None);
    restarted.put(&key, &value);
    assert_eq!(restarted.get(&key), Some(value.clone()));
    let reopened = RepositoryCache {
        policy: "policy-two".into(),
        ..cache.clone()
    };
    assert_ne!(reopened.key("blob", &json!(["head", "src.rs"])), key);
    assert!(reopened
        .get(&reopened.key("blob", &json!(["head", "src.rs"])))
        .is_none());
    assert_ne!(cache.key("blob", &json!(["next-head", "src.rs"])), key);
    cache
        .open()
        .unwrap()
        .execute("UPDATE reads SET body='corrupted' WHERE key=?1", [&key])
        .unwrap();
    assert_eq!(cache.get(&key), None);
}

#[test]
fn vector_metadata_commit_atomically_and_search_is_snapshot_scoped() {
    let root = tempfile::tempdir().unwrap();
    let cache = cache(root.path());
    cache
        .insert_vectors("old", "old.rs", "head", &[(1, 2, "old".into(), vector(0))])
        .unwrap();
    cache
        .insert_vectors("new", "new.rs", "head", &[(1, 2, "new".into(), vector(1))])
        .unwrap();
    assert_eq!(cache.embedding("old"), Some(vector(0)));
    let hits = cache.search("new", &vector(0)).unwrap();
    assert_eq!(hits.len(), 1);
    assert_eq!(hits[0].file_path, "new.rs");
    assert_eq!(
        cache
            .search("other-repo-or-snapshot", &vector(0))
            .unwrap()
            .len(),
        0
    );
    cache.open().unwrap().execute_batch("CREATE TRIGGER reject_bad BEFORE INSERT ON chunks WHEN NEW.hash='bad' BEGIN SELECT RAISE(ABORT,'fixture'); END;").unwrap();
    assert!(cache
        .insert_vectors(
            "rollback",
            "a.rs",
            "head",
            &[
                (1, 2, "ok".into(), vector(0)),
                (3, 4, "bad".into(), vector(1))
            ]
        )
        .is_err());
    assert_eq!(cache.embedding("ok"), None);
    let conn = cache.open().unwrap();
    assert_eq!(
        conn.query_row(
            "SELECT count(*) FROM chunks WHERE snapshot='rollback'",
            [],
            |r| r.get::<_, i64>(0)
        )
        .unwrap(),
        0
    );
    assert_eq!(
        conn.query_row(
            "SELECT count(*) FROM vectors WHERE snapshot='rollback'",
            [],
            |r| r.get::<_, i64>(0)
        )
        .unwrap(),
        0
    );
    assert_eq!(
        conn.query_row("PRAGMA synchronous", [], |r| r.get::<_, i64>(0))
            .unwrap(),
        2
    );
}

#[test]
fn cache_clear_invalidates_stale_readers_and_queued_writes() {
    let root = tempfile::tempdir().unwrap();
    let runtime = LocalContextRuntime::new(root.path().into());
    let repo = crate::features::review::test_repo::TestRepo::new();
    let (run, _) = repo.review();
    let session = runtime.session(&run.snapshot, "policy").unwrap();
    session.put("key", &json!("value"));
    runtime.clear().unwrap();
    session.put("key", &json!("stale worker"));
    assert_eq!(session.get("key"), None);
    assert!(!root.path().join("repositories").exists());
    let next = runtime.session(&run.snapshot, "policy").unwrap();
    assert_eq!(next.get("key"), None);
    next.put("key", &json!("new epoch"));
    assert_eq!(next.get("key"), Some(json!("new epoch")));
}

#[cfg(unix)]
#[test]
fn cache_rejects_symlink_database_paths() {
    let root = tempfile::tempdir().unwrap();
    let cache = cache(root.path());
    files::directory(&cache.directory).unwrap();
    std::os::unix::fs::symlink(
        root.path().join("outside"),
        cache.directory.join("context.db"),
    )
    .unwrap();
    cache.put("key", &json!("value"));
    assert_eq!(cache.get("key"), None);
    assert!(!root.path().join("outside").exists());
}
