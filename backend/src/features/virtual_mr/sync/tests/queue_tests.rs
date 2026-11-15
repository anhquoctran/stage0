use super::super::queue::SyncQueue;
use std::collections::HashSet;

#[test]
fn queue_coalesces_storms_without_starving_other_repositories_or_losing_inflight_changes() {
    let mut q = SyncQueue::default();
    let mut active = HashSet::new();
    for n in 0..1000 {
        q.mark("busy".into(), n);
    }
    q.mark("other".into(), 0);
    assert_eq!(q.take(1000, &active), Some("other".into()));
    assert_eq!(q.take(1700, &active), None);
    assert_eq!(q.take(1749, &active), Some("busy".into()));
    active.insert("busy".into());
    q.mark("busy".into(), 1750);
    assert_eq!(q.take(3000, &active), None);
    active.clear();
    assert_eq!(q.take(3000, &active), Some("busy".into()));
    for n in 0..3000 {
        q.mark("busy".into(), n);
    }
    assert_eq!(q.take(3000, &active), Some("busy".into()));
}

#[test]
fn foreground_priority_and_backoff_are_bounded_and_removed_repositories_are_forgotten() {
    let mut queue = SyncQueue::default();
    for n in 0..1000 {
        queue.mark(format!("repo-{n}"), 0);
    }
    queue.prioritize("focused".into(), 0);
    assert_eq!(queue.take(750, &HashSet::new()), Some("focused".into()));
    queue.retain(&HashSet::from(["repo-999".into()]));
    assert_eq!(queue.take(750, &HashSet::new()), Some("repo-999".into()));
    assert_eq!(queue.take(10_000, &HashSet::new()), None);
    let mut subscription = super::super::subscription::Subscription::new(0);
    subscription.schedule(0, false, 0);
    assert_eq!(subscription.next_poll, 10_000);
    for _ in 0..100 {
        subscription.schedule(0, false, 0);
    }
    assert_eq!(subscription.next_poll, 300_000);
    assert_eq!(subscription.retry_after, 300_000);
    subscription.schedule(0, true, 0);
    assert_eq!(subscription.retry_after, 0);
    assert_eq!(subscription.next_poll, 30_000);
}
