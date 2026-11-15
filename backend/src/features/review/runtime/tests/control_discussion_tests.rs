use super::{
    continuation_tests::{response, PlanningModel},
    *,
};
use crate::features::review::{
    discussion_scope,
    runtime::{discussions, tool_state::ReviewToolState},
};

fn add(db: &Database, id: &str, kind: &str, body: &str, path: Option<&str>) {
    db.conn()
        .execute(
            "INSERT INTO virtual_mr_discussions(id,session_id,file_path) VALUES(?1,'session',?2)",
            rusqlite::params![id, path],
        )
        .unwrap();
    db.conn().execute("INSERT INTO virtual_mr_comments(id,discussion_id,author_type,author_id,author_name,body,created_at,updated_at) VALUES(?1,?2,?3,'bot','Bot',?4,'now','now')",rusqlite::params![format!("{id}-root"),id,kind,body]).unwrap();
}
fn clean() -> (TestRepo, ReviewRun, Arc<Mutex<ReviewContext>>, Database) {
    let repo = TestRepo::new();
    repo.git(&["rm", ".env"]);
    repo.write("source.rs", "fn value() -> u32 { 2 }\n");
    repo.write("deleted.rs", "fn deleted() {}\n");
    repo.git(&["add", "."]);
    repo.git(&["commit", "-m", "Clean review control fixture"]);
    let (mut run, ctx) = repo.review();
    run.reviewer_id = Some("bot".into());
    let db = test_database(&run);
    db.save_review_run(&run).unwrap();
    db.conn().execute("INSERT INTO virtual_mr_session_reviewers(session_id,agent_id,agent_name) VALUES('session','bot','Bot')",[]).unwrap();
    (repo, run, Arc::new(Mutex::new(ctx)), db)
}

#[test]
fn administrative_commands_are_excluded_but_real_inline_comments_and_human_followups_stay_visible()
{
    let (_repo, run, context, db) = clean();
    for n in 0..7 {
        let id = format!("command-{n}");
        add(
            &db,
            &id,
            "user",
            "[@Bot](#mr-mention/reviewer/bot) review",
            None,
        );
        db.conn().execute("INSERT INTO virtual_mr_comments(id,discussion_id,author_type,author_id,author_name,body,created_at,updated_at) VALUES(?1,?2,'ai_agent','bot','Bot',?3,'now','now')",rusqlite::params![format!("{id}-progress"),id,"Review progress and historical provider diagnostic. ".repeat(30)]).unwrap();
    }
    add(
        &db,
        "inline",
        "ai_agent",
        "Actual code concern",
        Some("source.rs"),
    );
    add(&db, "general", "user", "!1", None);
    add(
        &db,
        "quoted",
        "user",
        "> [@Bot](#mr-mention/reviewer/bot) review",
        None,
    );
    add(&db,"multiple","user","[@Bot](#mr-mention/reviewer/bot) this needs fixing [@Bot](#mr-mention/reviewer/bot) review",None);
    add(
        &db,
        "followup",
        "user",
        "[@Bot](#mr-mention/reviewer/bot) review",
        None,
    );
    db.conn().execute_batch("INSERT INTO virtual_mr_comments(id,discussion_id,author_type,author_id,author_name,body,created_at,updated_at) VALUES('question','followup','user','alice','Alice','[@Bot](#mr-mention/reviewer/bot) Please explain this condition','now','now')").unwrap();
    let threads = db.list_discussions("session").unwrap();
    assert_eq!(
        threads
            .iter()
            .filter(|d| discussion_scope::is_control(d))
            .count(),
        7
    );
    let mut state = ReviewToolState::new(false);
    let page = discussions::list(&db, &run, &mut state, &context, 0).unwrap();
    assert_eq!(page["totalOpen"], 5);
    assert!(page["nextOffset"].is_null());
    assert_eq!(
        page["threads"]
            .as_array()
            .unwrap()
            .iter()
            .filter(|d| d["requiresResolution"] == true)
            .count(),
        1
    );
    assert!(page["threads"]
        .as_array()
        .unwrap()
        .iter()
        .any(|d| d["id"] == "followup" && d["canReply"] == true));
    assert!(!state.observations.contains_key("command-0"));
    assert_eq!(
        discussion_scope::unresolved_ids(&db.conn(), "session").unwrap(),
        vec!["inline"]
    );
    add(
        &db,
        "malformed-anchor",
        "user",
        "Invalid anchor must still fail closed",
        Some(""),
    );
    let malformed = db
        .list_discussions("session")
        .unwrap()
        .into_iter()
        .find(|d| d.id == "malformed-anchor")
        .unwrap();
    assert!(discussion_scope::requires_resolution(&malformed));
    assert!(discussion_scope::unresolved_ids(&db.conn(), "session")
        .unwrap()
        .contains(&"malformed-anchor".into()));
}

