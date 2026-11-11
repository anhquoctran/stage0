use super::{commit, jsonc, load, schema, storage};
use serde_json::json;
use std::{
    fs,
    sync::{Arc, Barrier},
};

fn fixture() -> (tempfile::TempDir, std::path::PathBuf, std::path::PathBuf) {
    let temp = tempfile::tempdir().unwrap();
    let root = temp.path().join("repo");
    let backup = temp.path().join("recovery");
    fs::create_dir(&root).unwrap();
    let path = storage::path(&root).unwrap();
    let content = format!(
        "// keep this comment\n{}\n",
        serde_json::to_string_pretty(&schema::defaults("main")).unwrap()
    );
    storage::initialize(&path, &content).unwrap();
    (temp, root, backup)
}

#[test]
fn invalid_and_stale_writes_leave_committed_snapshot_intact() {
    let (_temp, root, backup) = fixture();
    let before = load(&root, &backup).unwrap();
    let path = storage::path(&root).unwrap();
    for patch in [
        json!({"inheritGlobalAgents":"false"}),
        json!({"unknown":true}),
        json!({"defaultBaseBranch":"@{-1}"}),
        json!({"labels":[{"id":"x","name":"Bug","color":"red"}]}),
        json!({"customReviewers":[{"apiKey":"secret"}]}),
    ] {
        assert!(commit(&root, &backup, &before.revision, &patch, |_| panic!(
            "Invalid config published"
        ))
        .is_err());
        assert_eq!(storage::read(&path).unwrap(), before.content);
    }
    let saved = commit(
        &root,
        &backup,
        &before.revision,
        &json!({"customAgentRules":"review carefully"}),
        |_| Ok(()),
    )
    .unwrap();
    assert!(saved.content.contains("// keep this comment"));
    assert!(saved.publication_sequence > before.publication_sequence);
    assert!(commit(
        &root,
        &backup,
        &before.revision,
        &json!({"customAgentRules":"stale"}),
        |_| panic!()
    )
    .is_err());
    assert_eq!(
        load(&root, &backup).unwrap().settings["customAgentRules"],
        "review carefully"
    );
}

#[test]
fn duplicate_keys_and_resource_exhaustion_are_rejected_before_deserialization() {
    let value = serde_json::to_string(&schema::defaults("main")).unwrap();
    let duplicate = value.replacen("{", "{\"schemaVersion\":1,", 1);
    assert!(jsonc::parse(&duplicate).unwrap_err().contains("Duplicate"));
    let escaped = value.replacen("{", "{\"schema\\u0056ersion\":1,", 1);
    assert!(jsonc::parse(&escaped).unwrap_err().contains("Duplicate"));
    assert!(
        jsonc::parse(&format!("{}{}", "[".repeat(10000), "]".repeat(10000)))
            .unwrap_err()
            .contains("nesting")
    );
    assert!(jsonc::parse(&" ".repeat(schema::MAX_BYTES + 1)).is_err());
    assert!(jsonc::parse("").is_err());
    let mut nested = json!(true);
    for _ in 0..32 {
        nested = json!({"nested": nested});
    }
    assert!(jsonc::patch(&value, &json!({"customAgentRules": nested})).is_err());
    assert!(jsonc::parse(&(value + " {}")).is_err());
    let mut config = schema::defaults("main");
    config["customReviewers"] = json!([{"id":"r", "name":"Reviewer", "tagline":"", "description":"", "category":"custom",
        "avatarEmoji":"🤖", "customInstructions":"", "enabled":true, "acpAgentId":"agent", "allowAcpSourceTransfer":true}]);
    assert!(
        schema::validate(&config).is_err(),
        "Repository must not grant source-transfer consent"
    );
}

#[test]
fn competing_transactions_have_one_winner_and_no_lost_update() {
    let (_temp, root, backup) = fixture();
    let initial = load(&root, &backup).unwrap();
    let barrier = Arc::new(Barrier::new(3));
    let workers = (0..2)
        .map(|i| {
            let (root, backup, revision, barrier) = (
                root.clone(),
                backup.clone(),
                initial.revision.clone(),
                barrier.clone(),
            );
            std::thread::spawn(move || {
                barrier.wait();
                commit(
                    &root,
                    &backup,
                    &revision,
                    &json!({"customAgentRules":format!("writer-{i}")}),
                    |_| Ok(()),
                )
            })
        })
        .collect::<Vec<_>>();
    barrier.wait();
    assert_eq!(
        workers
            .into_iter()
            .map(|w| w.join().unwrap())
            .filter(Result::is_ok)
            .count(),
        1
    );
    assert!(load(&root, &backup).unwrap().settings["customAgentRules"]
        .as_str()
        .unwrap()
        .starts_with("writer-"));
}

