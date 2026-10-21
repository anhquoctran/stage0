# Backend Codebase Architecture & Refactor Analysis

## 1. Overview & Context

Following the frontend refactoring (reducing monolithic components such as `DiffViewer`, `AiMcpTab`, `useVirtualMrStore`, `BotReviewersTab`, `GitGraphModal`, and `GuardrailsTab`) and modernizing `tsconfig.json` (removing obsolete `baseUrl`), this document audits and outlines the refactoring strategy for oversized files in the Rust backend (`backend/src/`).

Currently, several backend files exceed 700 to 1,600+ lines, accumulating multiple domain responsibilities, mixing IPC entrypoints with business logic, and complicating unit testing.

---

## 2. Inventory of Oversized Backend Files

| Priority | File Path | Line Count | Current Responsibilities |
|---|---|:---:|---|
| **Tier 1 (Critical)** | [`backend/src/features/review/runtime.rs`](file:///d:/stage0/backend/src/features/review/runtime.rs) | **1,679** | AI review execution orchestrator: session lifecycle, prompt assembly, streaming SSE/chunk parsing, evidence verification, retry/backoff, and recovery. |
| **Tier 1 (Critical)** | [`backend/src/features/preferences.rs`](file:///d:/stage0/backend/src/features/preferences.rs) | **1,598** | Application settings persistence, legacy JSON migrations, theme/font/window state handling, and atomic file read/writes. |
| **Tier 1 (Critical)** | [`backend/src/features/git/commands.rs`](file:///d:/stage0/backend/src/features/git/commands.rs) | **1,143** | Monolithic Tauri IPC command hub for all Git actions (status, diff, log, branches, stash, remotes, rebase, merge). |
| **Tier 2 (High)** | [`backend/src/features/review/context.rs`](file:///d:/stage0/backend/src/features/review/context.rs) | **850** | Diff context extraction, file chunking, MR metadata aggregation for review prompts. |
| **Tier 2 (High)** | [`backend/src/features/git/ops.rs`](file:///d:/stage0/backend/src/features/git/ops.rs) | **827** | Low-level Git CLI process spawning, argument construction, and libgit2 bindings. |
| **Tier 2 (High)** | [`backend/src/features/credentials/mod.rs`](file:///d:/stage0/backend/src/features/credentials/mod.rs) | **787** | OS keyring integration (Windows Credential Manager, SecretService, macOS Keychain). |
| **Tier 2 (High)** | [`backend/src/features/ai/acp.rs`](file:///d:/stage0/backend/src/features/ai/acp.rs) | **760** | Agent Client Protocol (ACP) process lifecycle, STDIO communication, and agent registry. |
| **Tier 3 (Medium)** | [`backend/src/core/db/mod.rs`](file:///d:/stage0/backend/src/core/db/mod.rs) | **698** | SQLite schema definitions, connection pool, migrations, and shared queries. |
| **Tier 3 (Medium)** | [`backend/src/features/sandbox/guardrails/guardrails_engine.rs`](file:///d:/stage0/backend/src/features/sandbox/guardrails/guardrails_engine.rs) | **612** | Command syntax parsing, regex inspection, and security verdict evaluation. |
| **Tier 3 (Medium)** | [`backend/src/features/review/provider.rs`](file:///d:/stage0/backend/src/features/review/provider.rs) | **593** | LLM provider abstraction, HTTP clients for OpenAI, Anthropic, Gemini, and Ollama. |

---

## 3. Detailed Decomposition Plan for Tier 1 Giants

### 3.1. `features/review/runtime.rs` (1,679 lines)
- **Problem**: Mixes session orchestration, SSE streaming parsing, evidence verification, and error recovery in one huge file.
- **Proposed Target Structure**:
  ```text
  backend/src/features/review/runtime/
  ├── mod.rs             # Public API & ReviewRuntime facade
  ├── session.rs         # Active review session state machine
  ├── streaming.rs       # Stream chunk parsing, token counters & SSE logic
  ├── validation.rs      # Coordinate verification & evidence check
  └── error.rs           # Review error types and recovery policies
  ```

### 3.2. `features/preferences.rs` (1,598 lines)
- **Problem**: Combines struct definitions with custom serde validators, disk persistence, and legacy version migrations.
- **Proposed Target Structure**:
  ```text
  backend/src/features/preferences/
  ├── mod.rs             # Public module & IPC commands re-export
  ├── models.rs          # Preference structs, enums & Default implementations
  ├── migration.rs       # Version migration logic (v0 -> v1 -> latest)
  ├── storage.rs         # Atomic JSON read/write operations on disk
  └── commands.rs        # Tauri IPC command handlers
  ```

### 3.3. `features/git/commands.rs` (1,143 lines)
- **Problem**: Houses dozens of independent Git commands in one contiguous file, making navigation and conflict resolution difficult.
- **Proposed Target Structure**:
  ```text
  backend/src/features/git/commands/
  ├── mod.rs             # Re-exports all command functions (zero breaking change to lib.rs)
  ├── status.rs          # get_git_status, get_repo_info
  ├── diff.rs            # get_diff, get_commit_diff, get_file_blame
  ├── branch.rs          # list_branches, create_branch, switch_branch
  ├── commit.rs          # commit, stage_file, unstage_file, revert
  ├── sync.rs            # fetch, pull, push, remotes
  └── conflict.rs        # 3-way conflict preview and merge simulation
  ```

---

## 4. Guiding Principles & Verification
1. **Zero IPC Breaking Changes**: Tauri command signatures (`#[tauri::command]`) and registration names in `backend/src/lib.rs` remain completely unchanged by re-exporting from module roots (`mod.rs`).
2. **Compilation & Ownership**:
   - `cargo check` and `cargo test` pass with 0 errors.
   - Respect single responsibility: separation of data types, disk I/O, IPC wrappers, and domain algorithms.
3. **Integration Safety**: All existing Node.js test harnesses in `scripts/*.test.mjs` continue to pass without modification.

