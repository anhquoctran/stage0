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
) -> Option<NotificationPayload> {
    if !matches!(status, "completed" | "partial") {
        return None;
    }
    let mut body = title.to_owned();
    if status == "partial" {
        body.push_str(&crate::core::i18n::translate(
            "reviewFlow.partialSuffix",
            language,
        ));
    }
    Some(NotificationPayload {
        id: Some(format!("review-completed-{id}")),
        title: crate::core::i18n::translate("reviewFlow.completedTitle", language)
            .replace("{{reviewer}}", reviewer),
        body,
        level: if status == "partial" {
            NotificationLevel::Warning
        } else {
            NotificationLevel::Success
        },
        variant: None,
        channel: Some("aiReview".into()),
        actions: None,
        click_action: None,
        dismiss_policy: NotificationDismissPolicy::Both,
        auto_dismiss_ms: None,
    })
}

pub(super) async fn send(app: AppHandle, run: ReviewRun) {
    if !matches!(run.status.as_str(), "completed" | "partial") {
        return;
    }
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
                [&run.session_id],
                |row| row.get::<_, String>(0),
            )
            .unwrap_or_else(|_| {
                crate::core::i18n::translate("reviewFlow.virtualMrFallback", &language)
            });
        if let Some(payload) = payload(
            &run.id,
            &run.status,
            run.reviewer_name.as_deref().unwrap_or("Stage0 AI"),
            &title,
            &language,
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
        let item = payload("run-1", "completed", "Reviewer", "MR title", "en").unwrap();
        assert_eq!(item.id.as_deref(), Some("review-completed-run-1"));
        assert_eq!(item.channel.as_deref(), Some("aiReview"));
        assert_eq!(item.title, "Reviewer finished an MR review");
        assert_eq!(item.body, "MR title");
    }
    #[test]
    fn partial_is_visible_and_unsuccessful_runs_never_claim_completion() {
        assert!(payload("r", "partial", "Bot", "MR", "en")
            .unwrap()
            .body
            .contains("Coverage was incomplete"));
        for status in [
            "running",
            "failed",
            "cancelled",
            "incomplete",
            "interrupted",
        ] {
            assert!(payload("r", status, "Bot", "MR", "en").is_none());
        }
    }
    #[test]
    fn native_completion_uses_the_saved_ui_language() {
        assert_ne!(
            payload("r", "completed", "Bot", "MR", "vi").unwrap().title,
            payload("r", "completed", "Bot", "MR", "en").unwrap().title
        );
    }
}