#[tokio::test]
async fn manual_review_can_approve_complete_source_without_resolving_its_own_command_or_general_comments(
) {
    let (_repo, mut run, context, db) = clean();
    for n in 0..7 {
        add(
            &db,
            &format!("command-{n}"),
            "user",
            "[@Bot](#mr-mention/reviewer/bot) review",
            None,
        );
    }
    add(&db, "reference", "user", "!1", None);
    let mut cfg = config("http://localhost".into());
    cfg.reviewer_id = Some("bot".into());
    cfg.reviewer_name = Some("Bot".into());
    cfg.manual_review_discussion_id = Some("command-0".into());
    let model = PlanningModel::new(vec![
        response("list_open_discussions", json!({"offset":0}), 4000, 1000),
        response(
            "submit_review",
            json!({"summary":"Complete source inspected; administrative commands and references are not code findings.","decision":"approve","findings":[]}),
            5000,
            1000,
        ),
    ]);
    let result = execute_with_adapter(&db, &cfg, &mut run, &context, &model).await;
    assert!(result.is_ok(), "{result:?}");
    run.finish(result);
    assert_eq!(run.status, "completed");
    assert!(run.published);
    assert_eq!(context.lock().unwrap().complete_diffs.len(), 1);
    assert_eq!(run.decision.as_deref(), Some("approve"));
    let requests = model.requests.lock().unwrap();
    assert_eq!(requests.len(), 2);
    let page: Value = serde_json::from_str(
        requests[1]["messages"]
            .as_array()
            .unwrap()
            .iter()
            .find(|m| m["role"] == "tool")
            .unwrap()["content"]
            .as_str()
            .unwrap(),
    )
    .unwrap();
    assert_eq!(page["result"]["threads"].as_array().unwrap().len(), 1);
    assert_eq!(page["result"]["threads"][0]["requiresResolution"], false);
    assert!(db
        .list_discussions("session")
        .unwrap()
        .iter()
        .all(|d| !d.is_resolved));
    let status: String = db
        .conn()
        .query_row(
            "SELECT status FROM virtual_mr_sessions WHERE id='session'",
            [],
            |r| r.get(0),
        )
        .unwrap();
    assert_eq!(status, "resolved");
}

#[test]
fn a_new_inline_concern_blocks_publication_atomically_even_if_previous_context_had_only_commands() {
    let (_repo, mut run, _context, db) = clean();
    add(
        &db,
        "request",
        "user",
        "[@Bot](#mr-mention/reviewer/bot) review",
        None,
    );
    assert!(discussion_scope::unresolved_ids(&db.conn(), "session")
        .unwrap()
        .is_empty());
    // A real concern arrives after the earlier context was read.
    add(
        &db,
        "new-concern",
        "user",
        "Please verify this changed branch condition",
        Some("source.rs"),
    );
    run.status = "completed".into();
    run.decision = Some("approve".into());
    assert!(db.publish_review_actions(&run, &[]).is_err());
    let mut unassigned = run.clone();
    unassigned.reviewer_id = None;
    assert!(db.publish_review_actions(&unassigned, &[]).is_err());
    let status: String = db
        .conn()
        .query_row(
            "SELECT review_status FROM virtual_mr_session_reviewers WHERE session_id='session'",
            [],
            |r| r.get(0),
        )
        .unwrap();
    assert_eq!(status, "pending");
    assert!(!db.get_review_run(&run.id).unwrap().published);
    assert!(
        !db.list_discussions("session")
            .unwrap()
            .iter()
            .find(|d| d.id == "new-concern")
            .unwrap()
            .is_resolved
    );
}