#[test]
fn invalid_external_edit_is_preserved_and_recovery_is_explicit() {
    let (_temp, root, backup) = fixture();
    let before = load(&root, &backup).unwrap();
    let path = storage::path(&root).unwrap();
    fs::write(&path, "{broken").unwrap();
    let recovered = load(&root, &backup).unwrap();
    assert!(recovered.validation_error.is_some());
    assert_eq!(recovered.settings, before.settings);
    assert_eq!(fs::read_to_string(&path).unwrap(), "{broken");
    assert!(commit(
        &root,
        &backup,
        &recovered.revision,
        &json!({"customAgentRules":"overwrite"}),
        |_| panic!()
    )
    .is_err());
    fs::write(&path, before.content).unwrap();
    assert!(load(&root, &backup).unwrap().validation_error.is_none());
    assert!(!path.with_extension("jsonc.lock").exists());
}

#[test]
fn precommit_failure_preserves_old_state_and_uncertain_commit_never_rolls_back() {
    let (_temp, root, backup) = fixture();
    let before = load(&root, &backup).unwrap();
    let path = storage::path(&root).unwrap();
    storage::fail_next_write(path.clone(), false);
    assert!(commit(
        &root,
        &backup,
        &before.revision,
        &json!({"customAgentRules":"candidate"}),
        |_| panic!()
    )
    .is_err());
    assert_eq!(load(&root, &backup).unwrap().revision, before.revision);
    storage::fail_next_write(path, true);
    let mut published = false;
    let error = commit(
        &root,
        &backup,
        &before.revision,
        &json!({"customAgentRules":"committed"}),
        |doc| {
            assert_eq!(doc.settings["customAgentRules"], "committed");
            published = true;
            Ok(())
        },
    )
    .unwrap_err();
    assert!(error.contains("uncertain"));
    assert!(published);
    assert_eq!(
        load(&root, &backup).unwrap().settings["customAgentRules"],
        "committed"
    );
}

#[test]
fn initialization_is_no_clobber_and_existing_editor_handles_remain_usable() {
    let (_temp, root, backup) = fixture();
    let path = storage::path(&root).unwrap();
    let before = load(&root, &backup).unwrap();
    storage::initialize(&path, "must never overwrite").unwrap();
    let handle = fs::File::open(&path).unwrap();
    commit(
        &root,
        &backup,
        &before.revision,
        &json!({"customAgentRules":"new"}),
        |_| Ok(()),
    )
    .unwrap();
    use std::io::Read;
    let mut old_snapshot = String::new();
    (&handle).read_to_string(&mut old_snapshot).unwrap();
    assert_eq!(old_snapshot, before.content);
    assert_ne!(load(&root, &backup).unwrap().revision, before.revision);
}

