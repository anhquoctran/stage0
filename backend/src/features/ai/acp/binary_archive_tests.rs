use super::*;
use std::io::{Cursor, Write};

fn zip_fixture(name: &str, content: &[u8], mode: u32) -> Vec<u8> {
    let mut zip = zip::ZipWriter::new(Cursor::new(Vec::new()));
    zip.start_file(
        name,
        zip::write::SimpleFileOptions::default().unix_permissions(mode),
    )
    .unwrap();
    zip.write_all(content).unwrap();
    zip.finish().unwrap().into_inner()
}

fn tar_fixture(name: &str, content: &[u8], link: Option<(&str, bool)>) -> Vec<u8> {
    let mut tar = tar::Builder::new(Vec::new());
    let mut header = tar::Header::new_gnu();
    // Assign raw bytes to allow malicious traversal fixtures too.
    header.as_mut_bytes()[..name.len()].copy_from_slice(name.as_bytes());
    header.set_mode(0o6755);
    if let Some((target, hard)) = link {
        header.set_size(0);
        header.set_entry_type(if hard {
            tar::EntryType::Link
        } else {
            tar::EntryType::Symlink
        });
        header.set_link_name(target).unwrap();
    } else {
        header.set_size(content.len() as u64);
    }
    header.set_cksum();
    tar.append(&header, content).unwrap();
    tar.into_inner().unwrap()
}

fn packed_tar(tar: &[u8], format: ArchiveFormat) -> Vec<u8> {
    if format == ArchiveFormat::TarGz {
        let mut encoder = flate2::write::GzEncoder::new(Vec::new(), flate2::Compression::default());
        encoder.write_all(tar).unwrap();
        encoder.finish().unwrap()
    } else {
        let mut encoder = bzip2::write::BzEncoder::new(Vec::new(), bzip2::Compression::default());
        encoder.write_all(tar).unwrap();
        encoder.finish().unwrap()
    }
}

fn unpack(
    bytes: &[u8],
    format: ArchiveFormat,
    command: &str,
    target: &str,
) -> (tempfile::TempDir, Result<(), String>) {
    let fixture = tempfile::tempdir().unwrap();
    let archive = fixture.path().join("download");
    fs::write(&archive, bytes).unwrap();
    let destination = fixture.path().join("out");
    fs::create_dir(&destination).unwrap();
    let result = extract(&archive, &destination, format, Path::new(command), target);
    (fixture, result)
}

#[test]
fn zip_par_and_all_tar_formats_extract_nested_executables_with_safe_permissions() {
    for format in [
        ArchiveFormat::Zip,
        ArchiveFormat::TarGz,
        ArchiveFormat::TarBz2,
    ] {
        let content = b"fixture executable";
        let bytes = if format == ArchiveFormat::Zip {
            zip_fixture("bin/agy_acp_server.par", content, 0o644)
        } else {
            packed_tar(
                &tar_fixture("./bin/agy_acp_server.par", content, None),
                format,
            )
        };
        let (fixture, result) = unpack(&bytes, format, "bin/agy_acp_server.par", "darwin-aarch64");
        result.unwrap();
        let executable = fixture.path().join("out/bin/agy_acp_server.par");
        assert_eq!(fs::read(&executable).unwrap(), content);
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            assert_eq!(
                fs::metadata(executable).unwrap().permissions().mode() & 0o7777,
                0o755
            );
        }
    }
}

#[test]
fn recognizes_all_registry_formats_and_refuses_installers_or_insecure_urls() {
    for (suffix, expected) in [
        (".zip", ArchiveFormat::Zip),
        (".tar.gz", ArchiveFormat::TarGz),
        (".tgz", ArchiveFormat::TarGz),
        (".tar.bz2", ArchiveFormat::TarBz2),
        (".tbz2", ArchiveFormat::TarBz2),
        (".exe", ArchiveFormat::Raw),
        ("", ArchiveFormat::Raw),
    ] {
        assert_eq!(
            ArchiveFormat::from_url(&format!("https://example.com/agent{suffix}?version=1"))
                .unwrap(),
            expected
        );
    }
    for url in [
        "http://example.com/a.zip",
        "https://user:pass@example.com/a.zip",
        "https://example.com/a.dmg",
        "https://example.com/a.pkg",
        "https://example.com/a.deb",
        "https://example.com/a.rpm",
        "https://example.com/a.msi",
        "https://example.com/a.appimage",
    ] {
        assert!(ArchiveFormat::from_url(url).is_err(), "{url}");
    }
}

