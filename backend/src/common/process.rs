use std::io::Read;
use std::process::{Child, Command, ExitStatus, Stdio};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::{Duration, Instant};

#[derive(Debug)]
pub struct BoundedOutput {
    pub stdout: Vec<u8>,
    pub stderr: Vec<u8>,
    pub status: ExitStatus,
    pub output_truncated: bool,
}

/// Run a child process while draining both pipes concurrently, keeping only a
/// bounded prefix, and stopping the process tree on output overflow or timeout.
pub fn run_bounded_command(
    command: &mut Command,
    stdout_limit: usize,
    stderr_limit: usize,
    timeout: Duration,
) -> Result<BoundedOutput, String> {
    run_bounded_command_inner(command, None, None, stdout_limit, stderr_limit, timeout)
}

/// Observe stderr as it arrives without changing process lifetime, output caps,
/// timeout handling or platform-specific process-tree cleanup.
pub fn run_bounded_command_with_progress(
    command: &mut Command,
    observer: Arc<dyn Fn(&[u8]) + Send + Sync>,
    stdout_limit: usize,
    stderr_limit: usize,
    timeout: Duration,
) -> Result<BoundedOutput, String> {
    run_bounded_command_inner(
        command,
        None,
        Some(observer),
        stdout_limit,
        stderr_limit,
        timeout,
    )
}

pub fn run_bounded_command_with_input(
    command: &mut Command,
    input: Vec<u8>,
    stdout_limit: usize,
    stderr_limit: usize,
    timeout: Duration,
) -> Result<BoundedOutput, String> {
    run_bounded_command_inner(
        command,
        Some(input),
        None,
        stdout_limit,
        stderr_limit,
        timeout,
    )
}

