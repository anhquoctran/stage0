# Báo Cáo Quét & Phân Tích Kiến Trúc Codebase Stage0
> **Phiên bản:** 0.1.0  
> **Kiến trúc:** Tauri v2 (Rust Backend) + React 19 (TypeScript Frontend)  
> **Mục tiêu:** Hệ thống Virtual MR / PR Sandbox cục bộ, dự đoán xung đột Git và quản lý phiên review độc lập.

---

## 1. Dependencies & Cargo.toml

### 1.1. Backend Rust (`backend/Cargo.toml`)
Dự án sử dụng Rust 2021 edition với các nhóm crate chuyên biệt sau:

- **Desktop Framework & App Bridge:**
  - `tauri = { version = "2", features = ["devtools"] }`: Framework nhân điều khiển vòng đời ứng dụng, đa cửa sổ, routing IPC.
  - `tauri-plugin-dialog = "2"`: Cung cấp native file/folder picker.
  - `tauri-plugin-single-instance = "2"`: Đảm bảo chỉ có một instance desktop chạy tại một thời điểm, chuyển tiếp tham số command-line vào cửa sổ đang hoạt động.
- **Async Runtime & Quản lý Tiến trình (Process Management):**
  - Không kéo trực tiếp crate `tokio` bên ngoài để tránh phân mảnh phiên bản; tận dụng trực tiếp Tokio runtime do Tauri tái xuất khẩu (`tauri::async_runtime::spawn_blocking`) nhằm đẩy toàn bộ tác vụ I/O nặng và Git CLI ra worker thread riêng.
  - Quản lý tiến trình thông qua `std::process::Command` kết hợp cờ tạo process của Windows (`CREATE_NO_WINDOW = 0x08000000`) nhằm chặn pop-up cửa sổ terminal đen.
- **Git Driver:**
  - **Không dùng crate `git2` (libgit2)**. Toàn bộ tính năng Git được thực thi qua tiến trình Git CLI (`runner.rs`) với cơ chế chuyển đổi binary linh hoạt.
- **Database & Storage:**
  - `rusqlite = { version = "0.31", features = ["bundled"] }`: SQLite nhúng được biên dịch tĩnh (bundled C code), cấu hình chế độ WAL (`PRAGMA journal_mode = WAL`), memory temp store và bộ nhớ đệm mmap 256MB.
- **Bảo mật & OS Keyring (Credential Vault):**
  - `keyring = { version = "3" }`: Lưu trữ bảo mật Git Access Tokens và AI Provider API Keys trực tiếp vào vault của hệ điều hành:
    - Windows: `windows-native` (Windows Credential Manager).
    - macOS: `apple-native` (macOS Keychain).
    - Linux: `sync-secret-service` + `crypto-rust` (FreeDesktop Secret Service / GNOME Keyring / KWallet).
- **Filesystem Watcher:**
  - `notify = "6.1"`, `notify-debouncer-mini = "0.4"`: Giám sát thay đổi tệp tin trong repository, tự động debounce và kích hoạt cập nhật trạng thái diff lên frontend.
