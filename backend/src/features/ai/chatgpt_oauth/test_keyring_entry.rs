//! Test-only, thread-local fake: auth tests must never touch the user's keyring.
use std::{cell::RefCell, collections::HashMap};
thread_local! {
    static VALUES: RefCell<HashMap<String, String>> = RefCell::new(HashMap::new());
    static FAIL_AFTER: RefCell<Option<usize>> = const { RefCell::new(None) };
    static READS: RefCell<usize> = const { RefCell::new(0) };
    static SILENT_READS: RefCell<usize> = const { RefCell::new(0) };
    static DENIED: RefCell<Vec<String>> = const { RefCell::new(vec![]) };
    static WINDOWS_LIMIT: RefCell<bool> = const { RefCell::new(cfg!(target_os = "windows")) };
}
pub(super) struct TestKeyringEntry {
    key: String,
}
impl TestKeyringEntry {
    pub fn new(key: &str) -> Self {
        Self { key: key.into() }
    }
    pub fn get_password(&self) -> Result<String, keyring::Error> {
        READS.with(|reads| *reads.borrow_mut() += 1);
        VALUES.with(|values| {
            values
                .borrow()
                .get(&self.key)
                .cloned()
                .ok_or(keyring::Error::NoEntry)
        })
    }
    pub fn get_password_silent(&self) -> Result<String, keyring::Error> {
        SILENT_READS.with(|reads| *reads.borrow_mut() += 1);
        if DENIED.with(|keys| keys.borrow().contains(&self.key)) {
            return Err(keyring::Error::Invalid(
                "permission".into(),
                "fixture permission denied".into(),
            ));
        }
        VALUES.with(|values| {
            values
                .borrow()
                .get(&self.key)
                .cloned()
                .ok_or(keyring::Error::NoEntry)
        })
    }
    pub fn set_password(&self, value: &str) -> Result<(), keyring::Error> {
        let fail = FAIL_AFTER.with(|remaining| {
            let mut remaining = remaining.borrow_mut();
            if let Some(count) = remaining.as_mut() {
                if *count == 0 {
                    *remaining = None;
                    return true;
                }
                *count -= 1;
            }
            false
        });
        if fail {
            return Err(keyring::Error::NoEntry);
        }
        if WINDOWS_LIMIT.with(|v| *v.borrow()) {
            assert!(
                value.encode_utf16().count() * 2 <= 2560,
                "password exceeded Windows keyring size"
            );
        }
        VALUES.with(|values| values.borrow_mut().insert(self.key.clone(), value.into()));
        Ok(())
    }
    pub fn delete_credential(&self) -> Result<(), keyring::Error> {
        if DENIED.with(|keys| keys.borrow().contains(&self.key)) {
            return Err(keyring::Error::Invalid(
                "permission".into(),
                "fixture permission denied".into(),
            ));
        }
        VALUES.with(|values| {
            values
                .borrow_mut()
                .remove(&self.key)
                .map(|_| ())
                .ok_or(keyring::Error::NoEntry)
        })
    }
    pub fn reset() {
        VALUES.with(|v| v.borrow_mut().clear());
        FAIL_AFTER.with(|v| *v.borrow_mut() = None);
        READS.with(|v| *v.borrow_mut() = 0);
        SILENT_READS.with(|v| *v.borrow_mut() = 0);
        DENIED.with(|v| v.borrow_mut().clear());
        WINDOWS_LIMIT.with(|v| *v.borrow_mut() = cfg!(target_os = "windows"));
    }
    pub fn reads() -> usize {
        READS.with(|v| *v.borrow())
    }
    pub fn windows_limit(value: bool) {
        WINDOWS_LIMIT.with(|v| *v.borrow_mut() = value);
    }
    pub fn deny(key: &str) {
        DENIED.with(|v| v.borrow_mut().push(key.into()));
    }
    pub fn silent_reads() -> usize {
        SILENT_READS.with(|v| *v.borrow())
    }
    pub fn fail_after(writes: usize) {
        FAIL_AFTER.with(|v| *v.borrow_mut() = Some(writes));
    }
    pub fn entries() -> usize {
        VALUES.with(|v| v.borrow().len())
    }
}
