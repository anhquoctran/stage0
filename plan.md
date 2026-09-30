# TECHNICAL SPECIFICATION & EXECUTION PLAN: LOCAL VIRTUAL MR (MVP-P0)

## 1. Project Overview & Scope
- **Product Name:** Stage0
- **Goal:** Desktop application for local-first branch comparison, 3-dot diff rendering, in-memory conflict detection, and real-time working tree monitoring without pushing code to remote servers.
- **Scope Limit (MVP-P0):** Git Engine + Local MR Sandbox + Realtime File Watcher + Embedded SQLite. No AI integration in this phase.

---

## 2. Technology Stack & Core Dependencies
- **Desktop Runtime:** Tauri v2 (Rust Core + Native OS WebView).
- **Frontend:** React 19, Vite, TypeScript, Tailwind CSS v4.
- **Diff Rendering Engine:** `@git-diff-view/react` (Virtual scrolling, split/unified view support).
- **Embedded Database:** `rusqlite` (bundled C-SQLite, WAL mode enabled).
- **Git Execution:** Rust `std::process::Command` (calling system Git CLI binary directly).
- **File System Monitoring:** Rust `notify` crate with 300ms debounce.
- **State Management:** Zustand.
- **Icons:** Font Awesome Free 7 (Classic Solid and Regular).

---

## 3. Project Directory Layout

```text
├── src-tauri/
│   ├── Cargo.toml
│   ├── tauri.conf.json
│   ├── capabilities/
│   │   └── default.json          # Tauri v2 permissions (fs, dialog, shell)
│   └── src/
│       ├── main.rs               # Tauri entrypoint & builder
│       ├── lib.rs                # App setup & command registration
│       ├── commands.rs           # Tauri IPC command handlers
│       ├── db/
│       │   ├── mod.rs            # SQLite connection pool & migrations
│       │   └── schema.sql        # Database schema DDL
│       ├── git/
│       │   ├── mod.rs            # Git module exports
│       │   ├── runner.rs         # Safe subprocess execution (stdout/stderr)
│       │   ├── branches.rs       # Branch listing & merge-base resolution
│       │   ├── diff.rs           # 3-dot diff parser & numstat calculator
│       │   ├── conflict.rs       # In-memory merge check via `git merge-tree`
│       │   └── ops.rs            # fetch, pull, rebase runners
│       └── watcher/
│           └── mod.rs            # Debounced file system watcher
├── src/                          # Frontend React UI
│   ├── components/
│   │   ├── layout/
│   │   │   ├── TopBar.tsx        # Repo selector, Branch pickers, Sync actions
│   │   │   └── MainLayout.tsx    # Split layout container
│   │   └── git/
│   │       ├── BranchSelector.tsx# Searchable dropdown for base/compare refs
│   │       ├── FileList.tsx      # Sidebar listing changed files (+/- stats)
│   │       ├── ConflictBanner.tsx# Alert component for detected merge conflicts
│   │       └── DiffViewer.tsx    # Container for @git-diff-view/react
│   ├── store/
│   │   └── useGitStore.ts        # Global Zustand store for session state
│   ├── types/
│   │   └── git.ts                # TypeScript interfaces mapped to Rust structs
│   ├── App.tsx                   # Main application view
│   └── index.css                 # Tailwind CSS directives
├── package.json
└── tsconfig.json
```

---

## 4. SQLite Embedded Schema (`src-tauri/src/db/schema.sql`)

```sql
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
```

---

## 5. Rust Data Structures & IPC Commands

### 5.1 DTO Definitions (`src-tauri/src/git/mod.rs`)

```rust
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct RepoInfo {
    pub id: String,
    pub name: String,
    pub local_path: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct BranchList {
    pub current: String,
    pub local: Vec<String>,
    pub remote: Vec<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ChangedFile {
    pub path: String,
    pub old_path: Option<String>,
    pub status: String, // "ADDED" | "MODIFIED" | "DELETED" | "RENAMED"
    pub additions: u32,
    pub deletions: u32,
    pub is_conflicted: bool,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct MrDiffPayload {
    pub base_commit: String,
    pub compare_commit: String,
    pub files: Vec<ChangedFile>,
    pub raw_diff: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ConflictReport {
    pub has_conflicts: bool,
    pub conflicted_files: Vec<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct RepoChangedEvent {
    pub repo_path: String,
}
```

