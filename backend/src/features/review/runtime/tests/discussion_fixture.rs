use super::*;
use crate::features::review::{runtime::tool_state::ReviewToolState, ReviewToolCall};

pub(super) fn setup(root: &str) -> (TestRepo, ReviewRun, Arc<Mutex<ReviewContext>>, Database) {
    let repo = TestRepo::new();
    let (mut run, context) = repo.review();
    run.reviewer_id = Some("bot".into());
    let db = test_database(&run);
    db.save_review_run(&run).unwrap();
    db.conn().execute_batch("INSERT INTO virtual_mr_session_reviewers(session_id,agent_id,agent_name,review_status) VALUES('session','bot','Bot','approved'); INSERT INTO virtual_mr_discussions(id,session_id,file_path,diff_side,line_number) VALUES('thread','session','source.rs','right',1);").unwrap();
    db.conn()
        .execute(
            "UPDATE virtual_mr_discussions SET commit_id=?1 WHERE id='thread'",
            [&run.snapshot.head_sha],
        )
        .unwrap();
    db.conn().execute("INSERT INTO virtual_mr_comments(id,discussion_id,author_type,author_id,author_name,body,created_at,updated_at) VALUES('root','thread','ai_agent','bot','Bot',?1,'now','now')", [root]).unwrap();
    db.conn().execute_batch("INSERT INTO virtual_mr_comments(id,discussion_id,author_type,author_id,author_name,body,created_at,updated_at) VALUES('user','thread','user','alice','Alice','Please explain or recheck the fix','now','now');").unwrap();
    (repo, run, Arc::new(Mutex::new(context)), db)
}

pub(super) fn call(name: &str, arguments: serde_json::Value) -> ReviewToolCall {
    ReviewToolCall {
        id: uuid::Uuid::new_v4().to_string(),
        native_id: None,
        name: name.into(),
        arguments,
    }
}

pub(super) fn action(db: &Database) -> serde_json::Value {
    json!({"discussionId":"thread","targetCommentId":"user",
        "discussionRevision":crate::features::review::discussion_revision::current(&db.conn(), "thread").unwrap(),"body":"Here is the evidence and what remains unverified."})
}

pub(super) fn list(
    db: &Database,
    run: &ReviewRun,
    state: &mut ReviewToolState,
    context: &Arc<Mutex<ReviewContext>>,
) -> serde_json::Value {
    super::super::discussions::list(db, run, state, context, 0).unwrap()
}
