use super::*;
use std::sync::mpsc;
use std::time::Duration;

#[test]
fn publication_finishes_before_the_next_writer_can_enter() {
    let (started, entered) = mpsc::channel();
    let (release, wait) = mpsc::channel();
    let (published, observed) = mpsc::channel();
    let first = std::thread::spawn(move || {
        run(|| {
            started.send(()).unwrap();
            wait.recv().unwrap();
            published.send("first published").unwrap();
            Ok(())
        })
    });
    entered.recv().unwrap();
    let (second_started, second_entered) = mpsc::channel();
    let second = std::thread::spawn(move || {
        run(|| {
            second_started.send(()).unwrap();
            Ok(())
        })
    });
    assert!(second_entered
        .recv_timeout(Duration::from_millis(50))
        .is_err());
    release.send(()).unwrap();
    assert_eq!(observed.recv().unwrap(), "first published");
    second_entered.recv_timeout(Duration::from_secs(2)).unwrap();
    first.join().unwrap().unwrap();
    second.join().unwrap().unwrap();
}

#[tokio::test]
async fn abandoning_the_caller_does_not_release_a_running_workers_lock() {
    let (started, entered) = tokio::sync::oneshot::channel();
    let (release, wait) = mpsc::channel();
    let first = tokio::spawn(run_async(move || {
        let _ = started.send(());
        wait.recv().unwrap();
        Ok(())
    }));
    entered.await.unwrap();
    first.abort();
    let (second_started, second_entered) = tokio::sync::oneshot::channel();
    let second = tokio::spawn(run_async(move || {
        let _ = second_started.send(());
        Ok(())
    }));
    let mut second_entered = second_entered;
    assert!(
        tokio::time::timeout(Duration::from_millis(50), &mut second_entered)
            .await
            .is_err()
    );
    release.send(()).unwrap();
    tokio::time::timeout(Duration::from_secs(2), second_entered)
        .await
        .unwrap()
        .unwrap();
    second.await.unwrap().unwrap();
}

#[test]
fn concurrent_real_preference_writes_publish_the_committed_order() {
    use crate::features::preferences::PreferencesManager;
    use serde_json::{json, Value};
    use std::sync::{Arc, Barrier, Mutex};

    let directory =
        std::env::temp_dir().join(format!("stage0-pref-publish-{}", uuid::Uuid::new_v4()));
    let manager = Arc::new(PreferencesManager::new(directory.clone()).unwrap());
    manager.initialize(Value::Null, None).unwrap();
    let barrier = Arc::new(Barrier::new(3));
    let published = Arc::new(Mutex::new(Vec::new()));
    let workers: Vec<_> = [false, true]
        .into_iter()
        .map(|value| {
            let manager = manager.clone();
            let barrier = barrier.clone();
            let published = published.clone();
            std::thread::spawn(move || {
                barrier.wait();
                run(|| {
                    let previous = manager.read()?;
                    let saved = manager.patch(
                        json!({"general":{"showInlineBlame":value}}),
                        previous.revision,
                    )?;
                    published.lock().unwrap().push((saved.revision, value));
                    Ok(())
                })
            })
        })
        .collect();
    barrier.wait();
    for worker in workers {
        worker.join().unwrap().unwrap();
    }
    let latest = manager.read().unwrap();
    let published = published.lock().unwrap();
    assert_eq!(published.len(), 2);
    assert_eq!(latest.revision, published[1].0);
    assert_eq!(
        latest.settings.unwrap()["general"]["showInlineBlame"],
        published[1].1
    );
    drop(published);
    std::fs::remove_dir_all(directory).unwrap();
}
