use super::GitOperationProgress;
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};
use tauri::ipc::Channel;

/// Buffers CR/LF-delimited Git progress records before sanitizing and sending
/// them. The channel belongs to one invocation/window; closing its dialog never
/// interrupts the process, and a detached webview does not fail the operation.
pub struct GitProgressReporter {
    channel: Option<Channel<GitOperationProgress>>,
    buffer: Mutex<(Vec<u8>, bool)>,
    last_sent: Mutex<Option<(Instant, String)>>,
}

impl GitProgressReporter {
    pub fn new(channel: Option<Channel<GitOperationProgress>>) -> Arc<Self> {
        Arc::new(Self {
            channel,
            buffer: Mutex::new((Vec::new(), false)),
            last_sent: Mutex::new(None),
        })
    }

    pub fn observer(self: &Arc<Self>) -> Arc<dyn Fn(&[u8]) + Send + Sync> {
        let reporter = Arc::clone(self);
        Arc::new(move |bytes| reporter.consume(bytes))
    }

    fn consume(&self, bytes: &[u8]) {
        if self.channel.is_none() {
            return;
        }
        let mut buffer = self
            .buffer
            .lock()
            .unwrap_or_else(|error| error.into_inner());
        for byte in bytes {
            if matches!(byte, b'\r' | b'\n') {
                if !buffer.1 {
                    self.report_line(&String::from_utf8_lossy(&buffer.0));
                }
                buffer.0.clear();
                buffer.1 = false;
            } else if buffer.0.len() < 8192 {
                buffer.0.push(*byte);
            } else {
                // Never emit partial lines that could split a credential.
                buffer.1 = true;
            }
        }
    }

    fn report_line(&self, line: &str) {
        let Some(progress) = parse_git_progress(line) else {
            return;
        };
        let mut last = self
            .last_sent
            .lock()
            .unwrap_or_else(|error| error.into_inner());
        if let Some((sent_at, phase)) = &*last {
            if phase == &progress.phase
                && sent_at.elapsed() < Duration::from_millis(100)
                && progress.percent != Some(100.0)
            {
                return;
            }
        }
        *last = Some((Instant::now(), progress.phase.clone()));
        if let Some(channel) = &self.channel {
            let _ = channel.send(progress);
        }
    }
}

fn parse_git_progress(line: &str) -> Option<GitOperationProgress> {
    let message = crate::features::git::runner::redact_sensitive_text(line.trim());
    if message.is_empty() {
        return None;
    }
    let body = message.strip_prefix("remote: ").unwrap_or(&message);
    let percent = body.find('%').and_then(|end| {
        let digits = body[..end]
            .rsplit(|character: char| !character.is_ascii_digit())
            .next()?;
        let percent = digits.parse::<f64>().ok()?;
        (0.0..=100.0).contains(&percent).then_some(percent)
    });
    let (phase, percent) = if let Some(count) = body.strip_prefix("Rebasing (") {
        let (current, total) = count.split_once('/')?;
        let total = total.split_once(')')?.0.parse::<f64>().ok()?;
        let current = current.parse::<f64>().ok()?;
        (
            "Rebasing commits".to_string(),
            (total > 0.0).then(|| (current / total * 100.0).clamp(0.0, 100.0)),
        )
    } else {
        (
            if percent.is_some() {
                body.split(':')
                    .next()
                    .unwrap_or("Working")
                    .trim()
                    .to_string()
            } else {
                "Working".to_string()
            },
            percent,
        )
    };
    Some(GitOperationProgress {
        phase,
        percent,
        message,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_real_git_percentages_and_rebase_counts() {
        let progress = parse_git_progress("remote: Receiving objects:  45% (45/100)").unwrap();
        assert_eq!(progress.phase, "Receiving objects");
        assert_eq!(progress.percent, Some(45.0));
        assert_eq!(
            parse_git_progress("Rebasing (2/8)").unwrap().percent,
            Some(25.0)
        );
        assert_eq!(parse_git_progress("Rebasing (0/0)").unwrap().percent, None);
        assert_eq!(parse_git_progress("Updating branch").unwrap().percent, None);
    }

    #[test]
    fn redacts_credentials_before_publishing_progress() {
        let progress = parse_git_progress("fatal: https://user:secret@example.test/repo").unwrap();
        assert!(!progress.message.contains("secret"));
        assert!(progress.message.contains("[REDACTED]"));
    }

    #[test]
    fn streams_split_carriage_return_records_and_suppresses_oversized_lines() {
        let records = Arc::new(Mutex::new(Vec::new()));
        let captured = Arc::clone(&records);
        let channel = Channel::new(move |body| {
            captured.lock().unwrap().push(body);
            Ok(())
        });
        let reporter = GitProgressReporter::new(Some(channel));
        reporter.consume(b"Receiving obj");
        reporter.consume(b"ects: 100% (2/2)\rResolving deltas: 100% (1/1)\n");
        assert_eq!(records.lock().unwrap().len(), 2);
        reporter.consume(&vec![b'x'; 9000]);
        reporter.consume(b"\n");
        assert_eq!(records.lock().unwrap().len(), 2);
    }
}