#[test]
fn raw_binaries_support_all_three_oses_but_not_error_pages_or_install_scripts() {
    for (target, bytes) in [
        ("windows-aarch64", b"MZfixture".as_slice()),
        ("linux-x86_64", b"\x7fELFfixture".as_slice()),
        ("darwin-x86_64", b"\xcf\xfa\xed\xfefixture".as_slice()),
    ] {
        let (fixture, result) = unpack(bytes, ArchiveFormat::Raw, "bin/agent", target);
        result.unwrap();
        assert_eq!(
            fs::read(fixture.path().join("out/bin/agent")).unwrap(),
            bytes
        );
    }
    for bytes in [
        b"<html>not found".as_slice(),
        b"#!/bin/sh\necho installer".as_slice(),
    ] {
        assert!(unpack(bytes, ArchiveFormat::Raw, "agent", "linux-x86_64")
            .1
            .is_err());
    }
}

#[test]
fn zip_and_tar_paths_cannot_escape_staging_or_use_windows_device_names() {
    for path in [
        "../outside",
        "/absolute",
        "C:/outside",
        "dir/../../outside",
        "NUL",
        "dir/file:stream",
        "..\\outside",
    ] {
        for format in [
            ArchiveFormat::Zip,
            ArchiveFormat::TarGz,
            ArchiveFormat::TarBz2,
        ] {
            let bytes = if format == ArchiveFormat::Zip {
                zip_fixture(path, b"bad", 0o644)
            } else {
                packed_tar(&tar_fixture(path, b"bad", None), format)
            };
            assert!(
                unpack(&bytes, format, "agent", "linux-aarch64").1.is_err(),
                "{path} {format:?}"
            );
        }
    }
}

#[test]
fn internal_file_links_work_but_escape_missing_and_cyclic_links_are_rejected() {
    for hard in [false, true] {
        let mut tar = tar_fixture("real", b"fixture executable", None);
        // Remove the end-of-archive padding before concatenating the link.
        tar.truncate(1024);
        tar.extend(tar_fixture("agent", b"", Some(("real", hard))));
        let (fixture, result) = unpack(
            &packed_tar(&tar, ArchiveFormat::TarGz),
            ArchiveFormat::TarGz,
            "agent",
            "linux-aarch64",
        );
        result.unwrap();
        assert_eq!(
            fs::read(fixture.path().join("out/agent")).unwrap(),
            b"fixture executable"
        );
    }
    for target in ["../outside", "/outside", "C:/outside", "missing", "agent"] {
        let bytes = packed_tar(
            &tar_fixture("agent", b"", Some((target, false))),
            ArchiveFormat::TarGz,
        );
        assert!(
            unpack(&bytes, ArchiveFormat::TarGz, "agent", "linux-aarch64")
                .1
                .is_err(),
            "{target}"
        );
    }
}

#[test]
fn expansion_limits_duplicates_and_missing_executables_fail_closed() {
    let fixture = tempfile::tempdir().unwrap();
    let mut remaining = 3;
    assert!(write_file(
        &mut Cursor::new(b"four"),
        fixture.path(),
        Path::new("a"),
        0o644,
        &mut remaining
    )
    .is_err());
    let mut remaining = 10;
    assert!(write_file(
        &mut Cursor::new(b"again"),
        fixture.path(),
        Path::new("a"),
        0o644,
        &mut remaining
    )
    .is_err());
    assert!(unpack(
        &zip_fixture("other", b"data", 0o644),
        ArchiveFormat::Zip,
        "agent",
        "linux-x86_64"
    )
    .1
    .is_err());
    assert!(
        unpack(b"corrupt", ArchiveFormat::Zip, "agent", "linux-x86_64")
            .1
            .is_err()
    );
}

