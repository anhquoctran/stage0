# Kiến trúc Kỹ thuật: Quản lý Nhiều Virtual MR/PR trên 1 Repository (Multi-Session Virtual MR)

> **Trạng thái:** Bản thảo kỹ thuật (Technical Specification / RFC)  
> **Phiên bản:** v1.0.0  
> **Áp dụng cho:** Stage0 Desktop Engine  

---

## 1. Đặt vấn đề & Mục tiêu

### 1.1. Hiện trạng
Hiện tại, khi mở một Git repository trong Stage0, hệ thống chỉ duy trì một phiên so sánh nhánh duy nhất tại một thời điểm:
$$\text{Workspace State} = \langle \text{compareBranch} \rightarrow \text{baseBranch} \rangle$$
Khi developer muốn xem xét một nhánh khác, họ phải thay đổi trực tiếp nhánh nguồn (`compareBranch`) hoặc nhánh đích (`baseBranch`), làm mất cache diff, báo cáo conflict và trạng thái file đang xem dở của nhánh trước đó.

### 1.2. Nhu cầu thực tế (User Pain Points)
1. **Làm việc đa nhiệm nhiều nhánh (Multi-Tasking)**: Developer thường xuyên phải chuyển đổi giữa nhiều feature branch (`feat/auth`, `fix/cache-bug`, `refactor/api`) để kiểm tra xung đột trước khi đẩy code lên GitLab/GitHub.
2. **So sánh 1 nhánh với nhiều đích (Cross-Target Validation)**: So sánh cùng một nhánh tính năng vào cả `main` và `staging`/`develop` để phát hiện xem nhánh nào sẽ bị conflict.
3. **Chuỗi nhánh phụ thuộc (Stacked Diffs / Dependent PRs)**: Làm việc theo mô hình chuỗi PR phụ thuộc ($\text{main} \leftarrow \text{pr-1} \leftarrow \text{pr-2} \leftarrow \text{pr-3}$).
4. **Giữ nguyên ngữ cảnh (Context Preservation)**: Chuyển đổi qua lại giữa các PR tức thì mà không phải chờ nạp lại git diff hay tính lại merge conflict.

### 1.3. Mục tiêu kỹ thuật
- Cho phép tạo **không giới hạn số lượng Virtual MR song song** trên cùng 1 repository đang mở.
- **Zero Disk Writes**: Đảm bảo toàn bộ các phiên so sánh đều chạy trên RAM và Git object store, không chạm vào working tree thật của máy tính.
- **Hot-Switching (<50ms)**: Cache diff, conflict prediction và file selection riêng biệt cho từng phiên để chuyển tab ngay lập tức.
- **Lưu trữ phiên (Session Persistence)**: Hỗ trợ lưu cấu hình các Virtual MR vào SQLite cục bộ để mở lại sau khi đóng app.

---

## 2. Các Mô hình Thiết kế UI/UX (User Experience)

### Mô hình 1: Multi-Tab Workspace (Được khuyến nghị ưu tiên)
Lấy cảm hứng từ hệ thống Tabs của trình duyệt và code editor hiện đại (Zed / VS Code / Fork Git Client):

```text
┌─────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ Stage0  File  Edit  View  Repository  Branch  Sandbox  Help                                          — □ ✕│
├─────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ [📁 my-repo]  │ [x] feat/auth → main  │ [x] fix/login → v1.2 ⚠️2 │ [x] refactor → main │ [+]            │
├───────────────────────┬─────────────────────────────────────────────────────────────────────────────────┤
│ Changed Files (14)    │ Comparing feat/auth into main (3-dot diff)                 [Split | Unified]    │
│  M src/auth.ts     +45│ ─────────────────────────────────────────────────────────────────────────────── │
│  A src/tokens.ts   +90│ ...                                                                             │
└───────────────────────┴─────────────────────────────────────────────────────────────────────────────────┘
```

