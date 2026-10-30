//! Secret-free write counters. No extra keyring reads, retries or inventory scans.
use std::sync::atomic::{AtomicU64, Ordering};

static NEXT_OPERATION: AtomicU64 = AtomicU64::new(1);

pub(crate) struct KeyringWriteProgress {
    id: u64,
    kind: &'static str,
    layout: &'static str,
    planned: usize,
    attempted: usize,
    written: usize,
    failed: usize,
    rollback_attempted: usize,
    rollback_succeeded: usize,
    committed: bool,
    stage: &'static str,
}

impl KeyringWriteProgress {
    pub(crate) fn new(kind: &'static str, layout: &'static str, planned: usize) -> Self {
        let progress = Self {
            id: NEXT_OPERATION.fetch_add(1, Ordering::Relaxed),
            kind,
            layout,
            planned,
            attempted: 0,
            written: 0,
            failed: 0,
            rollback_attempted: 0,
            rollback_succeeded: 0,
            committed: false,
            stage: "prepare",
        };
        progress.log("start");
        progress
    }

    #[cfg(test)]
    pub(crate) fn stage(&mut self, stage: &'static str) {
        self.stage = stage;
        self.log("stage");
    }

    pub(crate) fn write_item(
        &mut self,
        stage: &'static str,
        write: impl FnOnce() -> Result<(), String>,
    ) -> Result<(), String> {
        self.stage = stage;
        self.attempted += 1;
        // Print before entering the OS call, so a permission dialog cannot hide
        // how many writes are still pending. Never format the error or payload.
        self.log("item_start");
        let result = write();
        if result.is_ok() {
            self.written += 1;
            self.log("item_written");
        } else {
            self.failed += 1;
            self.log("item_failed");
        }
        result
    }

    #[cfg(test)]
    pub(crate) fn rollback_item(
        &mut self,
        restore: impl FnOnce() -> Result<(), String>,
    ) -> Result<(), String> {
        self.stage = "rollback";
        self.rollback_attempted += 1;
        self.log("rollback_start");
        let result = restore();
        if result.is_ok() {
            self.rollback_succeeded += 1;
        }
        self.log(if result.is_ok() {
            "rollback_succeeded"
        } else {
            "rollback_failed"
        });
        result
    }

    pub(crate) fn commit(&mut self) {
        self.committed = true;
        self.stage = "committed";
    }

    fn log(&self, event: &'static str) {
        let line = format!("[Keychain] op={} action=write kind={} layout={} event={} stage={} planned={} attempted={} written={} failed={} not_attempted={} committed={} rollback_attempted={} rollback_succeeded={} rollback_failed={}",
            self.id, self.kind, self.layout, event, self.stage, self.planned, self.attempted, self.written, self.failed,
            self.planned.saturating_sub(self.attempted), self.committed, self.rollback_attempted, self.rollback_succeeded,
            self.rollback_attempted.saturating_sub(self.rollback_succeeded));
        emit(line);
    }
}

#[cfg(test)]
pub(crate) fn read_item<T>(
    kind: &'static str,
    layout: &'static str,
    read: impl FnOnce() -> Result<Option<T>, String>,
) -> Result<Option<T>, String> {
    let id = NEXT_OPERATION.fetch_add(1, Ordering::Relaxed);
    emit(format!("[Keychain] op={id} action=read kind={kind} layout={layout} event=read_start planned=1 completed=0"));
    let result = read();
    let (event, completed) = match &result {
        Ok(Some(_)) => ("read_found", 1),
        Ok(None) => ("read_missing", 1),
        Err(_) => ("read_failed", 0),
    };
    emit(format!("[Keychain] op={id} action=read kind={kind} layout={layout} event={event} planned=1 completed={completed}"));
    result
}

fn emit(line: String) {
    #[cfg(test)]
    LINES.with(|lines| lines.borrow_mut().push(line.clone()));
    eprintln!("{line}");
}

impl Drop for KeyringWriteProgress {
    fn drop(&mut self) {
        self.log(if self.committed { "complete" } else { "failed" });
    }
}

#[cfg(test)]
thread_local! { static LINES: std::cell::RefCell<Vec<String>> = const { std::cell::RefCell::new(vec![]) }; }
#[cfg(test)]
pub(crate) fn take_test_logs() -> Vec<String> {
    LINES.with(|lines| std::mem::take(&mut *lines.borrow_mut()))
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn logs_plan_before_io_and_success_afterward_without_formatting_secrets() {
        take_test_logs();
        {
            let mut progress = KeyringWriteProgress::new("fixture", "native", 1);
            progress
                .write_item("record", || {
                    let pending = take_test_logs();
                    assert!(pending[0].contains("event=start") && pending[0].contains("planned=1"));
                    assert!(
                        pending[1].contains("event=item_start") && pending[1].contains("written=0")
                    );
                    Ok(())
                })
                .unwrap();
            progress.commit();
        }
        let logs = take_test_logs();
        assert!(logs[0].contains("event=item_written") && logs[0].contains("written=1"));
        assert!(logs[1].contains("event=complete") && logs[1].contains("committed=true"));
    }
    #[test]
    fn failures_keep_successful_write_counts_distinct_from_commit_and_rollback() {
        take_test_logs();
        {
            let mut progress = KeyringWriteProgress::new("fixture", "chunked", 3);
            progress.write_item("chunk", || Ok(())).unwrap();
            assert!(progress
                .write_item("chunk", || Err("private-token-error".into()))
                .is_err());
            progress.rollback_item(|| Ok(())).unwrap();
            assert!(progress
                .rollback_item(|| Err("private-password".into()))
                .is_err());
        }
        let logs = take_test_logs();
        let last = logs.last().unwrap();
        for expected in [
            "event=failed",
            "planned=3",
            "attempted=2",
            "written=1",
            "failed=1",
            "not_attempted=1",
            "committed=false",
            "rollback_attempted=2",
            "rollback_succeeded=1",
            "rollback_failed=1",
        ] {
            assert!(last.contains(expected), "{expected}");
        }
        assert!(logs.iter().all(|line| !line.contains("private-")));
    }

    #[test]
    fn reads_report_progress_without_formatting_values_or_errors() {
        take_test_logs();
        assert_eq!(
            read_item("fixture", "native", || Ok(Some("private-token"))).unwrap(),
            Some("private-token")
        );
        assert!(
            read_item::<String>("fixture", "native", || Err("private-password".into())).is_err()
        );
        let logs = take_test_logs();
        assert!(logs[0].contains("event=read_start") && logs[0].contains("completed=0"));
        assert!(logs[1].contains("event=read_found") && logs[1].contains("completed=1"));
        assert!(logs[3].contains("event=read_failed"));
        assert!(logs.iter().all(|line| !line.contains("private-")));
    }
}
