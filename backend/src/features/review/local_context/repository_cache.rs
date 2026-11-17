use super::{files, related_hit::RelatedHit};
use rusqlite::{params, Connection, OptionalExtension};
use serde_json::Value;
use std::{
    path::PathBuf,
    sync::{Arc, Mutex, Once, RwLock},
    time::Duration,
};

/// Connections never outlive an operation. Clear holds the epoch's write guard,
/// so Windows has no open readers and stale workers cannot recreate cleared data.
#[derive(Clone)]
pub(crate) struct RepositoryCache {
    pub(super) directory: PathBuf,
    pub(super) epoch: Arc<RwLock<u64>>,
    pub(super) generation: u64,
    pub(super) policy: String,
    pub(super) integrity_key: Arc<[u8; 32]>,
    pub(super) read_gate: Arc<Mutex<()>>,
}

impl RepositoryCache {
    pub(super) fn open(&self) -> Result<Connection, String> {
        for ancestor in self.directory.ancestors().take(3) {
            files::reject_link(ancestor).map_err(|e| e.to_string())?;
        }
        files::directory(&self.directory).map_err(|e| e.to_string())?;
        let path = self.directory.join("context.db");
        for suffix in ["", "-wal", "-shm", "-journal"] {
            files::reject_link(&self.directory.join(format!("context.db{suffix}")))
                .map_err(|e| e.to_string())?;
        }
        static EXTENSION: Once = Once::new();
        EXTENSION.call_once(|| unsafe {
            // sqlite-vec's statically linked, trusted entrypoint. No load_extension
            // or repository-supplied native library is ever enabled.
            rusqlite::ffi::sqlite3_auto_extension(Some(std::mem::transmute::<
                *const (),
                unsafe extern "C" fn(
                    *mut rusqlite::ffi::sqlite3,
                    *mut *mut std::ffi::c_char,
                    *const rusqlite::ffi::sqlite3_api_routines,
                ) -> std::ffi::c_int,
            >(
                sqlite_vec::sqlite3_vec_init as *const (),
            )));
        });
        let conn = Connection::open(&path).map_err(|e| e.to_string())?;
        files::private_file(&path).map_err(|e| e.to_string())?;
        conn.busy_timeout(Duration::from_millis(200))
            .map_err(|e| e.to_string())?;
        conn.execute_batch("PRAGMA page_size=4096; PRAGMA trusted_schema=OFF; PRAGMA foreign_keys=ON; PRAGMA secure_delete=ON; PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA cache_size=-2000; PRAGMA mmap_size=0; PRAGMA journal_size_limit=1048576; PRAGMA max_page_count=32768;").map_err(|e|e.to_string())?;
        let version: u32 = conn
            .query_row("PRAGMA user_version", [], |r| r.get(0))
            .map_err(|e| e.to_string())?;
        if version > 1 {
            return Err("Unsupported context cache version".into());
        }
        conn.execute_batch(include_str!("schema.sql"))
            .map_err(|e| e.to_string())?;
        Ok(conn)
    }

    pub fn key(&self, kind: &str, identity: &Value) -> String {
        files::digest(
            serde_json::json!(["stage0-context-v1", self.policy, kind, identity])
                .to_string()
                .as_bytes(),
        )
    }

    pub fn get(&self, key: &str) -> Option<Value> {
        let epoch = self.epoch.read().ok()?;
        if *epoch != self.generation {
            return None;
        }
        let conn = self.open().ok()?;
        let (body, checksum): (String, String) = conn
            .query_row(
                "SELECT body,checksum FROM reads WHERE key=?1 AND length(body)<=1048576",
                [key],
                |r| Ok((r.get(0)?, r.get(1)?)),
            )
            .optional()
            .ok()??;
        if body.len() > 1024 * 1024
            || !super::integrity::verify(&self.integrity_key, key, &body, &checksum)
        {
            return None;
        }
        serde_json::from_str(&body).ok()
    }

    pub fn put(&self, key: &str, value: &Value) {
        let Ok(epoch) = self.epoch.read() else { return };
        if *epoch != self.generation {
            return;
        }
        let body = value.to_string();
        if body.len() > 1024 * 1024 {
            return;
        }
        let Ok(mut conn) = self.open() else { return };
        let Ok(tx) = conn.transaction() else { return };
        let result = tx.execute("INSERT INTO reads(key,body,checksum) VALUES(?1,?2,?3) ON CONFLICT(key) DO UPDATE SET body=excluded.body,checksum=excluded.checksum,touched=unixepoch()", params![key,body,super::integrity::sign(&self.integrity_key,key,&body)]);
        if result.is_err() {
            return;
        }
        if tx.execute("DELETE FROM reads WHERE key IN (SELECT key FROM reads ORDER BY touched DESC,key LIMIT -1 OFFSET 128)", []).is_err() { return; }
        let _ = tx.commit();
    }