fn run_bounded_command_inner(
    command: &mut Command,
    input: Option<Vec<u8>>,
    observer: Option<Arc<dyn Fn(&[u8]) + Send + Sync>>,
    stdout_limit: usize,
    stderr_limit: usize,
    timeout: Duration,
) -> Result<BoundedOutput, String> {
    command
        .stdin(if input.is_some() {
            Stdio::piped()
        } else {
            Stdio::null()
        })
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());
    configure_process_group(command);

    let mut child = command
        .spawn()
        .map_err(|error| format!("Failed to start subprocess: {}", error))?;

    let output_truncated = Arc::new(AtomicBool::new(false));
    let stdout_bytes = Arc::new(Mutex::new(Vec::new()));
    let stderr_bytes = Arc::new(Mutex::new(Vec::new()));

    let stdout_task = drain_capped_output(
        child.stdout.take().expect("stdout is piped"),
        stdout_bytes.clone(),
        stdout_limit,
        output_truncated.clone(),
        None,
    );
    let stderr_task = drain_capped_output(
        child.stderr.take().expect("stderr is piped"),
        stderr_bytes.clone(),
        stderr_limit,
        output_truncated.clone(),
        observer,
    );
    let stdin_task = input.map(|input| {
        let mut stdin = child
            .stdin
            .take()
            .expect("stdin is piped when input exists");
        thread::spawn(move || {
            use std::io::Write;
            stdin.write_all(&input)
        })
    });

    let deadline = Instant::now() + timeout;
    let (status, exceeded_before_exit) = loop {
        if output_truncated.load(Ordering::Relaxed) {
            kill_process_tree(&mut child);
            let status = child.wait().map_err(|error| {
                format!("Failed to stop subprocess after output limit: {}", error)
            })?;
            break (status, true);
        }

        if Instant::now() >= deadline {
            kill_process_tree(&mut child);
            let _ = child.wait();
            // Process trees are stopped before detaching readers, so a helper
            // inheriting a pipe cannot keep this IPC call blocked indefinitely.
            drop(stdout_task);
            drop(stderr_task);
            drop(stdin_task);
            return Err(format!(
                "Subprocess timed out after {} seconds",
                timeout.as_secs()
            ));
        }

        match child.try_wait() {
            Ok(Some(status)) => break (status, false),
            Ok(None) => thread::sleep(Duration::from_millis(10)),
            Err(error) => {
                kill_process_tree(&mut child);
                let _ = child.wait();
                drop(stdout_task);
                drop(stderr_task);
                drop(stdin_task);
                return Err(format!("Failed while waiting for subprocess: {}", error));
            }
        }
    };

    let mut input_write_error = None;
    if !exceeded_before_exit {
        // A child can exit while a daemonized descendant still holds an
        // inherited pipe open. Never join pipe readers without a deadline.
        let drain_deadline = Instant::now() + Duration::from_millis(250);
        while (!stdout_task.is_finished()
            || !stderr_task.is_finished()
            || stdin_task.as_ref().is_some_and(|task| !task.is_finished()))
            && Instant::now() < drain_deadline
        {
            thread::sleep(Duration::from_millis(10));
        }

        if !stdout_task.is_finished()
            || !stderr_task.is_finished()
            || stdin_task.as_ref().is_some_and(|task| !task.is_finished())
        {
            // Stop any child that outlived the command and inherited a pipe.
            // This is process-group based on Unix and best-effort taskkill on
            // Windows; reader threads are still detached after the grace cap.
            kill_process_tree(&mut child);
        }

        let settle_deadline = Instant::now() + Duration::from_millis(500);
        while (!stdout_task.is_finished()
            || !stderr_task.is_finished()
            || stdin_task.as_ref().is_some_and(|task| !task.is_finished()))
            && Instant::now() < settle_deadline
        {
            thread::sleep(Duration::from_millis(10));
        }

        if stdout_task.is_finished() {
            let _ = stdout_task.join();
        } else {
            drop(stdout_task);
        }
        if stderr_task.is_finished() {
            let _ = stderr_task.join();
        } else {
            drop(stderr_task);
        }
        if let Some(stdin_task) = stdin_task {
            if stdin_task.is_finished() {
                match stdin_task.join() {
                    Ok(Ok(())) => {}
                    Ok(Err(error)) => input_write_error = Some(error.to_string()),
                    Err(_) => input_write_error = Some("input writer thread failed".to_string()),
                }
            } else {
                input_write_error = Some("subprocess exited before all input was sent".to_string());
                drop(stdin_task);
            }
        }
    } else {
        drop(stdout_task);
        drop(stderr_task);
        drop(stdin_task);
    }

    let output_truncated = output_truncated.load(Ordering::Relaxed);
    let stdout = {
        let mut captured = stdout_bytes
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner());
        std::mem::take(&mut *captured)
    };
    let stderr = stderr_bytes
        .lock()
        .unwrap_or_else(|poisoned| poisoned.into_inner())
        .clone();

    if status.success() {
        if let Some(error) = input_write_error {
            return Err(format!("Failed to send input to subprocess: {}", error));
        }
    }

    Ok(BoundedOutput {
        stdout,
        stderr,
        status,
        output_truncated,
    })
}

fn drain_capped_output<R: Read + Send + 'static>(
    mut reader: R,
    captured: Arc<Mutex<Vec<u8>>>,
    limit: usize,
    exceeded: Arc<AtomicBool>,
    observer: Option<Arc<dyn Fn(&[u8]) + Send + Sync>>,
) -> thread::JoinHandle<()> {
    thread::spawn(move || {
        let mut chunk = [0u8; 8192];
        loop {
            let read = match reader.read(&mut chunk) {
                Ok(0) | Err(_) => break,
                Ok(read) => read,
            };
            let mut output = captured
                .lock()
                .unwrap_or_else(|poisoned| poisoned.into_inner());
            let remaining = limit.saturating_sub(output.len());
            let keep = read.min(remaining);
            output.extend_from_slice(&chunk[..keep]);
            if keep < read {
                exceeded.store(true, Ordering::Relaxed);
            }
            drop(output);
            if let Some(observer) = &observer {
                observer(&chunk[..keep]);
            }
        }
    })
}

#[cfg(unix)]
fn configure_process_group(command: &mut Command) {
    use std::os::unix::process::CommandExt;
    command.process_group(0);
}

