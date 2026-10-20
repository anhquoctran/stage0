use super::{archive_format::ArchiveFormat, binary_platform::safe_relative_path};
use std::{
    fs::{self, File, OpenOptions},
    io::{self, Read},
    path::Path,
};

const MAX_EXPANDED_BYTES: u64 = 1024 * 1024 * 1024;
const MAX_ENTRIES: usize = 10_000;

/// Extract only regular files/directories. Links are resolved after all files
/// are written, confined to this fresh private staging directory.
pub fn extract(
    archive: &Path,
    destination: &Path,
    format: ArchiveFormat,
    command: &Path,
    target: &str,
) -> Result<(), String> {
    let file = File::open(archive).map_err(|_| "Could not open the ACP binary archive")?;
    let mut remaining = MAX_EXPANDED_BYTES;
    match format {
        ArchiveFormat::Zip => {
            let mut zip = zip::ZipArchive::new(file).map_err(|_| "Invalid ACP ZIP archive")?;
            if zip.len() > MAX_ENTRIES {
                return Err("ACP archive contains too many entries".into());
            }
            let mut links = Vec::new();
            for index in 0..zip.len() {
                let mut entry = zip
                    .by_index(index)
                    .map_err(|_| "Could not read ACP ZIP entry")?;
                let name = entry
                    .name()
                    .map_err(|_| "ACP ZIP entry name is invalid")?
                    .into_owned();
                let path = safe_relative_path(&name)?;
                let mode = entry.unix_mode().unwrap_or(0o644);
                if entry.is_symlink() {
                    if entry.size() > 4096 {
                        return Err("ACP archive link is too long".into());
                    }
                    let mut target = String::new();
                    entry
                        .take(4097)
                        .read_to_string(&mut target)
                        .map_err(|_| "Invalid ACP archive link")?;
                    if target.len() > 4096 {
                        return Err("ACP archive link is too long".into());
                    }
                    links.push((path, target, false));
                } else if entry.is_dir() {
                    fs::create_dir_all(destination.join(path))
                        .map_err(|_| "Could not create ACP package directory")?;
                } else if entry.is_file() && matches!(mode & 0o170000, 0 | 0o100000) {
                    write_file(&mut entry, destination, &path, mode, &mut remaining)?;
                } else {
                    return Err("ACP archive contains an unsupported special file".into());
                }
            }
            materialize_links(destination, links, &mut remaining)?;
        }
        ArchiveFormat::TarGz => extract_tar(
            flate2::read::GzDecoder::new(file),
            destination,
            &mut remaining,
        )?,
        ArchiveFormat::TarBz2 => extract_tar(
            bzip2::read::BzDecoder::new(file),
            destination,
            &mut remaining,
        )?,
        ArchiveFormat::Raw => {
            // Never mistake an HTML error, shell installer or disk image for a
            // native executable merely because its URL has no archive suffix.
            let mut file = file;
            let mut magic = [0; 4];
            file.read_exact(&mut magic)
                .map_err(|_| "ACP raw binary is truncated")?;
            let valid = if target.starts_with("windows-") {
                magic.starts_with(b"MZ")
            } else if target.starts_with("linux-") {
                magic == *b"\x7fELF"
            } else {
                matches!(
                    magic,
                    [0xcf, 0xfa, 0xed, 0xfe]
                        | [0xce, 0xfa, 0xed, 0xfe]
                        | [0xfe, 0xed, 0xfa, 0xcf]
                        | [0xfe, 0xed, 0xfa, 0xce]
                        | [0xca, 0xfe, 0xba, 0xbe]
                        | [0xbe, 0xba, 0xfe, 0xca]
                        | [0xca, 0xfe, 0xba, 0xbf]
                        | [0xbf, 0xba, 0xfe, 0xca]
                )
            };
            if !valid {
                return Err("ACP download is not a native binary for this operating system".into());
            }
            write_file(
                &mut io::Cursor::new(magic).chain(file),
                destination,
                command,
                0o755,
                &mut remaining,
            )?;
        }
    }
    let executable = destination.join(command);
    let metadata = fs::symlink_metadata(&executable)
        .map_err(|_| "ACP package does not contain its declared executable")?;
    if !metadata.is_file() {
        return Err("ACP launch command must be a regular file".into());
    }
    set_mode(&executable, 0o755)?;
    Ok(())
}

