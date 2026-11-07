//! Normalize only blame source lines; commit/author metadata stays Git's UTF-8.
use crate::common::text_encoding::{decode_buffer, TextEncoding};
use std::{
    collections::{HashMap, HashSet},
    io::Read,
};

const CAP: usize = 16 * 1024 * 1024;
const HISTORY_CAP: usize = 64 * 1024 * 1024;

pub(super) fn normalize(
    repo: &str,
    path: &str,
    revision: Option<&str>,
    output: &str,
) -> Result<String, String> {
    if !output.contains(['\u{fffd}', '\0', '\u{feff}']) {
        return Ok(output.to_owned());
    }
    let input = if let Some(revision) = revision {
        super::super::text_content::read_blob_bytes(repo, revision, path, CAP)?
    } else {
        let safe = super::super::resolve_safe_repo_path(repo, path)?;
        if !std::fs::symlink_metadata(&safe)
            .map_err(|_| "Could not inspect blame file")?
            .file_type()
            .is_file()
        {
            return Err("Blame text source must be a regular file".into());
        }
        let mut bytes = Vec::new();
        std::fs::File::open(safe)
            .map_err(|_| "Could not open blame file")?
            .take(CAP as u64 + 1)
            .read_to_end(&mut bytes)
            .map_err(|_| "Could not read blame file")?;
        if bytes.len() > CAP {
            return Err("Blame source exceeds text safety limit".into());
        }
        bytes
    };
    let decoded = decode_buffer(&input, None)?;
    let mapping = line_mapping(&input, decoded.guess.encoding);
    let source_lines: Vec<_> = decoded.text.lines().collect();
    let mut history = HashMap::new();
    let mut history_bytes = 0usize;
    let mut emitted = HashSet::new();
    let mut result = String::new();
    let mut block = Vec::new();
    for line in output.lines() {
        if !line.starts_with('\t') {
            block.push(line);
            continue;
        }
        let Some(header) = block.first() else {
            return Err("Malformed blame source block".into());
        };
        let fields: Vec<_> = header.split_whitespace().collect();
        if fields.len() < 3 {
            return Err("Malformed blame source header".into());
        }
        let native: usize = fields[2].parse().map_err(|_| "Invalid blame line")?;
        let number = map_line(&mapping, native)?;
        let Some(content) = source_lines.get(number.saturating_sub(1)) else {
            block.clear();
            continue;
        };
        // A UTF-16 code unit can contain byte 0x0a without being a newline.
        // Collapse those extra Git byte lines to one decoded source line.
        if !emitted.insert(number) {
            block.clear();
            continue;
        }
        let mut original: usize = fields[1]
            .parse()
            .map_err(|_| "Invalid original blame line")?;
        if !mapping.is_empty() {
            let filename = block
                .iter()
                .find_map(|line| line.strip_prefix("filename "))
                .unwrap_or(path);
            let filename = crate::common::git_path::unquote(filename)?;
            let key = (fields[0].to_owned(), filename);
            if fields[0].bytes().all(|byte| byte == b'0') {
                original = map_line(&mapping, original)?;
            } else {
                if !history.contains_key(&key) {
                    let cap = CAP.min(HISTORY_CAP.saturating_sub(history_bytes));
                    let bytes =
                        super::super::text_content::read_blob_bytes(repo, fields[0], &key.1, cap)?;
                    history_bytes += bytes.len();
                    let encoding = decode_buffer(&bytes, None)?.guess.encoding;
                    history.insert(key.clone(), line_mapping(&bytes, encoding));
                }
                original = map_line(&history[&key], original)?;
            }
        }
        result.push_str(&format!("{} {original} {number}\n", fields[0]));
        for metadata in block.iter().skip(1) {
            result.push_str(metadata);
            result.push('\n');
        }
        result.push('\t');
        result.push_str(content);
        result.push('\n');
        block.clear();
    }
    Ok(result)
}

fn map_line(mapping: &[usize], native: usize) -> Result<usize, String> {
    if mapping.is_empty() {
        return Ok(native);
    }
    mapping
        .get(native.checked_sub(1).ok_or("Invalid blame coordinate")?)
        .copied()
        .ok_or_else(|| "Blame coordinate is outside encoded source".into())
}

fn line_mapping(bytes: &[u8], encoding: TextEncoding) -> Vec<usize> {
    if !matches!(encoding, TextEncoding::Utf16Le | TextEncoding::Utf16Be) {
        return Vec::new();
    }
    let offset =
        usize::from(bytes.starts_with(&[0xff, 0xfe]) || bytes.starts_with(&[0xfe, 0xff])) * 2;
    let mut mapping = vec![1];
    let mut line = 1;
    for index in offset..bytes.len() {
        if bytes[index] != b'\n' {
            continue;
        }
        let actual_newline = if encoding == TextEncoding::Utf16Le {
            (index - offset) % 2 == 0 && bytes.get(index + 1) == Some(&0)
        } else {
            (index - offset) % 2 == 1 && bytes.get(index - 1) == Some(&0)
        };
        if actual_newline {
            line += 1;
        }
        mapping.push(line);
    }
    mapping
}
