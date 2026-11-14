use super::storage::atomic_write;
use std::fs::{self, File};
use std::io::Read;

#[test]
fn atomic_replacement_keeps_open_readers_on_their_original_snapshot() {
    let directory = tempfile::tempdir().unwrap();
    let path = directory.path().join("settings.json");
    atomic_write(&path, b"original snapshot").unwrap();
    let mut original_reader = File::open(&path).unwrap();
    atomic_write(&path, b"second snapshot").unwrap();
    let mut second_reader = File::open(&path).unwrap();
    atomic_write(&path, b"final snapshot").unwrap();
    let mut original = String::new();
    let mut second = String::new();
    original_reader.read_to_string(&mut original).unwrap();
    second_reader.read_to_string(&mut second).unwrap();
    assert_eq!(original, "original snapshot");
    assert_eq!(second, "second snapshot");
    assert_eq!(fs::read_to_string(&path).unwrap(), "final snapshot");
    assert_eq!(
        fs::read_dir(directory.path()).unwrap().count(),
        1,
        "Successful replacement must not leave temporary files or locks"
    );
}
