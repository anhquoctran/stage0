use super::discussion_deletion_outcome::DiscussionDeletionOutcome;
use crate::features::notifications::{
    NotificationDismissPolicy, NotificationLevel, NotificationPayload,
};
use crate::features::preferences::PreferencesManager;
use tauri::{AppHandle, Manager};

pub(super) fn payload(outcome: &DiscussionDeletionOutcome, language: &str) -> NotificationPayload {
    let action = crate::core::i18n::translate(
        if outcome.deleted_discussion {
            "virtualMr.activity.deletedDiscussion"
        } else {
            "virtualMr.activity.deletedReply"
        },
        language,
    );
    NotificationPayload {
        id: Some(format!("mr-deletion-{}", outcome.activity.id)),
        title: crate::core::i18n::translate("notifications.discussionDeletionTitle", language),
        body: format!(
            "{} {action} — {}",
            outcome.activity.actor_name, outcome.session_title
        ),
        level: NotificationLevel::Info,
        variant: None,
        channel: Some("mrStatus".into()),
        actions: None,
        click_action: None,
        dismiss_policy: NotificationDismissPolicy::Both,
        auto_dismiss_ms: None,
    }
}

/// Runs in the command's blocking worker after commit, even if the caller goes away.
pub(super) fn send(app: &AppHandle, outcome: &DiscussionDeletionOutcome) -> Result<(), String> {
    let language = app
        .state::<PreferencesManager>()
        .read()
        .ok()
        .and_then(|document| document.settings)
        .and_then(|settings| {
            settings
                .pointer("/appearance/language")
                .and_then(serde_json::Value::as_str)
                .map(str::to_owned)
        })
        .unwrap_or_else(|| "en".into());
    crate::features::notifications::send_notification(app, payload(outcome, &language))
}

#[cfg(test)]
#[path = "deletion_notification_tests.rs"]
mod delivery_tests;

#[cfg(test)]
mod tests {
    use super::*;
    use crate::features::virtual_mr::persistence::VirtualMrDeletionActivity;

    #[test]
    fn deletion_notifications_use_committed_identity_and_distinguish_root_from_reply() {
        let mut outcome = DiscussionDeletionOutcome {
            discussion_id: "thread".into(),
            deleted_discussion: true,
            session_title: "Example MR".into(),
            activity: VirtualMrDeletionActivity {
                id: "event-1".into(),
                session_id: "mr".into(),
                discussion_id: "thread".into(),
                comment_id: "root".into(),
                target_kind: "discussion".into(),
                actor_id: "alice@test".into(),
                actor_name: "Alice".into(),
                created_at: "2026-11-02T00:00:00Z".into(),
            },
        };
        let item = payload(&outcome, "en");
        assert_eq!(item.id.as_deref(), Some("mr-deletion-event-1"));
        assert_eq!(item.channel.as_deref(), Some("mrStatus"));
        assert_eq!(item.body, "Alice deleted a discussion — Example MR");
        assert_ne!(payload(&outcome, "vi").body, item.body);
        outcome.deleted_discussion = false;
        assert_eq!(
            payload(&outcome, "en").body,
            "Alice deleted a reply — Example MR"
        );
    }
}