- **TabBar**: Nằm trực tiếp dưới titlebar/topbar.
- **Tab Header**:
  - Tên nhánh hoặc tiêu đề tùy chỉnh (ví dụ: `feat/auth → main`).
  - Badge trạng thái conflict thời gian thực:
    - Icon xanh: `Merged clean (No conflicts)`
    - Icon vàng/đỏ: `⚠️ 2 conflicts`
  - Nút đóng tab `✕` (hoặc phím tắt `Ctrl+W`).
  - Nút `+` (hoặc phím tắt `Ctrl+T`) để tạo một Virtual MR mới.
- **Phím tắt điều hướng nhanh**:
  - `Ctrl + T`: Mở Virtual MR mới.
  - `Ctrl + W`: Đóng Virtual MR hiện tại.
  - `Ctrl + Tab` / `Ctrl + Shift + Tab`: Chuyển tab tiếp theo / trước đó.
  - `Alt + 1..9`: Chuyển nhanh đến Tab số 1..9.

---

### Mô hình 2: Saved Virtual MRs Drawer (Sidebar Panel)
Tương tự như danh sách Collections trong Postman hoặc Pull Requests Panel trong GitHub Desktop:

```text
┌── Virtual MRs ────────────── [+] ──┐
│ ● [Active] feat/auth → main        │
│   0 conflicts • 14 files changed   │
│                                    │
│ ○ fix/login → v1.2                 │
│   ⚠️ 2 conflicts • 3 files changed │
│                                    │
│ ○ refactor/api → feat/auth         │
│   0 conflicts • 8 files changed    │
└────────────────────────────────────┘
```

- Cho phép đặt tên gợi nhớ cho Virtual MR (ví dụ: *"Sprint 42 - Auth Migration"*).
- Cho phép gắn nhãn, ghi chú ghi nhớ (Markdown notes / review checklist).
- Lưu trữ lâu dài vào SQLite database, khởi động lại app là có ngay.

---

### Mô hình 3: Stacked PRs / Graph Dependency
- Mô hình đồ thị cây phụ thuộc dành cho các team áp dụng phong cách stacked diff:
  $$\text{main} \leftarrow \text{branch-1} \leftarrow \text{branch-2} \leftarrow \text{branch-3}$$
- Khi nhánh `branch-1` có commit mới, Stage0 tự động kích hoạt tính năng **Cascade Re-check**: kiểm tra xung đột lan truyền lên `branch-2` và `branch-3`.

---

## 3. Cấu trúc Dữ liệu & State Management

### 3.1. Database Schema (SQLite `local_mr.db`)

Thêm bảng `virtual_mr_sessions` liên kết với bảng `repositories`:

```sql
CREATE TABLE IF NOT EXISTS virtual_mr_sessions (
    id TEXT PRIMARY KEY,
    repo_id TEXT NOT NULL,
    title TEXT NOT NULL,
    base_branch TEXT NOT NULL,
    compare_branch TEXT NOT NULL,
    notes TEXT,
    is_pinned BOOLEAN DEFAULT 0,
    sandbox_adapter_type TEXT DEFAULT 'in_memory',
    sandbox_instance_id TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(repo_id) REFERENCES repositories(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_vmr_repo_id ON virtual_mr_sessions(repo_id);
```

### 3.2. TypeScript Types (`frontend/types/git.ts`)

```typescript
export interface VirtualMrSession {
  id: string;                          // UUID v4
  repoId: string;                      // ID của repository cha
  title: string;                       // Tên phiên (ví dụ: "feat/auth → main" hoặc do user đặt)
  baseBranch: string;                  // Nhánh đích (target)
  compareBranch: string;               // Nhánh nguồn (source)
  diffPayload: MrDiffPayload | null;   // Cache kết quả 3-dot diff (raw diff, files, additions, deletions)
  conflictReport: ConflictReport | null; // Cache kết quả kiểm tra xung đột
  selectedFilePath: string | null;     // File đang được focus xem diff
  activeSandboxType: SandboxType;      // in_memory | local_worktree | docker
  sandboxInstanceId: string | null;    // ID container/worktree sandbox nếu được cấp phát
  isPinned?: boolean;                  // Đánh dấu ghim không bị auto-close
  createdAt: string;
  updatedAt: string;
}
```