#[cfg(windows)]
fn configure_process_group(command: &mut Command) {
    use std::os::windows::process::CommandExt;
    const CREATE_NO_WINDOW: u32 = 0x08000000;
    const CREATE_NEW_PROCESS_GROUP: u32 = 0x00000200;
    command.creation_flags(CREATE_NO_WINDOW | CREATE_NEW_PROCESS_GROUP);
}

#[cfg(not(any(unix, windows)))]
fn configure_process_group(_command: &mut Command) {}

#[cfg(unix)]
fn kill_process_tree(child: &mut Child) {
    unsafe extern "C" {
        fn kill(pid: i32, signal: i32) -> i32;
    }
    const SIGKILL: i32 = 9;
    let process_group = -(child.id() as i32);
    // SAFETY: sending SIGKILL to the child's dedicated process group does not
    // dereference memory and is followed by Child::wait by the caller.
    let _ = unsafe { kill(process_group, SIGKILL) };
    let _ = child.kill();
}

#[cfg(windows)]
fn kill_process_tree(child: &mut Child) {
    let pid = child.id().to_string();
    let _ = Command::new("taskkill.exe")
        .args(["/PID", &pid, "/T", "/F"])
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .status();
    let _ = child.kill();
}

#[cfg(not(any(unix, windows)))]
fn kill_process_tree(child: &mut Child) {
    let _ = child.kill();
}

#[cfg(test)]
mod tests {
    use super::*;

    #[cfg(unix)]
    #[test]
    fn observes_progress_before_process_completes() {
        let (sender, receiver) = std::sync::mpsc::channel();
        let worker = thread::spawn(move || {
            let mut command = Command::new("sh");
            command.args(["-c", "printf 'Receiving objects: 50%%\\r' >&2; sleep 1"]);
            run_bounded_command_with_progress(
                &mut command,
                Arc::new(move |bytes| {
                    let _ = sender.send(bytes.to_vec());
                }),
                1024,
                1024,
                Duration::from_secs(3),
            )
            .unwrap()
        });
        let progress = receiver.recv_timeout(Duration::from_millis(750)).unwrap();
        assert!(String::from_utf8_lossy(&progress).contains("50%"));
        assert!(!worker.is_finished());
        assert!(worker.join().unwrap().status.success());
    }

    #[cfg(unix)]
    #[test]
    fn bounds_output_and_kills_process_tree() {
        let mut command = Command::new("sh");
        command.args(["-c", "printf 'abcdef'; sleep 10"]);
        let started = Instant::now();
        let output = run_bounded_command(&mut command, 3, 1024, Duration::from_secs(2)).unwrap();
        assert!(output.output_truncated);
        assert_eq!(output.stdout, b"abc");
        assert!(started.elapsed() < Duration::from_secs(2));
    }

    #[cfg(unix)]
    #[test]
    fn times_out_and_stops_descendants() {
        let mut command = Command::new("sh");
        command.args(["-c", "sleep 10 & wait"]);
        let started = Instant::now();
        let error =
            run_bounded_command(&mut command, 1024, 1024, Duration::from_millis(50)).unwrap_err();
        assert!(error.contains("timed out"));
        assert!(started.elapsed() < Duration::from_secs(2));
    }

    #[cfg(unix)]
    #[test]
    fn does_not_wait_for_descendants_holding_pipes_after_parent_exits() {
        let mut command = Command::new("sh");
        command.args(["-c", "sleep 10 & exit 0"]);
        let started = Instant::now();
        let output = run_bounded_command(&mut command, 1024, 1024, Duration::from_secs(3)).unwrap();
        assert!(output.status.success());
        assert!(started.elapsed() < Duration::from_secs(2));
    }

    #[cfg(unix)]
    #[test]
    fn streams_bounded_input_without_losing_bytes() {
        let mut command = Command::new("sh");
        command.args(["-c", "cat"]);
        let output = run_bounded_command_with_input(
            &mut command,
            b"patch bytes".to_vec(),
            1024,
            1024,
            Duration::from_secs(2),
        )
        .unwrap();
        assert!(output.status.success());
        assert_eq!(output.stdout, b"patch bytes");
    }
}
