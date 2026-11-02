//! One permission policy for list hints and transactional deletion.
use rusqlite::{params, Connection};
use std::collections::HashSet;

/// References use the same fragment format as the discussion quote action.
/// Inspect literal fragments conservatively, including Markdown reference links/HTML.
fn references(body: &str, targets: &mut HashSet<String>) {
    for (kind, prefix) in [
        ("comment", "#mr-comment/"),
        ("discussion", "#mr-discussion/"),
    ] {
        for part in body.split(prefix).skip(1) {
            let token = part
                .split(|c: char| c.is_whitespace() || ")]<>\"'`".contains(c))
                .next()
                .unwrap_or_default();
            let mut decoded = Vec::new();
            let mut bytes = token.as_bytes().iter().copied();
            while let Some(byte) = bytes.next() {
                if byte == b'%' {
                    let digit = |b: u8| (b as char).to_digit(16).map(|v| v as u8);
                    match (bytes.next().and_then(digit), bytes.next().and_then(digit)) {
                        (Some(a), Some(b)) => decoded.push(a * 16 + b),
                        _ => {
                            decoded.clear();
                            break;
                        }
                    }
                } else {
                    decoded.push(byte);
                }
            }
            if let Ok(id) = String::from_utf8(decoded) {
                if !id.is_empty() {
                    targets.insert(format!("{kind}/{id}"));
                }
            }
        }
    }
}

pub(super) fn deletable_comments(
    conn: &Connection,
    session_id: &str,
    local_email: &str,
) -> Result<HashSet<String>, rusqlite::Error> {
    let mut referenced = HashSet::new();
    // A quote can be in any MR, including its description.
    let mut sources = conn.prepare(
        "SELECT body FROM virtual_mr_comments UNION ALL
         SELECT description FROM virtual_mr_sessions WHERE description IS NOT NULL",
    )?;
    for body in sources.query_map([], |row| row.get::<_, String>(0))? {
        references(&body?, &mut referenced);
    }

    let mut stmt = conn.prepare(
        "SELECT c.id, c.discussion_id,
            NOT EXISTS(SELECT 1 FROM virtual_mr_comments older
                WHERE older.discussion_id=c.discussion_id AND older.rowid<c.rowid)
         FROM virtual_mr_comments c
         JOIN virtual_mr_discussions d ON d.id=c.discussion_id
         WHERE d.session_id=?1 AND c.author_type='user'
            AND (lower(trim(c.author_id))=lower(trim(?2))
                OR (c.author_id='user@local.stage0' AND c.author_name='Local User'))
            AND NOT EXISTS(SELECT 1 FROM virtual_mr_comments later
                WHERE later.discussion_id=c.discussion_id AND later.rowid>c.rowid)",
    )?;
    let candidates = stmt.query_map(params![session_id, local_email], |row| {
        Ok((
            row.get::<_, String>(0)?,
            row.get::<_, String>(1)?,
            row.get::<_, bool>(2)?,
        ))
    })?;
    let mut allowed = HashSet::new();
    for candidate in candidates {
        let (id, discussion_id, root) = candidate?;
        if !local_email.trim().is_empty()
            && !referenced.contains(&format!("comment/{id}"))
            && (!root || !referenced.contains(&format!("discussion/{discussion_id}")))
        {
            allowed.insert(id);
        }
    }
    Ok(allowed)
}

#[cfg(test)]
#[path = "deletion_tests.rs"]
mod tests;
