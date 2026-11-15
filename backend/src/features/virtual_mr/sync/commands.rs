use super::{persistence, repository_changed, state::MrSyncState};
use crate::core::db::Database;
use tauri::{AppHandle, Manager};

pub(crate) fn membership(db: &Database, id: &str) -> Option<(String, String, String)> {
    db.conn()
        .query_row(
            "SELECT base_branch,compare_branch,status FROM virtual_mr_sessions WHERE id=?1",
            [id],
            |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?)),
        )
        .ok()
}

pub(crate) fn session_saved(
    app: &AppHandle,
    session: &crate::features::virtual_mr::persistence::VirtualMrSessionDb,
    previous: Option<String>,
    before: Option<(String, String, String)>,
) {
    let db = app.state::<Database>();
    if membership(&db, &session.id) != before {
        super::registry_changed(app);
    }
    let path = db
        .conn()
        .query_row(
            "SELECT local_path FROM repositories WHERE id=?1",
            [&session.repo_id],
            |r| r.get::<_, String>(0),
        )
        .ok();
    if let Some(path) = path {
        repository_changed(app, &path);
    }
    if let Some(previous) = previous {
        let actual = db
            .conn()
            .query_row(
                "SELECT status FROM virtual_mr_sessions WHERE id=?1",
                [&session.id],
                |r| r.get::<_, String>(0),
            )
            .ok();
        if let Some(actual) = actual {
            tauri::async_runtime::spawn(crate::features::virtual_mr::status_notification::send(
                app.clone(),
                session.title.clone(),
                previous,
                actual,
            ));
        }
    }
}

pub(crate) async fn read_states(
    app: AppHandle,
    repo_id: String,
    refresh: bool,
) -> Result<Vec<MrSyncState>, String> {
    tauri::async_runtime::spawn_blocking(move || {
        if refresh {
            let path: String = app
                .state::<Database>()
                .conn()
                .query_row(
                    "SELECT local_path FROM repositories WHERE id=?1",
                    [&repo_id],
                    |r| r.get(0),
                )
                .map_err(|e| e.to_string())?;
            repository_changed(&app, &path);
        }
        persistence::list(&app.state::<Database>(), &repo_id)
    })
    .await
    .map_err(|e| e.to_string())?
}