#[test]
fn zip_links_are_confined_and_internal_directory_aliases_are_portable() {
    for target in ["real", "../outside", "/outside", "missing"] {
        let mut zip = zip::ZipWriter::new(Cursor::new(Vec::new()));
        let options = zip::write::SimpleFileOptions::default();
        zip.start_file("real", options).unwrap();
        zip.write_all(b"fixture").unwrap();
        zip.add_symlink("agent", target, options).unwrap();
        let (fixture, result) = unpack(
            &zip.finish().unwrap().into_inner(),
            ArchiveFormat::Zip,
            "agent",
            "linux-x86_64",
        );
        if target == "real" {
            result.unwrap();
            assert_eq!(
                fs::read(fixture.path().join("out/agent")).unwrap(),
                b"fixture"
            );
            assert!(!fs::symlink_metadata(fixture.path().join("out/agent"))
                .unwrap()
                .file_type()
                .is_symlink());
        } else {
            assert!(result.is_err(), "{target}");
        }
    }
    let fixture = tempfile::tempdir().unwrap();
    fs::create_dir_all(fixture.path().join("real/bin")).unwrap();
    fs::write(fixture.path().join("real/bin/agent"), b"fixture").unwrap();
    let mut remaining = 100;
    materialize_links(
        fixture.path(),
        vec![("aliases/copy".into(), "../real".into(), false)],
        &mut remaining,
    )
    .unwrap();
    assert_eq!(
        fs::read(fixture.path().join("aliases/copy/bin/agent")).unwrap(),
        b"fixture"
    );
}

#[test]
fn corrupt_compression_trailers_fail_instead_of_installing_partial_files() {
    for format in [ArchiveFormat::TarGz, ArchiveFormat::TarBz2] {
        let mut bytes = packed_tar(&tar_fixture("agent", b"fixture", None), format);
        // Remove the compressor trailer, leaving the TAR payload itself intact.
        bytes.truncate(bytes.len() - 6);
        assert!(
            unpack(&bytes, format, "agent", "linux-x86_64").1.is_err(),
            "{format:?}"
        );
    }
}

#[test]
fn archives_with_excessive_file_counts_are_rejected() {
    let mut zip = zip::ZipWriter::new(Cursor::new(Vec::new()));
    for index in 0..=MAX_ENTRIES {
        zip.start_file(
            format!("file-{index}"),
            zip::write::SimpleFileOptions::default(),
        )
        .unwrap();
    }
    let (_, result) = unpack(
        &zip.finish().unwrap().into_inner(),
        ArchiveFormat::Zip,
        "agent",
        "linux-x86_64",
    );
    assert!(result.unwrap_err().contains("too many entries"));
}

#[cfg(unix)]
#[test]
fn an_installed_par_launcher_runs_directly_without_shell_interpretation() {
    let bytes = zip_fixture(
        "agy_acp_server.par",
        b"#!/bin/sh\nprintf '%s' \"$1\"\n",
        0o644,
    );
    let (fixture, result) = unpack(
        &bytes,
        ArchiveFormat::Zip,
        "agy_acp_server.par",
        "darwin-aarch64",
    );
    result.unwrap();
    let config = super::super::AcpAgentConfig {
        id: "fixture".into(),
        name: "Fixture".into(),
        version: None,
        description: None,
        source: "registry".into(),
        launch_mode: Some("binary".into()),
        command: fixture
            .path()
            .join("out/agy_acp_server.par")
            .to_string_lossy()
            .into_owned(),
        args: vec!["literal ; & $(not-a-command)".into()],
    };
    super::super::validate_config(&config).unwrap();
    let mut command = super::super::make_command(&config, Some(fixture.path()));
    let output = command.as_std_mut().output().unwrap();
    assert!(output.status.success());
    assert_eq!(output.stdout, b"literal ; & $(not-a-command)");
}