fn extract_tar(reader: impl Read, destination: &Path, remaining: &mut u64) -> Result<(), String> {
    // Include TAR headers and extended metadata in the decompression cap,
    // not just regular file contents.
    let mut tar = tar::Archive::new(reader.take(MAX_EXPANDED_BYTES + 1));
    let entries = tar.entries().map_err(|_| "Invalid ACP TAR archive")?;
    let mut links = Vec::new();
    for (index, entry) in entries.enumerate() {
        if index >= MAX_ENTRIES {
            return Err("ACP archive contains too many entries".into());
        }
        let mut entry = entry.map_err(|_| "Could not read ACP TAR entry")?;
        let name = entry
            .path()
            .map_err(|_| "Invalid ACP TAR path")?
            .to_str()
            .ok_or("ACP archive path is not UTF-8")?
            .to_owned();
        let path = safe_relative_path(&name)?;
        let kind = entry.header().entry_type();
        if kind.is_dir() {
            fs::create_dir_all(destination.join(path))
                .map_err(|_| "Could not create ACP package directory")?;
        } else if kind.is_file() {
            let mode = entry.header().mode().map_err(|_| "Invalid ACP file mode")?;
            write_file(&mut entry, destination, &path, mode, remaining)?;
        } else if kind.is_symlink() || kind.is_hard_link() {
            let target = entry
                .link_name()
                .map_err(|_| "Invalid ACP archive link")?
                .ok_or("ACP archive link has no target")?
                .to_str()
                .ok_or("ACP archive link is not UTF-8")?
                .to_owned();
            links.push((path, target, kind.is_hard_link()));
        } else {
            return Err("ACP archive contains an unsupported special file".into());
        }
    }
    // Read the compressor trailer too (CRC/integrity errors may be reported
    // after TAR's end markers). Bound trailing padding/data against bombs.
    let trailing = io::copy(
        &mut tar.into_inner().take(remaining.saturating_add(1)),
        &mut io::sink(),
    )
    .map_err(|_| "ACP TAR compression integrity check failed")?;
    *remaining = remaining
        .checked_sub(trailing)
        .ok_or("Expanded ACP archive exceeds the 1 GB limit")?;
    materialize_links(destination, links, remaining)
}

fn write_file(
    reader: &mut impl Read,
    root: &Path,
    relative: &Path,
    mode: u32,
    remaining: &mut u64,
) -> Result<(), String> {
    if relative.as_os_str().is_empty() {
        return Err("ACP archive file has an empty path".into());
    }
    let output = root.join(relative);
    fs::create_dir_all(output.parent().ok_or("Invalid ACP archive path")?)
        .map_err(|_| "Could not create ACP package directory")?;
    let mut file = OpenOptions::new()
        .write(true)
        .create_new(true)
        .open(&output)
        .map_err(|_| "ACP archive has duplicate or conflicting file paths")?;
    let copied = io::copy(&mut reader.take(remaining.saturating_add(1)), &mut file)
        .map_err(|_| "Could not extract ACP package file")?;
    *remaining = remaining
        .checked_sub(copied)
        .ok_or("Expanded ACP archive exceeds the 1 GB limit")?;
    // Discard setuid/setgid and writable-by-other modes from third-party data.
    set_mode(&output, if mode & 0o111 != 0 { 0o755 } else { 0o644 })
}