#[tokio::test]
async fn control_thread_exclusion_cannot_turn_redacted_or_unread_source_into_approval() {
    let repo = TestRepo::new();
    let (mut run, ctx) = repo.review();
    let db = test_database(&run);
    db.save_review_run(&run).unwrap();
    add(
        &db,
        "request",
        "user",
        "[@Bot](#mr-mention/reviewer/bot) review",
        None,
    );
    let model = PlanningModel::new(vec![response(
        "submit_review",
        json!({"summary":"No approval allowed with private/excluded content","decision":"approve","findings":[]}),
        1000,
        1000,
    )]);
    let result = execute_with_adapter(
        &db,
        &config("http://localhost".into()),
        &mut run,
        &Arc::new(Mutex::new(ctx)),
        &model,
    )
    .await;
    assert!(result.is_err());
    assert!(!run.published);
    assert_eq!(run.decision, None);
    assert!(!db.get_review_run(&run.id).unwrap().published);
}

#[tokio::test]
async fn measured_22056_token_trace_can_finish_while_redacted_source_stays_partial() {
    let repo = TestRepo::new();
    for n in 0..8 {
        repo.write(
            &format!("module-{n}.rs"),
            &format!("fn module_{n}() -> u32 {{ {n} }}\n"),
        );
    }
    repo.git(&["rm", ".env"]);
    repo.git(&["add", "."]);
    repo.git(&[
        "commit",
        "-m",
        "Measured trace fixture with redacted source",
    ]);
    let (mut run, ctx) = repo.review();
    assert_eq!(run.snapshot.changed_files.len(), 10);
    assert!(run.snapshot.excluded_files.is_empty());
    let context = Arc::new(Mutex::new(ctx));
    let db = test_database(&run);
    db.save_review_run(&run).unwrap();
    for n in 0..7 {
        add(
            &db,
            &format!("request-{n}"),
            "user",
            "[@Bot](#mr-mention/reviewer/bot) review",
            None,
        );
    }
    add(&db, "reference", "user", "!1", None);
    let mut cfg = config("http://localhost".into());
    cfg.generate_description = true;
    let mut inspect = response("list_open_discussions", json!({"offset":0}), 10589, 3548);
    for name in ["source.rs", "module-0.rs", "module-1.rs"] {
        let next = response(
            "read_file_range",
            json!({"filePath":name,"side":"head","startLine":1,"endLine":1}),
            0,
            0,
        );
        inspect["choices"][0]["message"]["tool_calls"]
            .as_array_mut()
            .unwrap()
            .push(next["choices"][0]["message"]["tool_calls"][0].clone());
    }
    let model = super::output_headroom_tests::replay_thinking(vec![
        response(
            "update_mr_description",
            json!({"description":"Review ten changed files, with one source-policy redaction."}),
            6586,
            1333,
        ),
        inspect,
        response(
            "submit_review",
            json!({"summary":"Reviewed eligible diffs; redacted source prevents complete assurance.","decision":"comment","findings":[]}),
            18000,
            1000,
        ),
    ]);
    let outcome = execute_with_adapter(&db, &cfg, &mut run, &context, &model).await;
    assert!(outcome.is_ok(), "{outcome:?}");
    run.finish(outcome);
    assert_eq!(run.turns, 3);
    assert_eq!(run.usage_tokens, 41056);
    assert!(run.usage_tokens < 64000);
    assert!(run.published);
    assert_eq!(run.status, "partial");
    assert_eq!(run.decision.as_deref(), Some("comment"));
    assert_eq!(context.lock().unwrap().complete_diffs.len(), 10);
    let events = db.review_events(&run.id).unwrap();
    assert!(!events.iter().any(|e| e["kind"] == "budget_exhausted"));
    let detail =
        &events.iter().find(|e| e["kind"] == "submitted").unwrap()["detail"]["coverageDiagnostics"];
    assert_eq!(detail["sourceContextLimited"], true);
    assert_eq!(detail["completeDiffFileCount"], 10);
    assert_eq!(detail["toolErrors"], false);
    for event in events.iter().filter(|e| e["kind"] == "model_request") {
        assert!(event["detail"]["maxOutputTokens"].as_u64().unwrap() >= 4096);
    }
}
