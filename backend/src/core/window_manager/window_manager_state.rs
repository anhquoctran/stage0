use super::{OpenPlan, Registry, RepositoryContext, WindowRecord, WindowStartupContext};
use std::sync::{Mutex, MutexGuard};
use tauri::{AppHandle, Manager};

#[derive(Default)]
pub struct WindowManagerState(pub(super) Mutex<Registry>);

impl WindowManagerState {
    pub(super) fn lock(&self) -> MutexGuard<'_, Registry> {
        self.0
            .lock()
            .unwrap_or_else(std::sync::PoisonError::into_inner)
    }

    pub fn register_welcome_window(&self, label: &str, restore_recent: bool) {
        self.lock()
            .windows
            .entry(label.to_string())
            .or_insert(WindowRecord {
                repo: None,
                restore_recent,
                opening: false,
            });
    }

    pub fn startup_context(&self, label: &str) -> WindowStartupContext {
        let registry = self.lock();
        let record = registry.windows.get(label);
        WindowStartupContext {
            repo: record.and_then(|window| window.repo.as_ref().map(|repo| repo.info.clone())),
            restore_recent: record.map(|window| window.restore_recent).unwrap_or(false),
        }
    }

    pub fn has_repository(&self, label: &str) -> bool {
        self.lock()
            .windows
            .get(label)
            .is_some_and(|window| window.repo.is_some())
    }

    pub(super) fn plan_open(
        &self,
        app: &AppHandle,
        context: &RepositoryContext,
        caller_label: Option<&str>,
        force_new_window: bool,
    ) -> OpenPlan {
        let live_windows = app.webview_windows();
        let focused_labels = live_windows
            .iter()
            .filter_map(|(label, window)| {
                window
                    .is_focused()
                    .ok()
                    .filter(|focused| *focused)
                    .map(|_| label.clone())
            })
            .collect::<Vec<_>>();

        let mut registry = self.lock();
        if let Some(label) = registry.repo_to_window.get(&context.identity).cloned() {
            if live_windows.contains_key(&label) {
                return OpenPlan::Existing(label);
            }

            let is_opening = registry
                .windows
                .get(&label)
                .map(|record| record.opening)
                .unwrap_or(false);
            if is_opening {
                return OpenPlan::Opening(label);
            }

            registry.repo_to_window.remove(&context.identity);
            registry.windows.remove(&label);
        }

        if !force_new_window {
            if let Some(label) = caller_label {
                if registry
                    .windows
                    .get(label)
                    .is_some_and(|record| record.repo.is_none())
                {
                    Self::assign_repo(&mut registry, label, context);
                    return OpenPlan::AssignedHere(label.to_string());
                }
            } else {
                let mut candidates = focused_labels;
                candidates.push("main".to_string());
                candidates.extend(registry.windows.keys().cloned());
                let welcome_label = candidates
                    .iter()
                    .find(|label| {
                        registry
                            .windows
                            .get(*label)
                            .is_some_and(|record| record.repo.is_none())
                            && live_windows.contains_key(*label)
                    })
                    .cloned();
                if let Some(label) = welcome_label {
                    Self::assign_repo(&mut registry, &label, context);
                    return OpenPlan::AssignedExternal(label);
                }
            }
        }

        let label = format!("win_repo_{}", uuid::Uuid::new_v4().simple());
        registry.windows.insert(
            label.clone(),
            WindowRecord {
                repo: Some(context.clone()),
                restore_recent: false,
                opening: true,
            },
        );
        registry
            .repo_to_window
            .insert(context.identity.clone(), label.clone());
        OpenPlan::CreateRepoWindow(label)
    }

    pub(super) fn assign_repo(registry: &mut Registry, label: &str, context: &RepositoryContext) {
        if let Some(record) = registry.windows.get_mut(label) {
            record.repo = Some(context.clone());
            record.restore_recent = false;
            record.opening = false;
            registry
                .repo_to_window
                .insert(context.identity.clone(), label.to_string());
        }
    }

    pub(super) fn finish_open(&self, label: &str) {
        if let Some(record) = self.lock().windows.get_mut(label) {
            record.opening = false;
        }
    }

    pub fn close_repository(&self, label: &str) -> Option<RepositoryContext> {
        let mut registry = self.lock();
        let old_repo = {
            let record = registry.windows.get_mut(label)?;
            let old_repo = record.repo.take();
            record.restore_recent = false;
            record.opening = false;
            old_repo
        };
        if let Some(repo) = &old_repo {
            registry.repo_to_window.remove(&repo.identity);
        }
        old_repo
    }

    pub fn unregister_window(&self, label: &str) -> Option<RepositoryContext> {
        let mut registry = self.lock();
        let record = registry.windows.remove(label)?;
        if let Some(repo) = &record.repo {
            registry.repo_to_window.remove(&repo.identity);
        }
        record.repo
    }

    pub(super) fn remove_failed_window(&self, label: &str) {
        let _ = self.unregister_window(label);
    }
}
