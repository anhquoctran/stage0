use super::{activity_gate::ActivityGate, InstallationLease, OperationLease};
use std::sync::Arc;

#[test]
fn installation_and_active_work_are_mutually_exclusive() {
    let gate = Arc::new(ActivityGate::default());
    let first = OperationLease::on(Arc::clone(&gate)).unwrap();
    let second = OperationLease::on(Arc::clone(&gate)).unwrap();
    assert!(InstallationLease::on(Arc::clone(&gate)).is_err());
    drop(first);
    assert!(InstallationLease::on(Arc::clone(&gate)).is_err());
    drop(second);
    let install = InstallationLease::on(Arc::clone(&gate)).unwrap();
    assert!(OperationLease::on(Arc::clone(&gate)).is_err());
    assert!(InstallationLease::on(Arc::clone(&gate)).is_err());
    drop(install);
    assert!(OperationLease::on(gate).is_ok());
}

#[test]
fn racing_work_and_installation_cannot_both_acquire() {
    for _ in 0..32 {
        let gate = Arc::new(ActivityGate::default());
        let barrier = Arc::new(std::sync::Barrier::new(2));
        let worker_gate = Arc::clone(&gate);
        let worker_barrier = Arc::clone(&barrier);
        let worker = std::thread::spawn(move || {
            let lease = OperationLease::on(worker_gate);
            worker_barrier.wait();
            worker_barrier.wait();
            lease.is_ok()
        });
        let install = InstallationLease::on(gate);
        barrier.wait();
        barrier.wait();
        let acquired_work = worker.join().unwrap();
        assert!(!(install.is_ok() && acquired_work));
    }
}
