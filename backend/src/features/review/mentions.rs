use rusqlite::Connection;
use serde_json::{json, Value};

fn encode_id(id: &str) -> String {
    id.bytes()
        .map(|byte| {
            if byte.is_ascii_alphanumeric() || b"-_.!~*'()".contains(&byte) {
                (byte as char).to_string()
            } else {
                format!("%{byte:02X}")
            }
        })
        .collect()
}

fn mention_link(kind: &str, id: &str, name: &str) -> String {
    let label = name
        .chars()
        .flat_map(|ch| {
            if "\\`*_{}[]<>!|".contains(ch) {
                vec!['\\', ch]
            } else if ch == '\r' || ch == '\n' {
                vec![' ']
            } else {
                vec![ch]
            }
        })
        .collect::<String>();
    format!("[@{label}](#mr-mention/{kind}/{})", encode_id(id))
}

pub fn participants(conn: &Connection, session_id: &str) -> Result<Value, String> {
    let (name, email): (Option<String>, Option<String>) = conn
        .query_row(
            "SELECT assignee_name,assignee_email FROM virtual_mr_sessions WHERE id=?1",
            [session_id],
            |row| Ok((row.get(0)?, row.get(1)?)),
        )
        .map_err(|error| error.to_string())?;
    let mut people = Vec::new();
    if let Some(id) = email.filter(|id| !id.is_empty()) {
        let name = name
            .filter(|name| !name.is_empty())
            .unwrap_or_else(|| id.clone());
        people.push(json!({"kind":"assignee","id":id,"name":name,"mention":mention_link("assignee", &id, &name)}));
    }
    let mut statement = conn.prepare("SELECT agent_id,agent_name FROM virtual_mr_session_reviewers WHERE session_id=?1 ORDER BY assigned_at,agent_id").map_err(|error| error.to_string())?;
    let rows = statement
        .query_map([session_id], |row| {
            Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?))
        })
        .map_err(|error| error.to_string())?;
    for row in rows {
        let (id, name) = row.map_err(|error| error.to_string())?;
        people.push(json!({"kind":"reviewer","id":id,"name":name,"mention":mention_link("reviewer", &id, &name)}));
    }
    Ok(json!(people))
}

pub fn has_reviewer_mention(body: &str, reviewer_id: &str) -> bool {
    let suffix = format!("](#mr-mention/reviewer/{})", encode_id(reviewer_id));
    let mut fence: Option<(u8, usize)> = None;
    let mut inline_ticks = 0;
    for line in body.lines() {
        let trimmed = line.trim_start();
        if trimmed.starts_with('>') || line.starts_with("    ") || line.starts_with('\t') {
            continue;
        }
        let bytes = trimmed.as_bytes();
        let marker = bytes
            .first()
            .copied()
            .filter(|byte| *byte == b'`' || *byte == b'~');
        if let Some(marker) = marker {
            let count = bytes.iter().take_while(|byte| **byte == marker).count();
            if count >= 3 {
                match fence {
                    None => fence = Some((marker, count)),
                    Some((open, length)) if marker == open && count >= length => fence = None,
                    _ => {}
                }
                continue;
            }
        }
        if fence.is_some() {
            continue;
        }
        let mut index = 0;
        while index < bytes.len() {
            if bytes[index] == b'\\' {
                index += 2;
                continue;
            }
            if bytes[index] == b'`' {
                let count = bytes[index..]
                    .iter()
                    .take_while(|byte| **byte == b'`')
                    .count();
                if inline_ticks == 0 {
                    inline_ticks = count;
                } else if inline_ticks == count {
                    inline_ticks = 0;
                }
                index += count;
                continue;
            }
            if inline_ticks == 0
                && bytes[index..].starts_with(b"[@")
                && (index == 0 || bytes[index - 1] != b'!')
            {
                // Inspect a Markdown mention link, rather than matching a display name or email.
                if let Some(end) = trimmed[index..].find("](") {
                    if trimmed[index + end..].starts_with(&suffix) {
                        return true;
                    }
                }
            }
            index += 1;
        }
    }
    false
}

