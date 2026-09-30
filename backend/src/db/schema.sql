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

-- ===========================================================================
-- Virtual MR, Discussions, Labels & Repository Settings
-- ===========================================================================

CREATE TABLE IF NOT EXISTS repo_settings (
    repo_id TEXT PRIMARY KEY,
    default_base_branch TEXT DEFAULT 'main',
    inherit_global_agents BOOLEAN DEFAULT 1,
    custom_agent_rules TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(repo_id) REFERENCES repositories(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS repo_labels (
    id TEXT PRIMARY KEY,
    repo_id TEXT NOT NULL,
    name TEXT NOT NULL,
    color TEXT NOT NULL,
    description TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(repo_id) REFERENCES repositories(id) ON DELETE CASCADE,
    UNIQUE(repo_id, name)
);

CREATE TABLE IF NOT EXISTS virtual_mr_sessions (
    id TEXT PRIMARY KEY,
    repo_id TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    base_branch TEXT NOT NULL,
    compare_branch TEXT NOT NULL,
    status TEXT DEFAULT 'open',
    assignee_name TEXT,
    assignee_email TEXT,
    is_pinned BOOLEAN DEFAULT 0,
    sandbox_adapter_type TEXT DEFAULT 'in_memory',
    sandbox_instance_id TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(repo_id) REFERENCES repositories(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS virtual_mr_session_labels (
    session_id TEXT NOT NULL,
    label_id TEXT NOT NULL,
    PRIMARY KEY(session_id, label_id),
    FOREIGN KEY(session_id) REFERENCES virtual_mr_sessions(id) ON DELETE CASCADE,
    FOREIGN KEY(label_id) REFERENCES repo_labels(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS virtual_mr_session_reviewers (
    session_id TEXT NOT NULL,
    agent_id TEXT NOT NULL,
    agent_name TEXT NOT NULL,
    review_status TEXT DEFAULT 'pending',
    assigned_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY(session_id, agent_id),
    FOREIGN KEY(session_id) REFERENCES virtual_mr_sessions(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS virtual_mr_discussions (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL,
    file_path TEXT,
    diff_side TEXT,
    line_number INTEGER,
    commit_id TEXT,
    is_resolved BOOLEAN DEFAULT 0,
    resolve_type TEXT DEFAULT 'manual',
    resolved_by TEXT,
    resolved_at DATETIME,
    verification_status TEXT DEFAULT 'none',
    verified_by_bot TEXT,
    verified_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(session_id) REFERENCES virtual_mr_sessions(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS virtual_mr_comments (
    id TEXT PRIMARY KEY,
    discussion_id TEXT NOT NULL,
    author_type TEXT NOT NULL,
    author_id TEXT NOT NULL,
    author_name TEXT NOT NULL,
    author_avatar TEXT,
    body TEXT NOT NULL,
    review_action TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(discussion_id) REFERENCES virtual_mr_discussions(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_vmr_repo ON virtual_mr_sessions(repo_id);
CREATE INDEX IF NOT EXISTS idx_vmr_repo_updated ON virtual_mr_sessions(repo_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_labels_repo ON repo_labels(repo_id);
CREATE INDEX IF NOT EXISTS idx_labels_repo_name ON repo_labels(repo_id, name ASC);
CREATE INDEX IF NOT EXISTS idx_vmr_session_labels_session ON virtual_mr_session_labels(session_id);
CREATE INDEX IF NOT EXISTS idx_vmr_session_labels_label ON virtual_mr_session_labels(label_id);
CREATE INDEX IF NOT EXISTS idx_discussions_session ON virtual_mr_discussions(session_id);
CREATE INDEX IF NOT EXISTS idx_discussions_session_created ON virtual_mr_discussions(session_id, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_discussions_session_file ON virtual_mr_discussions(session_id, file_path, line_number);
CREATE INDEX IF NOT EXISTS idx_comments_discussion ON virtual_mr_comments(discussion_id);
CREATE INDEX IF NOT EXISTS idx_comments_disc_created ON virtual_mr_comments(discussion_id, created_at ASC);

-- Global App Settings (Git executable binary, etc.)
CREATE TABLE IF NOT EXISTS app_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