### 3.3. Refactor Store State (`frontend/store/useGitStore.ts`)

Chuyển đổi từ quản lý đơn lẻ (`baseBranch`, `compareBranch`) sang quản lý mảng phiên:

```typescript
interface GitState {
  // Session Management
  sessions: VirtualMrSession[];
  activeSessionId: string | null;

  // Active Session Selectors (Computed)
  activeSession: () => VirtualMrSession | null;

  // Session Actions
  createSession: (baseBranch?: string, compareBranch?: string, title?: string) => Promise<string>;
  closeSession: (sessionId: string) => Promise<void>;
  switchSession: (sessionId: string) => void;
  updateSessionBranches: (sessionId: string, base: string, compare: string) => Promise<void>;
  renameSession: (sessionId: string, newTitle: string) => Promise<void>;
  swapSessionBranches: (sessionId: string) => Promise<void>;
  pinSession: (sessionId: string, isPinned: boolean) => Promise<void>;
}
```

---

## 4. Tích hợp Backend Engine & Sandbox Adapter

### 4.1. In-Memory Sandbox Adapter (Concurrency Safety)
- Lệnh `git merge-tree --write-tree base compare` là **hoàn toàn thread-safe và stateless**.
- Nó không tạo lock file, không tạo thư mục con và không ghi dữ liệu lên ổ đĩa.
- Do đó, backend Rust có thể tính toán song song 10-20 Virtual MRs đồng thời trên đa luồng (`tokio::spawn` hoặc Rayon pool) với hiệu năng tối đa.

### 4.2. Local Worktree & Docker Sandbox Adapters (Isolation)
- Đối với các Virtual MR được kích hoạt chế độ **Local Worktree** hoặc **Docker Sandbox** (để chạy build/test/lint):
  - Mỗi `VirtualMrSession` sẽ được gán 1 `sandbox_instance_id` độc lập trong [manager.rs](file:///d:/stage0/backend/src/sandbox/manager.rs).
  - Worktree adapter sẽ checkout ra thư mục cô lập: `.stage0-sandboxes/<session_id>/`.
  - Docker adapter sẽ spawn container riêng: `stage0-sandbox-<session_id>`.
  - Khi đóng session (`closeSession`), hệ thống tự động dọn dẹp (cleanup) instance tương ứng để giải phóng tài nguyên.

---

## 5. Lộ trình Triển khai (Execution Roadmap)

### Giai đoạn 1: Tab-based In-Memory Sessions (Frontend-Only MVP)
1. Thêm component `TabBar.tsx` bên dưới `TopBar`.
2. Chuyển đổi `useGitStore` sang quản lý danh sách `sessions: VirtualMrSession[]`.
3. Lưu giữ cache diff và conflict riêng cho từng tab.
4. Hỗ trợ phím tắt `Ctrl+T`, `Ctrl+W`, `Ctrl+Tab`, `Alt+1..9`.

### Giai đoạn 2: Database Persistence & Session Drawer
1. Thêm bảng `virtual_mr_sessions` trong SQLite `schema.sql`.
2. Tạo các IPC commands trong Rust:
   - `save_virtual_mr_session`
   - `list_virtual_mr_sessions`
   - `delete_virtual_mr_session`
   - `update_virtual_mr_session`
3. Tự động khôi phục các tab khi mở lại repository.

### Giai đoạn 3: Advanced Stacked PRs & Sandbox Runner Binding
1. Hỗ trợ liên kết chuỗi nhánh phụ thuộc (Cascade conflict detection).
2. Tích hợp trực tiếp từng Session với một Instance của `LocalWorktreeSandboxAdapter` hoặc `DockerSandboxAdapter` để chạy kiểm thử tự động song song.

---

*Tài liệu được khởi tạo và quản lý trong kho lưu trữ mã nguồn của Stage0.*
