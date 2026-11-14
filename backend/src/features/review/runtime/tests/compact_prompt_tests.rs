use super::*;

#[test]
fn compact_prompt_preserves_authority_scope_and_reduces_fixed_input() {
    let mut request = config("http://localhost".into());
    request.instructions = "UNTRUSTED_USER_PREFERENCE_OVERRIDE".into();
    for (reply, description) in [(false, false), (false, true), (true, false)] {
        request.reply_discussion_id = reply.then(|| "thread".into());
        request.generate_description = description;
        let original = build_system_prompt(&request);
        let compact = super::super::compact_prompt::build(&request);
        assert!(
            compact.len() < original.len(),
            "{} >= {}",
            compact.len(),
            original.len()
        );
        assert!(!compact.contains(&request.instructions));
        for contract in [
            "UNTRUSTED DATA",
            "immutable Git snapshot",
            "non-redacted source evidence",
            "absolute 1-based changed line",
            "nextBodyOffset",
            "targetCommentId",
            "discussionRevision",
            "current head",
            "no findings and no unresolved discussions",
            "Stage0 independently compares original/head/base",
            "latest comment directly mentions your reviewer ID",
            "empty results do not prove absence",
        ] {
            assert!(compact.contains(contract), "missing {contract}");
        }
        if reply {
            assert!(compact.contains(
                "Do not create findings, resolve threads, update descriptions or decide the MR"
            ));
        }
        if description {
            assert!(
                compact.contains("Before discussion actions or submission, update_mr_description")
            );
        }
    }
}
