PRAGMA user_version=1;
CREATE TABLE IF NOT EXISTS reads (
  key TEXT PRIMARY KEY, body TEXT NOT NULL, checksum TEXT NOT NULL,
  touched INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE TABLE IF NOT EXISTS chunks (
  id INTEGER PRIMARY KEY, snapshot TEXT NOT NULL, path TEXT NOT NULL,
  side TEXT NOT NULL CHECK(side IN ('base','head')), first_line INTEGER NOT NULL,
  last_line INTEGER NOT NULL, hash TEXT NOT NULL, model TEXT NOT NULL,
  UNIQUE(snapshot,path,side,first_line,last_line,hash,model)
);
CREATE TABLE IF NOT EXISTS embeddings (hash TEXT NOT NULL, model TEXT NOT NULL, vector BLOB NOT NULL, PRIMARY KEY(hash,model));
CREATE INDEX IF NOT EXISTS chunk_snapshot ON chunks(snapshot);
CREATE VIRTUAL TABLE IF NOT EXISTS vectors USING vec0(
  id INTEGER PRIMARY KEY, embedding float[384] distance_metric=cosine,
  snapshot TEXT, model TEXT
);