### 5.2 Tauri Command Signatures (`src-tauri/src/commands.rs`)

```rust
#[tauri::command]
pub async fn open_repo_dialog(app: tauri::AppHandle) -> Result<Option<RepoInfo>, String>;

#[tauri::command]
pub async fn get_recent_repos(app: tauri::AppHandle) -> Result<Vec<RepoInfo>, String>;

#[tauri::command]
pub async fn get_branches(repo_path: String) -> Result<BranchList, String>;

#[tauri::command]
pub async fn get_mr_diff(
    repo_path: String,
    base: String,
    compare: String,
) -> Result<MrDiffPayload, String>;

#[tauri::command]
pub async fn check_merge_conflicts(
    repo_path: String,
    base: String,
    compare: String,
) -> Result<ConflictReport, String>;

#[tauri::command]
pub async fn run_git_sync(
    repo_path: String,
    operation: String, // "fetch" | "pull" | "rebase"
) -> Result<String, String>;
```

---

## 6. Core Git Engine Logic

All operations must execute via `std::process::Command` in the target `repo_path`.

1. **Calculate Merge Base:**
   ```bash
   git merge-base <base> <compare>
   ```
2. **File List & Additions/Deletions:**
   ```bash
   git diff --numstat --name-status <base>...<compare>
   ```
   * Parse format: `<added>\t<deleted>\t<filename>` and `<status>\t<filename>`.
3. **Full 3-Dot Diff Extraction:**
   ```bash
   git diff -U3 <base>...<compare>
   ```
4. **In-Memory Conflict Detection:**
   ```bash
   git merge-tree --write-tree <base> <compare>
   ```
   - Exit code != 0 or stdout containing conflict markers indicates a conflict.
   - Parse stdout to extract conflicting file paths. Does NOT modify `.git/index` or working tree.
5. **Branch Enumeration:**
   ```bash
   git for-each-ref --format="%(refname:short)|%(HEAD)" refs/heads/ refs/remotes/
   ```

---

## 7. Realtime Watcher Architecture

- Watch target: `{repo_path}` recursively.
- Filter criteria:
  - Must trigger on: `.git/HEAD`, `.git/refs/heads/*`, `.git/index`, and source code files.
  - Must ignore: `node_modules/`, `target/`, `bin/`, `obj/`, `.git/objects/`, `.git/logs/`.
- Debounce window: **300ms**.
- Dispatch: Emit Tauri event `repo-fs-changed` with payload `{ repo_path: string }`.
- Frontend listener: On receiving `repo-fs-changed`, invalidate query and refetch `get_mr_diff` and `check_merge_conflicts` while preserving UI scroll position.

---

## 8. Frontend Implementation Guidelines

### 8.1 TypeScript Definitions (`src/types/git.ts`)

```typescript
export interface RepoInfo {
  id: string;
  name: string;
  local_path: string;
}

export interface BranchList {
  current: string;
  local: string[];
  remote: string[];
}

export interface ChangedFile {
  path: string;
  old_path?: string;
  status: 'ADDED' | 'MODIFIED' | 'DELETED' | 'RENAMED';
  additions: number;
  deletions: number;
  is_conflicted: boolean;
}

export interface MrDiffPayload {
  base_commit: string;
  compare_commit: string;
  files: ChangedFile[];
  raw_diff: string;
}

export interface ConflictReport {
  has_conflicts: boolean;
  conflicted_files: string[];
}
```

### 8.2 DiffViewer Component
- Wrap `@git-diff-view/react`.
- Support Split View (side-by-side) and Unified View (inline).
- Enable virtual scrolling to maintain 60fps when rendering diffs exceeding 3,000 lines.
- Filter raw unified diff by the file selected in `FileList`.

---

## 9. Phased Execution Plan (For Coding Agent)

### Phase 1: Environment & Project Scaffolding
- [ ] Initialize Tauri v2 project using `create-tauri-app` (React, TypeScript, Tailwind CSS v4).
- [ ] Add Rust dependencies in `src-tauri/Cargo.toml`:
  - `rusqlite = { version = "0.31", features = ["bundled"] }`
  - `notify = "6.1"`
  - `notify-debouncer-mini = "0.4"`
  - `serde = { version = "1.0", features = ["derive"] }`
  - `serde_json = "1.0"`
  - `uuid = { version = "1.8", features = ["v4"] }`
  - `anyhow = "1.0"`
