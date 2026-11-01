use crate::features::notifications::{
    NotificationDismissPolicy, NotificationLevel, NotificationPayload,
};
use crate::features::preferences::PreferencesManager;
use tauri::{AppHandle, Manager};

fn payload(title: &str, before: &str, after: &str, language: &str) -> Option<NotificationPayload> {
    fn status(value: &str, language: &str) -> Option<String> {
        match value {
            "open" | "resolved" | "closed" => Some(crate::core::i18n::translate(
                &format!("virtualMr.listDialog.status.{value}"),
                language,
            )),
            _ => None,
        }
    }
    if before == after {
        return None;
    }
    let before = status(before, language)?;
    let after = status(after, language)?;
    Some(NotificationPayload {
        id: Some(format!("mr-status-{}", uuid::Uuid::new_v4())),
        title: crate::core::i18n::translate("notifications.mrStatusNotificationTitle", language),
        body: format!("{title}: {before} → {after}"),
        level: NotificationLevel::Info,
        variant: None,
        channel: Some("mrStatus".into()),
        actions: None,
        click_action: None,
        dismiss_policy: NotificationDismissPolicy::Both,
        auto_dismiss_ms: None,
    })
}

pub(crate) async fn send(app: AppHandle, title: String, before: String, after: String) {
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
        if let Some(notification) = payload(&title, &before, &after, &language) {
            crate::features::notifications::send_notification(&app, notification)?;
        }
        Ok::<(), String>(())
    })
    .await;
    if !matches!(result, Ok(Ok(()))) {
        eprintln!("MR status notification delivery: {result:?}");
    }
}

pub(crate) async fn send_review_transition(app: AppHandle, run_id: String, session_id: String) {
    let lookup_app = app.clone();
    let result = tauri::async_runtime::spawn_blocking(move || {
        let db = lookup_app.state::<crate::core::db::Database>();
        let conn = db.conn();
        conn.query_row(
            "SELECT s.title FROM virtual_mr_sessions s WHERE s.id=?1 AND EXISTS (SELECT 1 FROM ai_review_events e WHERE e.run_id=?2 AND e.kind='mr_status_changed')",
            [&session_id, &run_id], |row| row.get::<_, String>(0),
        ).ok()
    }).await;
    if let Ok(Some(title)) = result {
        send(app, title, "open".into(), "resolved".into()).await;
    }
}

#[cfg(test)]
mod tests {
    use super::payload;
    #[test]
    fn only_actual_recognized_transitions_are_notified() {
        for before in ["open", "resolved", "closed"] {
            for after in ["open", "resolved", "closed"] {
                let item = payload("MR title", before, after, "en");
                assert_eq!(item.is_some(), before != after);
                if let Some(item) = item {
                    assert_eq!(item.channel.as_deref(), Some("mrStatus"));
                    assert!(item.body.starts_with("MR title:"));
                }
            }
        }
        assert!(payload("MR", "open", "unknown", "en").is_none());
        assert_ne!(
            payload("MR", "open", "closed", "en").unwrap().title,
            payload("MR", "open", "closed", "vi").unwrap().title
        );
    }
}