- **Tuần tự hóa (Serialization) & Tiện ích:**
  - `serde = { version = "1.0", features = ["derive"] }`, `serde_json = "1.0"`: Chuyển đổi dữ liệu IPC hai chiều giữa Rust và TypeScript.
  - `dunce = "1"`: Chuẩn hóa đường dẫn Windows, loại bỏ tiền tố verbatim `\\?\` gây lỗi cho Git CLI.
  - `uuid = { version = "1.8", features = ["v4"] }`, `chrono = { version = "0.4", features = ["serde"] }`, `anyhow = "1.0"`.

### 1.2. Frontend Webview (`package.json`)
- **Core:** `react = "^19.0.0"`, `react-dom = "^19.0.0"`, `typescript = "^5.7.3"`.
- **State Management:** `zustand = "^5.0.3"` (tách biệt theo 8 store chuyên trách).
- **Styling:** `tailwindcss = "^4.0.9"`, `@tailwindcss/vite = "^4.0.9"`, `@fontsource/fira-code = "^5.3.0"`.
- **Diff & Parser:** `@git-diff-view/react = "^0.1.7"` (render split/unified diff), `marked = "^18.0.14"` kết hợp native `DOMParser` HTML Sanitizer (`sanitizeHtml.ts`).
- **Tauri IPC:** `@tauri-apps/api = "^2.2.0"`, `@tauri-apps/plugin-dialog = "^2.2.0"`, `@tauri-apps/plugin-fs = "^2.2.0"`.

---

## 2. Cấu trúc thư mục (File Tree)

```text
stage0/
├── backend/                       # Tauri v2 Rust Backend (src-tauri)
│   ├── Cargo.toml                 # Khai báo crate dependencies & build profiles
│   ├── tauri.conf.json            # Cấu hình cửa sổ, CSP, build pipeline Tauri
│   ├── capabilities/
│   │   └── default.json           # Phân quyền cửa sổ và plugin permissions
│   ├── gen/schemas/               # JSON schemas tự động sinh của Tauri
│   └── src/
│       ├── main.rs                # Entrypoint tiến trình desktop
│       ├── lib.rs                 # Khởi tạo App, Builder, Menu và invoke_handler (72 commands)
│       ├── commands.rs            # Toàn bộ #[tauri::command] IPC endpoints
│       ├── window_manager.rs      # Quản lý vòng đời multi-window & trạng thái repo context
│       ├── menu.rs                # macOS native system menu & Recent Repositories menu
│       ├── credentials.rs         # Tương tác OS Keyring (Windows Credential Manager / Keychain)
│       ├── db/
│       │   ├── mod.rs             # SQLite DAO, connection pool mutex, poison recovery
│       │   └── schema.sql         # DDL khởi tạo bảng: repositories, sessions, discussions, labels
│       ├── git/
│       │   ├── mod.rs             # Safe path validation, models & module exports
│       │   ├── runner.rs          # Git CLI wrapper, resolve_ref, --end-of-options guard
│       │   ├── binary.rs          # Quét, định danh và kiểm tra phiên bản Git binary
│       │   ├── diff.rs            # Phân tích virtual MR diff (git diff base...compare, 5MB cap)
│       │   ├── conflict.rs        # Dự đoán xung đột không chạm đĩa (git merge-tree --write-tree)
│       │   ├── ops.rs             # Đồng bộ git (fetch, pull, push, remote, tag, branch)
│       │   ├── branches.rs        # Liệt kê nhánh local và remote
│       │   └── blame.rs           # Phân tích tác giả và lịch sử sửa đổi theo dòng
│       ├── sandbox/
│       │   ├── mod.rs             # Trait SandboxAdapter & SandboxManager
│       │   ├── in_memory.rs       # Adapter in-memory: 0 disk write, dùng git blob/tree
│       │   ├── local_worktree.rs  # Adapter git worktree: phân lập thư mục temp, whitelist lệnh
│       │   ├── docker.rs          # Adapter Docker container: containerization hoàn toàn
│       │   └── manager.rs         # Factory & điều phối chuyển đổi sandbox runtime
│       └── watcher/
│           └── mod.rs             # File watcher đa luồng dùng notify-debouncer-mini
│
├── frontend/                      # React 19 Frontend Webview
│   ├── App.tsx                    # Component gốc, điều phối splash screen và layout frame
│   ├── main.tsx                   # React root render & StrictMode boundary
│   ├── index.css                  # Tailwind 4 theme tokens (Catppuccin Macchiato/Latte)
│   ├── components/
│   │   ├── common/                # ErrorBoundary, MarkdownPreview, Modal, Icons, Avatar
│   │   ├── layout/                # TopBar, MenuBar, WindowControls, StatusBar, MainLayout
│   │   ├── git/                   # GitDiffView, FileBlameView, CommitHistoryView, BranchesModal
│   │   ├── mr/                    # VirtualMrWorkspace, DiscussionThread, ReviewersList, Labels
│   │   ├── repository/            # WelcomeScreen, OpenRepoModal, CloneRepoModal
│   │   └── preferences/           # PreferencesModal (Sandbox Engine, Git Binary, Keyring, AI/MCP)
│   ├── store/                     # Zustand state management
│   │   ├── useGitStore.ts         # Repository hiện tại, danh sách nhánh, diff payload, xung đột
│   │   ├── useVirtualMrStore.ts   # Session Virtual MR, thảo luận dòng, xác thực bot review
│   │   ├── useGitBinaryStore.ts   # Binary Git đang chọn (system / bundled / custom)
│   │   ├── useGitCredentialsStore.ts # Quản lý Git PAT, account tokens
│   │   ├── useAiMcpStore.ts       # Cấu hình AI Provider (Anthropic, OpenAI, Ollama) & MCP servers
│   │   ├── useBotReviewersStore.ts# Định nghĩa Agent bot review và tiêu chí chấm điểm
│   │   ├── usePreferencesStore.ts # Trạng thái đóng/mở modal preferences
│   │   └── useThemeStore.ts       # Dark/Light theme switcher
│   ├── types/                     # TypeScript Interfaces đồng bộ với Rust structs
│   │   ├── git.ts                 # RepoInfo, ChangedFile, MrDiffPayload, ConflictReport
│   │   ├── virtualMr.ts           # VirtualMrSession, VirtualMrDiscussion, VirtualMrComment
│   │   ├── gitBinary.ts           # GitBinaryInfo
│   │   ├── credentials.ts         # GitCredentialMeta, OsKeyringInfo
│   │   └── ai.ts                  # AiConfig, McpServerConfig, ProviderPreset
│   └── utils/                     # Tiện ích bổ trợ
│       ├── sanitizeHtml.ts        # Native DOMParser HTML Sanitizer (chống Stored XSS)
│       └── fileActions.ts         # Mở file trong VS Code, File Explorer, Terminal
├── public/                        # Static web assets
├── scripts/                       # Development & Build Automation
│   ├── dev.mjs                    # Cross-platform hot-reload dev runner
│   ├── dev.ps1                    # Windows PowerShell launcher
│   └── build.mjs                  # Script đóng gói production desktop bundle
├── index.html                     # HTML root kèm splash animation và fallback styling
├── package.json                   # NPM dependencies và npm run scripts
├── tsconfig.json                  # TypeScript compiler settings
└── vite.config.ts                 # Vite bundler config
```

---

## 3. Các Struct và Data Model Cốt Lõi

### 3.1. Git & Diff Models (`backend/src/git/mod.rs`)

```rust
// Thông tin nhận diện repository
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct RepoInfo {
    pub id: String,
    pub name: String,
    pub local_path: String,
}

