use super::super::persistence::VirtualMrDiscussionActivity;
use crate::core::db::Database;
use tauri::{AppHandle, Manager};

pub(super) fn resolve_as_local_user(
    db: &Database,
    discussion_id: &str,
    is_resolved: bool,
    resolve_type: &str,
) -> Result<(), String> {
    let session_id: String = db
        .conn()
        .query_row(
            "SELECT session_id FROM virtual_mr_discussions WHERE id=?1",
            [discussion_id],
            |row| row.get(0),
        )
        .map_err(|error| error.to_string())?;
    let path = db
        .get_repo_path_for_session(&session_id)
        .map_err(|error| error.to_string())?
        .ok_or("Repository not found")?;
    let (name, email) = crate::features::git::ops::get_git_user_identity(&path)?;
    db.resolve_discussion_with_activity(discussion_id, is_resolved, resolve_type, &email, &name)
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub async fn list_mr_discussion_activity(
    app: AppHandle,
    session_id: String,
) -> Result<Vec<VirtualMrDiscussionActivity>, String> {
    tauri::async_runtime::spawn_blocking(move || {
        app.state::<Database>()
            .list_mr_discussion_activity(&session_id)
            .map_err(|error| error.to_string())
    })
    .await
    .map_err(|error| error.to_string())?
    .map_err(|error| crate::common::messages::command_error("virtualMr", error))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn resolution_audit_uses_the_repository_git_identity() {
        let directory = tempfile::tempdir().unwrap();
        let path = directory.path().to_str().unwrap();
        for args in [
            vec!["init", "--template="],
            vec!["config", "user.name", "Actual Alice"],
            vec!["config", "user.email", "alice@test"],
        ] {
            assert!(std::process::Command::new("git")
                .arg("-C")
                .arg(path)
                .args(args)
                .output()
                .unwrap()
                .status
                .success());
        }
        let conn = rusqlite::Connection::open_in_memory().unwrap();
        conn.execute_batch(include_str!("../../../core/db/schema.sql"))
            .unwrap();
        conn.execute(
            "INSERT INTO repositories(id,name,local_path) VALUES('repo','Repo',?1)",
            [path],
        )
        .unwrap();
        conn.execute_batch("INSERT INTO virtual_mr_sessions(id,repo_id,title,base_branch,compare_branch,assignee_name) VALUES('mr','repo','MR','main','topic','Another Assignee'); INSERT INTO virtual_mr_discussions(id,session_id,file_path) VALUES('thread','mr','src/cart.ts'); INSERT INTO virtual_mr_comments(id,discussion_id,author_type,author_id,author_name,body) VALUES('root','thread','ai_agent','tester','Tester','Finding');").unwrap();
        let db = Database::from_connection(conn);
        resolve_as_local_user(&db, "thread", true, "manual").unwrap();
        let events = db.list_mr_discussion_activity("mr").unwrap();
        assert_eq!(events[0].actor_id, "alice@test");
        assert_eq!(events[0].actor_name, "Actual Alice");
        assert_eq!(
            db.list_discussions("mr").unwrap()[0].resolved_by.as_deref(),
            Some("Actual Alice")
        );
    }
}