- [ ] Install npm dependencies:
  - `@git-diff-view/react`
  - `zustand`
  - `@fortawesome/fontawesome-svg-core`
  - `@fortawesome/react-fontawesome`
  - `@fortawesome/free-solid-svg-icons`
  - `@fortawesome/free-regular-svg-icons`
  - `clsx`
  - `tailwind-merge`

### Phase 2: Database & Native Subprocess Modules
- [ ] Implement SQLite wrapper in `src-tauri/src/db/`:
  - Setup initialization logic with WAL mode.
  - Run `schema.sql` on startup.
- [ ] Implement native folder dialog command `open_repo_dialog`:
  - Verify chosen directory contains a valid `.git` folder.
  - Insert or update record in `repositories` table.
- [ ] Implement `src-tauri/src/git/runner.rs` to execute Git CLI subprocesses with captured streams and timeout handling.

### Phase 3: Git Core Implementation
- [ ] Implement `get_branches`: Parse local and remote branch names.
- [ ] Implement `get_mr_diff`:
  - Calculate `git merge-base`.
  - Extract file list with `--numstat`.
  - Generate full 3-dot patch via `git diff -U3 <base>...<compare>`.
- [ ] Implement `check_merge_conflicts`:
  - Execute `git merge-tree --write-tree`.
  - Parse conflicting paths without touching disk working directory.
  - Set exit status parser to avoid false negatives.
- [ ] Implement `run_git_sync` for fetch, pull, and rebase commands.

### Phase 4: Frontend Development
- [ ] Setup Zustand store in `src/store/useGitStore.ts`:
  - State: `currentRepo`, `branches`, `baseBranch`, `compareBranch`, `diffPayload`, `conflictReport`, `selectedFile`, `viewMode`.
- [ ] Build `TopBar`:
  - Repo selector button (opens native dialog).
  - Searchable dropdowns for Base and Compare branches.
  - Fetch / Pull buttons.
- [ ] Build `FileList`:
  - List changed files with file status icons and color-coded line count additions/deletions.
  - Display red warning badge for files with active merge conflicts.
- [ ] Build `ConflictBanner`:
  - Visible only when `conflictReport.has_conflicts == true`.
  - Displays summary of unmerged paths.
- [ ] Build `DiffViewer`:
  - Integrate `@git-diff-view/react`.
  - Implement toggle between Split and Unified diff layouts.

### Phase 5: File Watcher & System Verification
- [ ] Implement file watcher thread in `src-tauri/src/watcher/mod.rs` using `notify-debouncer-mini` (300ms window).
- [ ] Register listener in React (`listen('repo-fs-changed', ...)`):
  - Automatically refresh diff payload upon local file edit or branch change.
- [ ] End-to-end verification checklist:
  - Open arbitrary local git repository.
  - Compare two diverged branches.
  - Edit a tracked file externally in VS Code / IDE -> Verify diff updates instantly.
  - Verify in-memory conflict alert by comparing two known conflicting branches without altering local working tree.

---

## 7. Future Phases & Architecture Specifications (RFCs)

### Multi-Session Virtual MR per Repository
- **Specification Document:** [`docs/architecture/multi_virtual_mr_spec.md`](docs/architecture/multi_virtual_mr_spec.md)
- **Goal:** Enable multi-tab concurrent Virtual MR comparisons on a single repository with zero disk writes, SQLite session persistence, and independent sandbox instances.
- **Key Modules:**
  - Tab-based workspace UI with hot-switching and cache isolation.
  - SQLite persistence schema (`virtual_mr_sessions`).
  - Stacked PR & cascade conflict invalidation.
  - Sandbox instance binding per session.

### Multi-Window Workspace (1 Unique Repo per Window)
- **Specification Document:** [`docs/architecture/multi_window_spec.md`](docs/architecture/multi_window_spec.md)
- **Goal:** Enable multi-window architecture where each window represents exactly one unique repository by canonical physical path on disk, with automatic focus redirection when opening duplicates.
- **Key Modules:**
  - Physical path canonicalization (`dunce::canonicalize`) to prevent duplicates from case-insensitivity, symlinks, or junctions.
  - Rust `WindowManagerState` tracking `canonical_path` <-> `window_label`.
  - Automatic focus redirection (`unminimize()`, `show()`, `set_focus()`) on duplicate open attempts.
  - Independent frontend Zustand store instances per Webview window.
  - SQLite WAL mode concurrency and selective file watcher event dispatching.