    pub(super) fn embedding(&self, hash: &str) -> Option<Vec<f32>> {
        let epoch = self.epoch.read().ok()?;
        if *epoch != self.generation {
            return None;
        }
        let conn = self.open().ok()?;
        let bytes: Vec<u8> = conn
            .query_row(
                "SELECT vector FROM embeddings WHERE hash=?1 AND model=?2",
                params![hash, super::model::IDENTITY],
                |r| r.get(0),
            )
            .optional()
            .ok()??;
        if bytes.len() != 384 * 4 {
            return None;
        }
        let vector = bytes
            .chunks_exact(4)
            .map(|b| f32::from_le_bytes(b.try_into().unwrap()))
            .collect::<Vec<_>>();
        let norm = vector.iter().map(|v| v * v).sum::<f32>();
        (norm.is_finite() && (norm - 1.).abs() < 0.001).then_some(vector)
    }

    pub(super) fn insert_vectors(
        &self,
        snapshot: &str,
        path: &str,
        side: &str,
        chunks: &[(usize, usize, String, Vec<f32>)],
    ) -> Result<(), String> {
        let epoch = self.epoch.read().map_err(|e| e.to_string())?;
        if *epoch != self.generation {
            return Ok(());
        }
        let mut conn = self.open()?;
        let tx = conn.transaction().map_err(|e| e.to_string())?;
        let count: i64 = tx
            .query_row("SELECT count(*) FROM chunks", [], |r| r.get(0))
            .map_err(|e| e.to_string())?;
        if count >= 20000 {
            return Ok(());
        }
        for (start, end, hash, vector) in chunks.iter().take((20000 - count) as usize) {
            if vector.len() != 384 || vector.iter().any(|f| !f.is_finite()) {
                return Err("Invalid embedding".into());
            }
            let added = tx.execute("INSERT OR IGNORE INTO chunks(snapshot,path,side,first_line,last_line,hash,model) VALUES(?1,?2,?3,?4,?5,?6,?7)", params![snapshot,path,side,*start as i64,*end as i64,hash,super::model::IDENTITY]).map_err(|e|e.to_string())?;
            if added == 0 {
                continue;
            }
            let id = tx.last_insert_rowid();
            let bytes: Vec<u8> = vector.iter().flat_map(|f| f.to_le_bytes()).collect();
            tx.execute(
                "INSERT OR IGNORE INTO embeddings(hash,model,vector) VALUES(?1,?2,?3)",
                params![hash, super::model::IDENTITY, bytes],
            )
            .map_err(|e| e.to_string())?;
            tx.execute(
                "INSERT INTO vectors(id,embedding,snapshot,model) VALUES(?1,?2,?3,?4)",
                params![id, bytes, snapshot, super::model::IDENTITY],
            )
            .map_err(|e| e.to_string())?;
        }
        tx.commit().map_err(|e| e.to_string())
    }

    pub(super) fn search(&self, snapshot: &str, query: &[f32]) -> Result<Vec<RelatedHit>, String> {
        if query.len() != 384 || query.iter().any(|f| !f.is_finite()) {
            return Err("Invalid query embedding".into());
        }
        let epoch = self.epoch.read().map_err(|e| e.to_string())?;
        if *epoch != self.generation {
            return Ok(vec![]);
        }
        let conn = self.open()?;
        let bytes: Vec<u8> = query.iter().flat_map(|f| f.to_le_bytes()).collect();
        let mut stmt = conn.prepare("SELECT c.path,c.side,c.first_line,c.last_line,v.distance FROM (SELECT id,distance FROM vectors WHERE embedding MATCH ?1 AND k=6 AND snapshot=?2 AND model=?3) v JOIN chunks c ON c.id=v.id WHERE c.snapshot=?2 AND c.model=?3 ORDER BY v.distance").map_err(|e|e.to_string())?;
        let rows = stmt
            .query_map(params![bytes, snapshot, super::model::IDENTITY], |r| {
                Ok(RelatedHit {
                    file_path: r.get(0)?,
                    side: r.get(1)?,
                    start_line: r.get::<_, u32>(2)? as usize,
                    end_line: r.get::<_, u32>(3)? as usize,
                    distance: r.get(4)?,
                })
            })
            .map_err(|e| e.to_string())?;
        rows.collect::<Result<Vec<_>, _>>()
            .map_err(|e| e.to_string())
    }
}
