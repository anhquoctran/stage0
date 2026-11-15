use rusqlite::Connection;

pub(crate) fn migrate(conn: &Connection) -> rusqlite::Result<()> {
    let columns = {
        let mut q = conn.prepare("PRAGMA table_info(virtual_mr_ref_state)")?;
        let rows = q.query_map([], |r| r.get::<_, String>(1))?;
        rows.collect::<Result<Vec<_>, _>>()?
    };
    if !columns.iter().any(|name| name == "view_digest") {
        conn.execute(
            "ALTER TABLE virtual_mr_ref_state ADD COLUMN view_digest TEXT NOT NULL DEFAULT ''",
            [],
        )?;
    }
    Ok(())
}
