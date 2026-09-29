PRAGMA journal_mode = WAL;
PRAGMA synchronous = NORMAL;
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS repositories (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    local_path TEXT NOT NULL UNIQUE,
    last_opened_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS review_sessions (
    id TEXT PRIMARY KEY,
    repo_id TEXT NOT NULL REFERENCES repositories(id) ON DELETE CASCADE,
    base_ref TEXT NOT NULL,
    compare_ref TEXT NOT NULL,
    last_viewed_file TEXT,
    view_mode TEXT DEFAULT 'split' CHECK(view_mode IN ('split', 'unified')),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_repos_last_opened ON repositories(last_opened_at DESC);
CREATE INDEX IF NOT EXISTS idx_sessions_repo ON review_sessions(repo_id);

CREATE TABLE IF NOT EXISTS git_credentials (
    id TEXT PRIMARY KEY,
    provider TEXT NOT NULL,
    server_url TEXT NOT NULL,
    account_name TEXT NOT NULL,
    token_ref TEXT NOT NULL UNIQUE,
    token_type TEXT NOT NULL,
    label TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_git_credentials_provider ON git_credentials(provider);
CREATE INDEX IF NOT EXISTS idx_git_credentials_token_ref ON git_credentials(token_ref);