fn set_mode(path: &Path, mode: u32) -> Result<(), String> {
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        fs::set_permissions(path, fs::Permissions::from_mode(mode))
            .map_err(|_| "Could not set ACP executable permissions")?;
    }
    #[cfg(not(unix))]
    let _ = (path, mode);
    Ok(())
}

fn materialize_links(
    root: &Path,
    links: Vec<(std::path::PathBuf, String, bool)>,
    remaining: &mut u64,
) -> Result<(), String> {
    // Copy internal file aliases rather than creating privileged Windows links
    // or leaving symlinks which a later extraction entry could follow.
    let mut pending = links;
    let mut alias_entries = MAX_ENTRIES;
    while !pending.is_empty() {
        let count = pending.len();
        let mut unresolved = Vec::new();
        for (path, target, hard) in pending {
            let normalized = target.replace('\\', "/");
            if normalized.starts_with('/') {
                return Err("ACP archive link escapes its installation directory".into());
            }
            let mut resolved = if hard {
                std::path::PathBuf::new()
            } else {
                path.parent().unwrap_or(Path::new("")).to_path_buf()
            };
            for part in normalized.split('/') {
                if part == ".." {
                    if !resolved.pop() {
                        return Err("ACP archive link escapes its installation directory".into());
                    }
                } else if !part.is_empty() && part != "." {
                    resolved.push(safe_relative_path(part)?);
                }
            }
            let source = root.join(resolved);
            match fs::symlink_metadata(&source) {
                Ok(metadata) if metadata.is_file() || (metadata.is_dir() && !hard) => {
                    let output = root.join(&path);
                    // Do not recursively copy a directory into itself.
                    if output.starts_with(&source) || source.starts_with(&output) {
                        return Err("ACP archive contains a recursive link".into());
                    }
                    copy_alias(&source, root, &path, remaining, &mut alias_entries)?;
                }
                Ok(_) => {
                    return Err(
                        "ACP archive links must reference internal files or directories".into(),
                    )
                }
                Err(error) if error.kind() == io::ErrorKind::NotFound => {
                    unresolved.push((path, target, hard))
                }
                Err(_) => return Err("Could not resolve ACP archive link".into()),
            }
        }
        if unresolved.len() == count {
            return Err("ACP archive contains missing or cyclic links".into());
        }
        pending = unresolved;
    }
    Ok(())
}

fn copy_alias(
    source: &Path,
    root: &Path,
    relative: &Path,
    remaining: &mut u64,
    entries: &mut usize,
) -> Result<(), String> {
    *entries = entries
        .checked_sub(1)
        .ok_or("ACP archive has too many linked entries")?;
    let metadata =
        fs::symlink_metadata(source).map_err(|_| "Could not read ACP archive link target")?;
    if metadata.is_dir() {
        fs::create_dir_all(
            root.join(relative)
                .parent()
                .ok_or("Invalid ACP archive alias path")?,
        )
        .map_err(|_| "Could not create ACP alias directory")?;
        fs::create_dir(root.join(relative))
            .map_err(|_| "ACP archive has conflicting linked directories")?;
        for child in fs::read_dir(source).map_err(|_| "Could not read ACP linked directory")? {
            let child = child.map_err(|_| "Could not read ACP linked file")?;
            copy_alias(
                &child.path(),
                root,
                &relative.join(child.file_name()),
                remaining,
                entries,
            )?;
        }
    } else if metadata.is_file() {
        #[cfg(unix)]
        let mode = {
            use std::os::unix::fs::PermissionsExt;
            metadata.permissions().mode()
        };
        #[cfg(not(unix))]
        let mode = 0o644;
        let mut file = File::open(source).map_err(|_| "Could not read ACP archive link target")?;
        write_file(&mut file, root, relative, mode, remaining)?;
    } else {
        return Err("ACP archive link points to a special file".into());
    }
    Ok(())
}

#[cfg(test)]
#[path = "binary_archive_tests.rs"]
mod tests;