// Danh sách nhánh
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct BranchList {
    pub current: String,
    pub local: Vec<String>,
    pub remote: Vec<String>,
}

// Chi tiết từng tệp thay đổi trong Diff
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ChangedFile {
    pub path: String,
    pub old_path: Option<String>,
    pub status: String, // "ADDED" | "MODIFIED" | "DELETED" | "RENAMED"
    pub additions: u32,
    pub deletions: u32,
    pub is_binary: bool,
    pub is_conflicted: bool,
}

// Payload Diff tổng hợp giữa 2 Git References (Virtual 3-dot Diff)
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct MrDiffPayload {
    pub base_commit: String,
    pub compare_commit: String,
    pub files: Vec<ChangedFile>,
    pub raw_diff: String,
}

// Báo cáo xung đột từ lệnh git merge-tree
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ConflictedFileInfo {
    pub path: String,
    pub conflict_type: String, // "content", "add/add", "modify/delete", v.v.
    pub message: String,
    pub conflict_markers_count: usize,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ConflictReport {
    pub has_conflicts: bool,
    pub conflicted_files: Vec<String>,
    pub details: Vec<ConflictedFileInfo>,
    pub base_branch: Option<String>,
    pub compare_branch: Option<String>,
}

// Vùng xung đột cụ thể trong tệp
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ConflictRegion {
    pub start_line: usize,
    pub end_line: usize,
    pub base_code: String,
    pub compare_code: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ConflictFilePreview {
    pub file_path: String,
    pub base_branch: String,
    pub compare_branch: String,
    pub conflict_type: String,
    pub has_conflict_markers: bool,
    pub conflict_markers_count: usize,
    pub merged_content: String,
    pub base_content: Option<String>,
    pub compare_content: Option<String>,
    pub conflict_regions: Vec<ConflictRegion>,
}
```

### 3.2. Database & Virtual MR Models (`backend/src/db/mod.rs` & `schema.sql`)

```rust
// Phiên Virtual Merge Request
#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct VirtualMrSessionDb {
    pub id: String,
    pub repo_id: String,
    pub title: String,
    pub description: Option<String>,
    pub base_branch: String,
    pub compare_branch: String,
    pub status: String,                   // "open" | "merged" | "closed"
    pub assignee_name: Option<String>,
    pub assignee_email: Option<String>,
    pub is_pinned: bool,
    pub sandbox_adapter_type: String,     // "in_memory" | "local_worktree" | "docker"
    pub sandbox_instance_id: Option<String>,
    pub created_at: String,
    pub updated_at: String,
    pub label_ids: Vec<String>,
}

// Luồng thảo luận gắn trên tệp hoặc dòng mã
#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct VirtualMrDiscussionDb {
    pub id: String,
    pub session_id: String,
    pub file_path: Option<String>,
    pub diff_side: Option<String>,        // "left" | "right" | "unified"
    pub line_number: Option<i64>,
    pub commit_id: Option<String>,
    pub is_resolved: bool,
    pub resolve_type: String,             // "manual" | "bot_verified"
    pub resolved_by: Option<String>,
    pub resolved_at: Option<String>,
    pub verification_status: String,      // "none" | "pending" | "passed" | "failed"
    pub verified_by_bot: Option<String>,
    pub verified_at: Option<String>,
    pub created_at: String,
    pub comments: Vec<VirtualMrCommentDb>,
}