/// A full-review command is handled by the host workflow, which posts progress
/// and completion replies after checking reviewer-specific unresolved findings.
pub fn is_manual_review_command(body: &str) -> bool {
    let body = body.trim();
    if body.lines().count() != 1 {
        return false;
    }
    let Some((label, link)) = body.rsplit_once("](") else {
        return false;
    };
    if !label.starts_with("[@") || label.len() <= 2 || label.contains('\n') {
        return false;
    }
    let Some((href, command)) = link.split_once(')') else {
        return false;
    };
    href.strip_prefix("#mr-mention/reviewer/")
        .is_some_and(|id| !id.is_empty())
        && command.trim().eq_ignore_ascii_case("review")
}

pub fn can_reply_to_comment(
    conn: &Connection,
    session_id: &str,
    reviewer_id: Option<&str>,
    author_type: &str,
    author_id: &str,
    body: &str,
) -> bool {
    if author_type == "user" {
        if is_manual_review_command(body) {
            return false;
        }
        // An explicit reviewer mention addresses that reviewer, rather than whichever bot runs first.
        let addressed = conn
            .prepare("SELECT agent_id FROM virtual_mr_session_reviewers WHERE session_id=?1")
            .ok()
            .and_then(|mut statement| {
                statement
                    .query_map([session_id], |row| row.get::<_, String>(0))
                    .ok()
                    .map(|rows| {
                        rows.filter_map(Result::ok)
                            .filter(|id| has_reviewer_mention(body, id))
                            .collect::<Vec<_>>()
                    })
            })
            .unwrap_or_default();
        return addressed.is_empty()
            || reviewer_id.is_some_and(|id| addressed.iter().any(|target| target == id));
    }
    let Some(reviewer_id) = reviewer_id else {
        return false;
    };
    if author_type != "ai_agent"
        || author_id == reviewer_id
        || !has_reviewer_mention(body, reviewer_id)
    {
        return false;
    }
    // Older AI comments used a run ID as author_id; retain self-reply protection for those records.
    let legacy_reviewer = conn
        .query_row(
            "SELECT payload FROM ai_review_runs WHERE id=?1",
            [author_id],
            |row| row.get::<_, String>(0),
        )
        .ok()
        .and_then(|payload| serde_json::from_str::<Value>(&payload).ok())
        .and_then(|payload| payload["reviewerId"].as_str().map(str::to_owned));
    if legacy_reviewer.as_deref() == Some(reviewer_id) {
        return false;
    }
    conn.query_row("SELECT EXISTS(SELECT 1 FROM virtual_mr_session_reviewers WHERE session_id=?1 AND agent_id=?2)",
        [session_id, reviewer_id], |row| row.get::<_, bool>(0)).unwrap_or(false)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn mention_links_match_the_editor_format_and_require_exact_identity() {
        assert_eq!(
            mention_link("assignee", "alice@test", "Alice"),
            "[@Alice](#mr-mention/assignee/alice%40test)"
        );
        let link = mention_link("reviewer", "reviewer/a", "AI [A]");
        assert_eq!(link, "[@AI \\[A\\]](#mr-mention/reviewer/reviewer%2Fa)");
        assert!(has_reviewer_mention(&link, "reviewer/a"));
        assert!(!has_reviewer_mention(&link, "reviewer"));
        assert!(!has_reviewer_mention("@AI A", "reviewer/a"));
    }

    #[test]
    fn quotes_code_and_escaped_links_do_not_address_a_reviewer() {
        let mention = mention_link("reviewer", "b", "Bot B");
        for body in [
            format!("> {mention}"),
            format!("`{mention}`"),
            format!("```md\n{mention}\n```"),
            format!("~~~md\n{mention}\n~~~"),
            format!("\\{mention}"),
            format!("    {mention}"),
            format!("!{mention}"),
        ] {
            assert!(!has_reviewer_mention(&body, "b"), "{body}");
        }
        assert!(has_reviewer_mention(
            &format!("`example` Please check {mention}"),
            "b"
        ));
    }

    #[test]
    fn exact_review_commands_are_reserved_for_the_host_workflow() {
        let command = mention_link("reviewer", "bot-1", "Code Reviewer");
        assert!(is_manual_review_command(&format!("{command} review")));
        assert!(is_manual_review_command(&format!("{command} REVIEW")));
        for body in [
            format!("> {command} review"),
            format!("`{command} review`"),
            format!("```md\n{command} review\n```"),
            format!("{command} please review"),
            format!("Please review {command}"),
            format!("{command} review\nwith context"),
        ] {
            assert!(!is_manual_review_command(&body), "{body}");
        }
    }

    #[test]
    fn only_an_assigned_mentioned_peer_can_answer_an_ai_comment() {
        let conn = Connection::open_in_memory().unwrap();
        conn.execute_batch("CREATE TABLE virtual_mr_session_reviewers(session_id TEXT,agent_id TEXT); CREATE TABLE ai_review_runs(id TEXT,payload TEXT); INSERT INTO virtual_mr_session_reviewers VALUES('mr','b'); INSERT INTO ai_review_runs VALUES('old-b','{\"reviewerId\":\"b\"}');").unwrap();
        let body = mention_link("reviewer", "b", "Bot B");
        assert!(can_reply_to_comment(
            &conn,
            "mr",
            Some("b"),
            "ai_agent",
            "a",
            &body
        ));
        assert!(!can_reply_to_comment(
            &conn,
            "mr",
            Some("b"),
            "ai_agent",
            "b",
            &body
        ));
        assert!(!can_reply_to_comment(
            &conn,
            "mr",
            Some("b"),
            "ai_agent",
            "old-b",
            &body
        ));
        assert!(!can_reply_to_comment(
            &conn,
            "other-mr",
            Some("b"),
            "ai_agent",
            "a",
            &body
        ));
        assert!(!can_reply_to_comment(
            &conn,
            "mr",
            Some("b"),
            "ai_agent",
            "a",
            "No mention"
        ));
        assert!(can_reply_to_comment(
            &conn, "mr", None, "user", "alice", "Question"
        ));
        assert!(can_reply_to_comment(
            &conn,
            "mr",
            Some("b"),
            "user",
            "alice",
            &body
        ));
        assert!(!can_reply_to_comment(
            &conn,
            "mr",
            Some("a"),
            "user",
            "alice",
            &body
        ));
    }

    #[test]
    fn full_review_command_cannot_become_a_model_discussion_reply() {
        let conn = Connection::open_in_memory().unwrap();
        conn.execute_batch("CREATE TABLE virtual_mr_session_reviewers(session_id TEXT,agent_id TEXT); INSERT INTO virtual_mr_session_reviewers VALUES('mr','b');")
            .unwrap();
        let command = format!("{} review", mention_link("reviewer", "b", "Bot B"));
        assert!(!can_reply_to_comment(
            &conn,
            "mr",
            Some("b"),
            "user",
            "alice@example.test",
            &command,
        ));
    }

    #[test]
    fn roster_contains_assignee_and_only_reviewers_assigned_to_this_mr() {
        let conn = Connection::open_in_memory().unwrap();
        conn.execute_batch("CREATE TABLE virtual_mr_sessions(id TEXT,assignee_name TEXT,assignee_email TEXT); CREATE TABLE virtual_mr_session_reviewers(session_id TEXT,agent_id TEXT,agent_name TEXT,assigned_at TEXT); INSERT INTO virtual_mr_sessions VALUES('mr','Alice','alice@test'); INSERT INTO virtual_mr_session_reviewers VALUES('mr','a','Same name','1'),('mr','b','Same name','2'),('other','c','Other','3');").unwrap();
        let roster = participants(&conn, "mr").unwrap();
        let people = roster.as_array().unwrap();
        assert_eq!(people.len(), 3);
        assert_eq!(
            people[0]["mention"],
            "[@Alice](#mr-mention/assignee/alice%40test)"
        );
        assert_eq!(people[1]["mention"], "[@Same name](#mr-mention/reviewer/a)");
        assert_eq!(people[2]["mention"], "[@Same name](#mr-mention/reviewer/b)");
    }
}
