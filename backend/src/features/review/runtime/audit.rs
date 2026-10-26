//! Security telemetry deliberately excludes raw input, output, source and secrets.
use crate::{
    core::db::Database,
    features::review::{input_screen, ReviewToolCall},
};
use serde_json::json;
use std::collections::BTreeSet;

pub(super) fn output(db: &Database, run_id: &str, call: &ReviewToolCall) -> Result<(), String> {
    let flags = ["title", "body", "description", "summary"]
        .into_iter()
        .flat_map(|field| input_screen::flags(call.arguments[field].as_str().unwrap_or_default()))
        .collect::<BTreeSet<_>>();
    if !flags.is_empty() {
        db.review_event(
            run_id,
            "review_output_screened",
            json!({"tool":call.name,"screeningFlags":flags,"advisory":true}),
        )?;
    }
    Ok(())
}
