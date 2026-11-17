//! Completion delivery belongs to the run lifecycle, never a polling WebView.
use super::ReviewRun;
use crate::core::db::Database;
use crate::features::notifications::{
    NotificationDismissPolicy, NotificationLevel, NotificationPayload,
};
use crate::features::preferences::PreferencesManager;
use tauri::{AppHandle, Manager};

fn payload(
    id: &str,
    status: &str,
    reviewer: &str,
    title: &str,
    language: &str,
    history_available: bool,
) -> Option<NotificationPayload> {
    if !matches!(status, "completed" | "partial" | "failed" | "incomplete") {
        return None;
    }
    let mut body = title.to_owned();
    if status == "partial" {
        body.push_str(&crate::core::i18n::translate(
            "reviewFlow.partialSuffix",
            language,
        ));
    }
    if matches!(status, "failed" | "incomplete") && history_available {
        body.push_str(&crate::core::i18n::translate(
            "reviewFlow.reviewHistorySuffix",
            language,
        ));
    }
    let title_key = match status {
        "failed" => "reviewFlow.failedNotificationTitle",
        "incomplete" => "reviewFlow.incompleteNotificationTitle",
        _ => "reviewFlow.completedTitle",
    };
    Some(NotificationPayload {
        id: Some(format!(
            "review-{}-{id}",
            if matches!(status, "failed" | "incomplete") {
                status
            } else {
                "completed"
            }
        )),
        title: crate::core::i18n::translate(title_key, language).replace("{{reviewer}}", reviewer),
        body,
        level: match status {
            "failed" => NotificationLevel::Error,
            "partial" | "incomplete" => NotificationLevel::Warning,
            _ => NotificationLevel::Success,
        },
        variant: None,
        channel: Some("aiReview".into()),
        actions: None,
        click_action: None,
        dismiss_policy: NotificationDismissPolicy::Both,
        auto_dismiss_ms: None,
    })
}

pub(super) fn should_notify(run: &ReviewRun) -> bool {
    !(run.reply_discussion_id.is_some() && run.status == "completed" && !run.published)
}

pub(in crate::features::review) async fn send(
    app: AppHandle,
    run: ReviewRun,
    history_available: bool,
) {
    if !should_notify(&run) {
        return;
    }
    if !matches!(
        run.status.as_str(),
        "completed" | "partial" | "failed" | "incomplete"
    ) {
        return;
    }
    send_details(
        app,
        run.id,
        run.session_id,
        run.reviewer_name,
        run.status,
        history_available,
    )
    .await;
}

pub(in crate::features::review) async fn send_failure(
    app: AppHandle,
    id: String,
    session_id: String,
    reviewer_name: Option<String>,
    history_available: bool,
) {
    send_details(
        app,
        id,
        session_id,
        reviewer_name,
        "failed".into(),
        history_available,
    )
    .await;
}

async fn send_details(
    app: AppHandle,
    id: String,
    session_id: String,
    reviewer_name: Option<String>,
    status: String,
    history_available: bool,
) {
    let result = tauri::async_runtime::spawn_blocking(move || {
        let language = app
            .state::<PreferencesManager>()
            .read()
            .ok()
            .and_then(|doc| doc.settings)
            .and_then(|settings| {
                settings
                    .pointer("/appearance/language")
                    .and_then(serde_json::Value::as_str)
                    .map(str::to_owned)
            })
            .unwrap_or_else(|| "en".into());
        let title = app
            .state::<Database>()
            .conn()
            .query_row(
                "SELECT title FROM virtual_mr_sessions WHERE id=?1",
                [&session_id],
                |row| row.get::<_, String>(0),
            )
            .unwrap_or_else(|_| {
                crate::core::i18n::translate("reviewFlow.virtualMrFallback", &language)
            });
        if let Some(payload) = payload(
            &id,
            &status,
            reviewer_name.as_deref().unwrap_or("Stage0 AI"),
            &title,
            &language,
            history_available,
        ) {
            crate::features::notifications::send_notification(&app, payload)?;
        }
        Ok::<(), String>(())
    })
    .await;
    if !matches!(result, Ok(Ok(()))) {
        eprintln!("Review completion notification delivery: {result:?}");
    }
}

#[cfg(test)]
mod tests {
    use super::payload;
    #[test]
    fn completion_does_not_depend_on_new_findings_or_a_manual_request() {
        let item = payload("run-1", "completed", "Reviewer", "MR title", "en", true).unwrap();
        assert_eq!(item.id.as_deref(), Some("review-completed-run-1"));
        assert_eq!(item.channel.as_deref(), Some("aiReview"));
        assert_eq!(item.title, "Reviewer finished an MR review");
        assert_eq!(item.body, "MR title");
    }
    #[test]
    fn partial_is_visible_and_unsuccessful_runs_never_claim_completion() {
        assert!(payload("r", "partial", "Bot", "MR", "en", true)
            .unwrap()
            .body
            .contains("Coverage was incomplete"));
        for status in ["running", "cancelled", "interrupted"] {
            assert!(payload("r", status, "Bot", "MR", "en", true).is_none());
        }
    }
    #[test]
    fn failed_and_incomplete_runs_notify_without_claiming_completion() {
        for status in ["failed", "incomplete"] {
            let item = payload("r", status, "Bot", "MR", "en", true).unwrap();
            assert_eq!(
                item.id.as_deref(),
                Some(format!("review-{status}-r").as_str())
            );
            assert_eq!(item.channel.as_deref(), Some("aiReview"));
            assert!(item.title.contains("Bot"));
            assert!(!item.title.contains("finished"));
            assert!(item.body.contains("review history"));
        }
        assert!(matches!(
            payload("r", "failed", "Bot", "MR", "en", true)
                .unwrap()
                .level,
            super::NotificationLevel::Error
        ));
    }
    #[test]
    fn native_completion_uses_the_saved_ui_language() {
        assert_ne!(
            payload("r", "completed", "Bot", "MR", "vi", true)
                .unwrap()
                .title,
            payload("r", "completed", "Bot", "MR", "en", true)
                .unwrap()
                .title
        );
    }
    #[test]
    fn failures_without_saved_history_do_not_direct_users_to_missing_history() {
        let item = payload("r", "failed", "Bot", "MR", "en", false).unwrap();
        assert_eq!(item.body, "MR");
        assert!(item.title.contains("could not finish"));
    }
}
