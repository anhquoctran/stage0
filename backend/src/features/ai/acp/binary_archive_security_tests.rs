use super::*;
use base64::Engine;
use std::io::{Cursor, Write};

fn extract_fixture(bytes: &[u8], command: &str) -> (tempfile::TempDir, Result<(), String>) {
    let directory = tempfile::tempdir().unwrap();
    let archive = directory.path().join("payload.zip");
    let destination = directory.path().join("out");
    fs::write(&archive, bytes).unwrap();
    fs::create_dir(&destination).unwrap();
    let result = extract(
        &archive,
        &destination,
        ArchiveFormat::Zip,
        Path::new(command),
        "linux-x86_64",
    );
    (directory, result)
}

#[test]
fn rejects_zip_cloaking_with_different_local_and_central_filenames() {
    let mut writer = zip::ZipWriter::new(Cursor::new(Vec::new()));
    writer
        .start_file("bin/agent", zip::write::SimpleFileOptions::default())
        .unwrap();
    writer.write_all(b"untrusted executable").unwrap();
    let mut bytes = writer.finish().unwrap().into_inner();
    // GHSA-m665-v7pm-7grj: preserve the central directory's safe-looking name
    // while changing the local header used by a different extraction parser.
    assert_eq!(&bytes[..4], b"PK\x03\x04");
    assert_eq!(&bytes[30..39], b"bin/agent");
    bytes[30..39].copy_from_slice(b"bin/other");
    let (directory, result) = extract_fixture(&bytes, "bin/agent");
    assert!(result.is_err(), "mismatched ZIP headers must fail closed");
    assert_eq!(
        fs::read_dir(directory.path().join("out")).unwrap().count(),
        0
    );
}

#[test]
fn refuses_huge_zip_symlink_target_before_allocation_or_write() {
    // Minimal ZIP64 symlink fixture from GHSA-q7v9-x93c-xqv3. Its central
    // directory claims a 2^62-byte symlink target in a 112-byte archive.
    let bytes = base64::engine::general_purpose::STANDARD
        .decode(concat!(
            "UEsDBC0AAAAAAAAAAAAAAAAAAAAAAP////8BAAAAYVBLAQItAy0AAAAAAAAAAAAAAAAAAAAAAP//",
            "//8BAAwAAAAAAAAAAAD/oQAAAABhAQAIAAAAAAAAAABAUEsFBgAAAAABAAEAOwAAAB8AAAAAAA=="
        ))
        .unwrap();
    assert_eq!(bytes.len(), 112);
    let mut archive = zip::ZipArchive::new(Cursor::new(&bytes)).unwrap();
    let entry = archive.by_index(0).unwrap();
    assert!(entry.is_symlink());
    assert_eq!(entry.size(), 1_u64 << 62);
    let (directory, result) = extract_fixture(&bytes, "a");
    assert!(result.is_err());
    assert_eq!(
        fs::read_dir(directory.path().join("out")).unwrap().count(),
        0
    );
}