// Từng bình luận trong luồng thảo luận
#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct VirtualMrCommentDb {
    pub id: String,
    pub discussion_id: String,
    pub author_type: String,              // "user" | "bot"
    pub author_id: String,
    pub author_name: String,
    pub author_avatar: Option<String>,
    pub body: String,
    pub review_action: Option<String>,    // "comment" | "approve" | "request_changes"
    pub created_at: String,
    pub updated_at: String,
}

// Nhãn và Cấu hình Repo
#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct RepoLabelDb {
    pub id: String,
    pub repo_id: String,
    pub name: String,
    pub color: String,
    pub description: Option<String>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct RepoSettingsDb {
    pub repo_id: String,
    pub default_base_branch: String,
    pub inherit_global_agents: bool,
    pub custom_agent_rules: Option<String>,
}
```

### 3.3. Sandbox Models & Trait (`backend/src/sandbox/mod.rs`)

```rust
#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum SandboxType {
    InMemory,
    LocalWorktree,
    Docker,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct SandboxCapabilities {
    pub can_run_commands: bool,
    pub can_write_files: bool,
    pub isolation_level: String, // "in_memory" | "local_worktree" | "container"
    pub requires_daemon: bool,
    pub supports_networking: bool,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct SandboxInstanceInfo {
    pub id: String,
    pub adapter_type: SandboxType,
    pub repo_path: String,
    pub base_branch: String,
    pub compare_branch: String,
    pub worktree_path: Option<String>,
    pub container_id: Option<String>,
    pub created_at: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct SandboxExecutionResult {
    pub command: String,
    pub stdout: String,
    pub stderr: String,
    pub exit_code: i32,
    pub duration_ms: u64,
}

pub trait SandboxAdapter: Send + Sync {
    fn adapter_type(&self) -> SandboxType;
    fn capabilities(&self) -> SandboxCapabilities;
    fn get_adapter_info(&self) -> SandboxAdapterInfo;
    fn get_diff(&self, repo_path: &str, base: &str, compare: &str) -> Result<MrDiffPayload, String>;
    fn check_conflicts(&self, repo_path: &str, base: &str, compare: &str) -> Result<ConflictReport, String>;
    fn get_conflict_preview(&self, repo_path: &str, base: &str, compare: &str, file_path: &str) -> Result<ConflictFilePreview, String>;
    fn create_instance(&self, repo_path: &str, base: &str, compare: &str) -> Result<SandboxInstanceInfo, String>;
    fn destroy_instance(&self, instance: &SandboxInstanceInfo) -> Result<(), String>;
    fn execute_command(&self, instance: &SandboxInstanceInfo, command: &str, args: &[String]) -> Result<SandboxExecutionResult, String>;
}
```

---

## 4. Danh Sách Tauri Commands (IPC Layer)

Toàn bộ 72 command được khai báo qua `#[tauri::command]` trong `commands.rs` và `menu.rs`:

### 4.1. Window Management & Vòng đời Cửa sổ
| Command | Tham số (Parameters) | Kiểu trả về (Return Type) |
| :--- | :--- | :--- |
| `open_repo_dialog` | `app: AppHandle, window: WebviewWindow, force_new_window: Option<bool>` | `Result<Option<OpenRepoOutcome>, String>` |
| `open_repo_by_path` | `app: AppHandle, window: WebviewWindow, repo_path: String, force_new_window: Option<bool>` | `Result<OpenRepoOutcome, String>` |
| `get_window_startup_context` | `window: WebviewWindow, manager: State<'_, WindowManagerState>` | `Result<WindowStartupContext, String>` |
| `create_new_window` | `app: AppHandle` | `Result<String, String>` |
| `close_repository_window` | `app: AppHandle, window: WebviewWindow` | `Result<(), String>` |
| `window_minimize` | `window: Window` | `Result<(), String>` |
| `window_toggle_maximize` | `window: Window` | `Result<bool, String>` |
| `window_close` | `window: Window` | `Result<(), String>` |
| `window_is_maximized` | `window: Window` | `Result<bool, String>` |
| `window_is_fullscreen` | `window: Window` | `Result<bool, String>` |
| `window_show` | `window: Window` | `Result<(), String>` |
| `open_webview_devtools` | `window: WebviewWindow` | `Result<(), String>` |
| `restart_app` | `app: AppHandle` | `Result<(), String>` |

### 4.2. Quản lý Repository & Thư mục
| Command | Tham số (Parameters) | Kiểu trả về (Return Type) |
| :--- | :--- | :--- |
| `validate_repo` | `repo_path: String` | `Result<RepoValidation, String>` |
| `get_recent_repos` | `app: AppHandle` | `Result<Vec<RepoInfo>, String>` |
| `delete_recent_repo` | `app: AppHandle, id: String` | `Result<(), String>` |
| `clear_recent_repos` | `app: AppHandle` | `Result<(), String>` |
| `update_recent_repositories_menu` | `app: AppHandle, repositories: Vec<RepoInfo>` | `Result<(), String>` |
| `pick_folder` | `app: AppHandle` | `Result<Option<String>, String>` |
| `check_remote_repo_url` | `url: String` | `Result<String, String>` |
| `clone_repository` | `url: String, target_dir: String, branch: Option<String>` | `Result<String, String>` |

### 4.3. Git Diff, Xung đột & Thanh tra Mã nguồn
| Command | Tham số (Parameters) | Kiểu trả về (Return Type) |
| :--- | :--- | :--- |
| `get_branches` | `repo_path: String` | `Result<BranchList, String>` |
| `get_mr_diff` | `app: AppHandle, repo_path: String, base: String, compare: String` | `Result<MrDiffPayload, String>` |
| `check_merge_conflicts`| `app: AppHandle, repo_path: String, base: String, compare: String` | `Result<ConflictReport, String>` |
| `get_conflicted_file_preview` | `app: AppHandle, repo_path: String, base: String, compare: String, file_path: String` | `Result<ConflictFilePreview, String>` |
| `get_file_blame` | `repo_path: String, file_path: String, revision: Option<String>, ignore_whitespace: Option<bool>` | `Result<FileBlamePayload, String>` |
| `check_rebase_status` | `repo_path: String` | `Result<bool, String>` |
| `get_commits_between_refs` | `repo_path: String, base: String, compare: String` | `Result<Vec<GitCommitItem>, String>` |
| `get_git_user_identity_cmd`| `repo_path: String` | `Result<(String, String), String>` |

### 4.4. Thao tác Git Nâng cao (Ops: Remote, Sync, Tag, Branch)
| Command | Tham số (Parameters) | Kiểu trả về (Return Type) |
| :--- | :--- | :--- |
| `run_git_sync` | `repo_path: String, operation: String, options: Option<GitSyncOptions>` | `Result<String, String>` |
| `list_git_remotes` | `repo_path: String` | `Result<Vec<String>, String>` |
| `get_git_remote_url` | `repo_path: String, remote: Option<String>` | `Result<String, String>` |
| `list_git_remotes_detailed` | `repo_path: String` | `Result<Vec<GitRemoteDetail>, String>` |
| `add_git_remote` | `repo_path: String, name: String, url: String` | `Result<(), String>` |
| `remove_git_remote` | `repo_path: String, name: String` | `Result<(), String>` |
| `set_git_remote_url` | `repo_path: String, name: String, url: String` | `Result<(), String>` |
| `test_git_remote` | `repo_path: String, remote_or_url: String` | `Result<String, String>` |
| `list_git_tags` | `repo_path: String` | `Result<Vec<GitTagInfo>, String>` |
| `create_git_tag` | `repo_path: String, tag_name: String, commit_ref: Option<String>, message: Option<String>` | `Result<(), String>` |
| `delete_git_tag` | `repo_path: String, tag_name: String` | `Result<(), String>` |
| `create_git_branch` | `repo_path: String, branch_name: String, start_point: Option<String>` | `Result<(), String>` |
| `delete_git_branch` | `repo_path: String, branch_name: String, force: bool` | `Result<(), String>` |
| `rename_git_branch` | `repo_path: String, old_name: String, new_name: String` | `Result<(), String>` |

### 4.5. OS File & Process Integration
| Command | Tham số (Parameters) | Kiểu trả về (Return Type) |
| :--- | :--- | :--- |
| `reveal_file_in_os` | `repo_path: String, file_path: String` | `Result<(), String>` |
| `open_repo_in` | `repo_path: String, target: String` | `Result<(), String>` |
| `open_file_in_editor` | `repo_path: String, file_path: String, editor: Option<String>, line: Option<u32>, col: Option<u32>` | `Result<(), String>` |

### 4.6. Credentials & OS Keyring (Git & AI Secrets)
| Command | Tham số (Parameters) | Kiểu trả về (Return Type) |
| :--- | :--- | :--- |
| `list_git_credentials` | `app: AppHandle` | `Result<Vec<GitCredentialMeta>, String>` |
| `save_git_credential` | `app: AppHandle, payload: SaveGitCredentialPayload` | `Result<GitCredentialMeta, String>` |
| `delete_git_credential`| `app: AppHandle, id: String` | `Result<(), String>` |
| `verify_git_credential`| `app: AppHandle, id: String` | `Result<bool, String>` |
| `get_keyring_info` | *không có* | `OsKeyringInfo` |
| `store_ai_api_key` | `provider: String, api_key: String` | `Result<(), String>` |
| `get_ai_api_key` | `provider: String` | `Result<Option<String>, String>` |
| `delete_ai_api_key` | `provider: String` | `Result<(), String>` |

### 4.7. Quản lý Môi trường Sandbox
| Command | Tham số (Parameters) | Kiểu trả về (Return Type) |
| :--- | :--- | :--- |
| `get_available_sandboxes` | `app: AppHandle` | `Result<Vec<SandboxAdapterInfo>, String>` |
| `get_active_sandbox` | `app: AppHandle` | `Result<SandboxAdapterInfo, String>` |
| `set_active_sandbox` | `app: AppHandle, adapter_type: SandboxType` | `Result<(), String>` |
| `create_sandbox_instance`| `app: AppHandle, repo_path: String, base: String, compare: String` | `Result<SandboxInstanceInfo, String>` |
| `destroy_sandbox_instance` | `app: AppHandle, instance_id: String` | `Result<(), String>` |
| `list_sandbox_instances` | `app: AppHandle` | `Result<Vec<SandboxInstanceInfo>, String>` |
| `execute_sandbox_command`| `app: AppHandle, instance_id: String, command: String, args: Vec<String>` | `Result<SandboxExecutionResult, String>` |

### 4.8. Cấu hình Repo, Labels & Virtual MR
| Command | Tham số (Parameters) | Kiểu trả về (Return Type) |
| :--- | :--- | :--- |
| `get_repo_settings` | `app: AppHandle, repo_id: String` | `Result<Option<RepoSettingsDb>, String>` |
| `save_repo_settings` | `app: AppHandle, settings: RepoSettingsDb` | `Result<(), String>` |
| `list_repo_labels` | `app: AppHandle, repo_id: String` | `Result<Vec<RepoLabelDb>, String>` |
| `create_repo_label` | `app: AppHandle, label: RepoLabelDb` | `Result<(), String>` |
| `update_repo_label` | `app: AppHandle, label: RepoLabelDb` | `Result<(), String>` |
| `delete_repo_label` | `app: AppHandle, id: String` | `Result<(), String>` |
| `list_virtual_mr_sessions`| `app: AppHandle, repo_id: String` | `Result<Vec<VirtualMrSessionDb>, String>` |
| `save_virtual_mr_session` | `app: AppHandle, session: VirtualMrSessionDb` | `Result<(), String>` |
| `delete_virtual_mr_session`| `app: AppHandle, session_id: String` | `Result<(), String>` |

### 4.9. Discussions & Comments
| Command | Tham số (Parameters) | Kiểu trả về (Return Type) |
| :--- | :--- | :--- |
| `list_mr_discussions` | `app: AppHandle, session_id: String` | `Result<Vec<VirtualMrDiscussionDb>, String>` |
| `create_mr_discussion` | `app: AppHandle, discussion: VirtualMrDiscussionDb, first_comment: VirtualMrCommentDb` | `Result<(), String>` |
| `add_mr_comment` | `app: AppHandle, comment: VirtualMrCommentDb` | `Result<(), String>` |
| `resolve_mr_discussion` | `app: AppHandle, discussion_id: String, is_resolved: bool, resolve_type: String, resolved_by: Option<String>` | `Result<(), String>` |
| `verify_mr_discussion` | `app: AppHandle, discussion_id: String, verification_status: String, verified_by_bot: String, pass: bool` | `Result<(), String>` |

### 4.10. Quản lý Git Binary Đa Nguồn
| Command | Tham số (Parameters) | Kiểu trả về (Return Type) |
| :--- | :--- | :--- |
| `scan_git_binaries` | `app: AppHandle` | `Result<Vec<GitBinaryInfo>, String>` |
| `get_active_git_binary` | `app: AppHandle` | `Result<GitBinaryInfo, String>` |
| `set_active_git_binary` | `app: AppHandle, id: String, path: String` | `Result<GitBinaryInfo, String>` |
| `validate_custom_git_binary` | `path: String` | `Result<GitBinaryInfo, String>` |
| `pick_git_executable` | `app: AppHandle` | `Result<Option<String>, String>` |

---

## 5. Cơ Chế Xử Lý Git Hiện Tại

### 5.1. Kiến Trúc Gọi Lệnh Git
- **Phương thức thực thi:** Sử dụng trực tiếp `std::process::Command` trong module [`runner.rs`](backend/src/git/runner.rs) thay vì `libgit2` (để tận dụng 100% các tính năng hiện đại nhất của Git CLI như `merge-tree --write-tree`, không bị giới hạn bởi binding C cũ).
- **Hạn chế Command Injection:** 
  - Toàn bộ tham số biến đổi (ref name, commit hash) đều đi qua cờ `--end-of-options` để ngăn chặn việc chèn cờ Git CLI trái phép (e.g. `-o`, `--output`).
  - Kiểm tra ký tự điều khiển, dấu cách và ký tự `-` khởi đầu thông qua `resolve_ref()`.
- **Cơ chế Chuyển đổi Git Binary:**
  - `runner.rs` lưu trữ `ACTIVE_GIT_PATH: RwLock<Option<String>>`. Khi người dùng chỉ định Git hệ thống, Git bundled hoặc custom Git trong Preferences, toàn bộ các hàm gọi Git sau đó sẽ tự động trỏ về binary này.
- **Bất đồng bộ & Tránh nghẽn Runtime:**
  - Mọi hàm Git đều được gói bên trong `tauri::async_runtime::spawn_blocking` trong [`commands.rs`](backend/src/commands.rs) để chạy trên thread pool riêng biệt, không block main thread và không làm đơ giao diện React.

### 5.2. Các Tính Năng Git Cốt Lõi Đã Viết

1. **Dự Đoán Xung Đột Merge Không Chạm Đĩa (`conflict.rs`):**
   - **Lệnh cốt lõi:** `git merge-tree --write-tree <effective_base> <effective_compare>`
   - **Nguyên lý:** Phân tích trực tiếp cây thư mục (tree object) trong database Git mà **không cần checkout nhánh**, không tạo tệp tạm, không ghi đè bất kỳ tệp nào trong working directory của người dùng.
   - **Xử lý kết quả:** Bắt các dòng `CONFLICT (<type>): Merge conflict in <file>` từ stdout/stderr để trích xuất danh sách file bị xung đột, loại xung đột và vùng diff marker (`<<<<<<<`, `=======`, `>>>>>>>`).

2. **Tính Toán Virtual MR 3-Dot Diff (`diff.rs`):**
   - **Lệnh:** `git diff -U3 --end-of-options <base>...<compare>`, kết hợp `git diff --name-status` và `git diff --numstat`.
   - **Trần an toàn IPC (IPC Ceiling):** Giới hạn raw diff ở mức tối đa **5MB** (`MAX_RAW_DIFF_BYTES`). Nếu diff vượt quá giới hạn, chuỗi diff sẽ được cắt gọn và đính kèm cảnh báo để ngăn WebView bị tràn bộ nhớ (OOM).

3. **Chống Path Traversal trong Repository (`git/mod.rs`):**
   - Hàm `resolve_safe_repo_path(repo_root, relative_path)` kiểm tra thành phần đường dẫn, cấm dấu `..` thoát khỏi root của repo, kiểm tra drive prefix và canonicalize đường dẫn tuyệt đối trước khi thao tác file.

4. **Quét Blame Từng Dòng (`blame.rs`):**
   - `git blame --line-porcelain` để bóc tách commit hash, tác giả, email, timestamp và nội dung từng dòng mã.

---

## 6. Môi Trường Sandbox Hiện Tại

Hệ thống Sandbox được thiết kế theo mẫu **Strategy Pattern** thông qua trait `SandboxAdapter` và được quản lý tập trung bởi struct `SandboxManager` (`backend/src/sandbox/manager.rs`). Hiện tại có **3 Adapter** đã được hiện thực hoàn chỉnh:

### 6.1. InMemorySandboxAdapter (`in_memory.rs`) - Mặc Định
- **Nguyên lý:** Hoạt động hoàn toàn trên RAM và Git Object Database. Toàn bộ diff và dự đoán xung đột gọi trực tiếp `git merge-tree` và `git diff`.
- **Đặc điểm:**
  - `can_run_commands`: `false`
  - `can_write_files`: `false`
  - `isolation_level`: `"in_memory"`
  - `requires_daemon`: `false`
- **Ứng dụng:** Xem diff, dự đoán xung đột an toàn tuyệt đối 100%, không để lại bất kỳ rác dữ liệu nào trên đĩa cứng.

### 6.2. LocalWorktreeSandboxAdapter (`local_worktree.rs`)
- **Nguyên lý:** Tạo một Git Worktree cô lập nằm ngoài thư mục dự án của người dùng.
- **Thư mục lưu trữ tạm:** `%TEMP%/stage0-worktrees/` (Windows) hoặc `/tmp/stage0-worktrees/` (macOS/Linux).
- **Vòng đời:**
  1. `create_instance`: Chạy `git worktree add -f <temp_path> <compare_branch>`.
  2. `execute_command`: Chạy các lệnh kiểm thử và build trực tiếp trong thư mục worktree tạm.
     - **Chốt bảo mật nghiêm ngặt:** Chặn Path Traversal trong lệnh, cấm ký tự null byte (`\0`), và bắt buộc binary phải nằm trong danh sách trắng **`ALLOWED_COMMANDS`**:
       `["git", "cargo", "rustc", "npm", "npx", "pnpm", "yarn", "bun", "node", "deno", "go", "python", "python3", "pytest", "mvn", "gradle", "make", "cmake", "dotnet"]`.
  3. `destroy_instance`: Chạy `git worktree remove --force <temp_path>` và xóa hoàn toàn thư mục trên đĩa.

### 6.3. DockerSandboxAdapter (`docker.rs`)
- **Nguyên lý:** Sử dụng Docker Daemon trên máy chủ để khởi tạo container chạy nền với volume mount thư mục repository vào container (`/workspace`).
- **Lệnh điều khiển:**
  - Kiểm tra daemon: `docker version --format {{.Server.Version}}`.
  - Khởi tạo container: `docker run -d --name stage0-<uuid> -v <repo_path>:/workspace -w /workspace <image> tail -f /dev/null` (mặc định dùng `alpine:latest` hoặc custom image).
  - Thực thi lệnh: `docker exec <container_id> <command> <args...>`.
  - Dọn dẹp: `docker rm -f <container_id>`.
- **Đặc điểm:** Phân lập cấp container, hỗ trợ networking, an toàn khi chạy các đoạn mã chưa được kiểm duyệt từ PR.

### 6.4. Lưu Trữ Dữ Liệu Ứng Dụng (AppData)
- Cơ sở dữ liệu SQLite `local_mr.db` được đặt tại thư mục AppData chuẩn của hệ điều hành:
  - Windows: `%APPDATA%\com.localmr.app\` (hoặc `%USERPROFILE%\.local-virtual-mr\`).
  - macOS: `~/Library/Application Support/com.localmr.app/`.
  - Linux: `~/.config/com.localmr.app/` hoặc `$XDG_DATA_HOME`.
- **Bảo mật thư mục và DB:**
  - Trên Unix, áp dụng quyền `0o700` cho thư mục AppData và `0o600` cho file `.db`.
  - Từ chối khởi tạo nếu đường dẫn trỏ tới là Symbolic Link (`reject_symlink`) để phòng chống Symlink Poisoning / Hijacking.