#[test]
fn label_projection_preserves_mr_links_and_is_scoped_to_each_clone() {
    use crate::core::db::Database;
    let conn = rusqlite::Connection::open_in_memory().unwrap();
    conn.execute_batch(include_str!("../../../core/db/schema.sql"))
        .unwrap();
    conn.execute_batch("PRAGMA foreign_keys=ON;
        INSERT INTO repositories(id,name,local_path) VALUES('a','A','/a'),('b','B','/b');
        INSERT INTO repo_labels(id,repo_id,name,color) VALUES('legacy','a','Bug','#ff0000');
        INSERT INTO virtual_mr_sessions(id,repo_id,title,base_branch,compare_branch) VALUES('mr','a','MR','main','feat');
        INSERT INTO virtual_mr_session_labels(session_id,label_id) VALUES('mr','legacy');").unwrap();
    let db = Database::from_connection(conn);
    let labels = vec![json!({"id":"legacy","name":"Renamed","color":"#00ff00"})];
    let original = db.project_repository_labels("a", &labels).unwrap();
    let clone = db.project_repository_labels("b", &labels).unwrap();
    db.project_repository_labels("a", &[]).unwrap();
    assert_eq!(
        db.project_repository_labels("a", &labels).unwrap()[0].id,
        "legacy"
    );
    assert_eq!(original[0].id, "legacy");
    assert_ne!(original[0].id, clone[0].id);
    assert_eq!(
        db.conn()
            .query_row(
                "SELECT label_id FROM virtual_mr_session_labels WHERE session_id='mr'",
                [],
                |r| r.get::<_, String>(0)
            )
            .unwrap(),
        "legacy"
    );
    assert_eq!(
        db.project_repository_labels("b", &labels).unwrap()[0].id,
        clone[0].id
    );
}

#[cfg(unix)]
#[test]
fn symlinked_settings_and_directories_are_never_followed() {
    use std::os::unix::fs::symlink;
    let (temp, root, backup) = fixture();
    let path = storage::path(&root).unwrap();
    let outside = temp.path().join("outside.jsonc");
    fs::write(&outside, "untouched").unwrap();
    fs::remove_file(&path).unwrap();
    symlink(&outside, &path).unwrap();
    assert!(load(&root, &backup).is_err());
    assert_eq!(fs::read_to_string(&outside).unwrap(), "untouched");
    fs::remove_file(&path).unwrap();
    fs::remove_dir(root.join(".stage0")).unwrap();
    symlink(temp.path(), root.join(".stage0")).unwrap();
    assert!(load(&root, &backup).is_err());
}

#[test]
fn fresh_repository_initializes_defaults_at_root_once() {
    let temp = tempfile::tempdir().unwrap();
    let root = temp.path().join("repo");
    let recovery = temp.path().join("recovery");
    assert!(std::process::Command::new("git")
        .args(["init", "--initial-branch=main"])
        .arg(&root)
        .output()
        .unwrap()
        .status
        .success());
    let initialized = load(&root, &recovery).unwrap();
    assert_eq!(initialized.settings, schema::defaults("HEAD")); // An unborn branch is not a usable comparison ref.
    assert!(root.join(".stage0/repos.jsonc").is_file());
    let reopened = load(&root, &recovery).unwrap();
    assert_eq!(initialized.revision, reopened.revision);
    assert!(fs::read_dir(root.join(".stage0"))
        .unwrap()
        .all(|entry| !entry.unwrap().path().to_string_lossy().ends_with(".lock")));
}

#[test]
fn process_exit_fixture() {
    let Some(root) = std::env::var_os("STAGE0_REPO_TRANSACTION_FIXTURE") else {
        return;
    };
    let root = std::path::PathBuf::from(root);
    let recovery = root.parent().unwrap().join("recovery");
    let before = load(&root, &recovery).unwrap();
    if std::env::var("STAGE0_REPO_TRANSACTION_PHASE").unwrap() == "before" {
        let staged = root.join(".stage0/.repos-crash.tmp");
        fs::write(&staged, "uncommitted preparation").unwrap();
        fs::OpenOptions::new()
            .read(true)
            .write(true)
            .open(staged)
            .unwrap()
            .sync_all()
            .unwrap();
        std::process::exit(0);
    }
    commit(
        &root,
        &recovery,
        &before.revision,
        &json!({"customAgentRules":"survives-process-exit"}),
        |_| {
            // Native worker disappeared before its IPC response, after durable commit.
            std::process::exit(0)
        },
    )
    .unwrap();
}

#[test]
fn restart_selects_old_or_complete_new_snapshot_after_process_exit() {
    let (_temp, root, backup) = fixture();
    let before = load(&root, &backup).unwrap();
    for phase in ["before", "after"] {
        let status = std::process::Command::new(std::env::current_exe().unwrap())
            .args([
                "--exact",
                "features::git::repo_settings::tests::process_exit_fixture",
                "--nocapture",
            ])
            .env("STAGE0_REPO_TRANSACTION_FIXTURE", &root)
            .env("STAGE0_REPO_TRANSACTION_PHASE", phase)
            .status()
            .unwrap();
        assert!(status.success());
        let restored = load(&root, &backup).unwrap();
        assert!(restored.validation_error.is_none());
        if phase == "before" {
            assert_eq!(restored.revision, before.revision);
        } else {
            assert_eq!(
                restored.settings["customAgentRules"],
                "survives-process-exit"
            );
        }
    }
}

#[test]
fn source_editor_rejects_invalid_and_stale_text_and_repairs_invalid_primary_atomically() {
    let (_temp, root, backup) = fixture();
    let before = load(&root, &backup).unwrap();
    assert!(super::save_source(&root, &backup, &before.revision, "{bad", |_| panic!()).is_err());
    assert_eq!(load(&root, &backup).unwrap().revision, before.revision);
    let edited = before
        .content
        .replace("// keep this comment", "// user comment");
    let saved = super::save_source(&root, &backup, &before.revision, &edited, |_| Ok(())).unwrap();
    assert_eq!(saved.content, edited);
    assert!(super::save_source(
        &root,
        &backup,
        &before.revision,
        &before.content,
        |_| panic!()
    )
    .is_err());
    let path = storage::path(&root).unwrap();
    fs::write(&path, "{broken outside").unwrap();
    let invalid = load(&root, &backup).unwrap();
    assert!(invalid.validation_error.is_some());
    let repaired = super::save_source(
        &root,
        &backup,
        &invalid.revision,
        &saved.content,
        |_| Ok(()),
    )
    .unwrap();
    assert!(repaired.validation_error.is_none());
    assert_eq!(storage::read(&path).unwrap(), saved.content);
}
