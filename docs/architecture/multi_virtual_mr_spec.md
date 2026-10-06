# Kiến trúc Kỹ thuật: Quản lý Nhiều Virtual MR/PR trên 1 Repository (Multi-Session Virtual MR)

> **Trạng thái:** Bản thảo kỹ thuật (Technical Specification / RFC)  
> **Phiên bản:** v2.0.0  
> **Áp dụng cho:** Stage0 Desktop Engine  

---

## 1. Đặt vấn đề & Triết lý Thiết kế (Design Philosophy)

### 1.1. Hiện trạng & Nhu cầu
Khi mở một Git repository trong Stage0, mô hình hiện tại chỉ duy trì một phiên so sánh nhánh duy nhất:
$$\text{Workspace State} = \langle \text{compareBranch} \rightarrow \text{baseBranch} \rangle$$

Tuy nhiên trong quy trình phát triển phần mềm hiện đại, lập trình viên thường xuyên:
1. **Làm việc đa nhiệm nhiều nhánh (Multi-Tasking)**: Vừa phát triển `feat/auth`, vừa hotfix `fix/cache-bug`, vừa review nhánh của đồng nghiệp `refactor/api`.
2. **So sánh 1 nhánh với nhiều đích (Cross-Target Validation)**: So sánh nhánh tính năng vào cả `main` và `staging`/`develop` để kiểm tra khả năng tích hợp và xung đột tiềm ẩn.
3. **Chuỗi nhánh phụ thuộc (Stacked Diffs / Dependent PRs)**: Làm việc theo chuỗi $\text{main} \leftarrow \text{pr-1} \leftarrow \text{pr-2} \leftarrow \text{pr-3}$.
4. **Chuẩn bị & Review trước khi đẩy lên Remote (Pre-Flight Local Review)**: Mong muốn có một môi trường xem xét, bình luận cùng AI Bot, phân loại nhãn và kiểm tra code tương tự như GitLab Merge Request hay GitHub Pull Request ngay trên máy tính mà không cần push commit nháp lên server.

### 1.2. Triết lý Virtual MR/PR: Môi trường Review Cục bộ Độc lập
Một **Virtual MR/PR** trong Stage0 là một phiên giả lập quy trình Pull Request / Merge Request hoàn chỉnh chạy hoàn toàn cục bộ, sở hữu đầy đủ các thuộc tính và tương tác như GitHub PR / GitLab MR.

> [!IMPORTANT]
> **Ba điểm loại trừ và giới hạn cốt lõi so với GitLab/GitHub:**
> 1. **KHÔNG có hành động Merge (No Merge)**: Virtual MR/PR không thực hiện hòa trộn code vào nhánh đích thật của repository. Việc merge thuộc về quy trình Git thực tế hoặc trên nền tảng Git remote sau khi code được review và push chính thức.
> 2. **KHÔNG có hành động Resolve Conflicts trực tiếp trong Virtual MR (No In-MR Conflict Resolution)**: Virtual MR chỉ **dự đoán xung đột (Predictive Conflict Detection)**, hiển thị danh sách xung đột dạng 3-way merge và hỗ trợ AI phân tích giải pháp. Việc resolve conflict trong mã nguồn thật được thực hiện thông qua quy trình rebase/merge chuẩn của Git hoặc Sandbox Worktree chuyên biệt.
> 3. **KHÔNG chỉnh sửa mã nguồn trực tiếp trong ứng dụng (No In-App Code Editing)**: Stage0 đóng vai trò là **Môi trường Sandbox Review**, không phải là một Code Editor/IDE đầy đủ. Ứng dụng **không cho phép sửa file trực tiếp và không tự động áp bản vá (auto-apply code suggestions)** vào working tree thật của người dùng. Mọi nhận xét, yêu cầu sửa đổi do AI Agent Bot đưa ra bắt buộc **Developer phải tự mở Code Editor/IDE riêng (VS Code, Cursor, Zed, JetBrains, Neovim...) để sửa code và commit**. Stage0 chỉ làm cầu nối mở file tại dòng cần sửa và ghi nhận trạng thái Resolved của thảo luận sau khi code đã được sửa xong.

### 1.3. Mục tiêu kỹ thuật cốt lõi
- **Không giới hạn số lượng Virtual MR song song** trên cùng 1 repository đang mở.
- **Không thay đổi working tree/index khi review**: Các phép so sánh và dự đoán xung đột không checkout hoặc merge vào working tree/index. Git có thể ghi object vào object database; metadata review được lưu trong SQLite cục bộ, còn sandbox worktree/Docker có thể tạo dữ liệu riêng theo cấu hình.
- **Hot-Switching (<50ms)**: Cache diff, conflict status, file selection và discussions riêng biệt cho từng phiên để chuyển tab ngay lập tức.
- **Trải nghiệm Review chuẩn mực (GitLab/GitHub Parity)**: Hỗ trợ Title, Markdown Description, Assignee, Reviewer AI Agents, Discussions (Review, Comment, Approve/Request Changes, Resolve threads), Commits list, và Labels.
- **Seamless IDE Hand-off**: Cung cấp các thao tác chuyển tiếp nhanh (Deep Links) từ dòng comment của AI Bot sang IDE ngoài của developer để fix code.

---

## 2. Đặc tả Chi tiết của 1 Virtual MR/PR (Virtual MR/PR Specification)

Một Virtual MR/PR trong Stage0 được mô hình hóa theo các đặc tả tiêu chuẩn của GitLab MR và GitHub PR, được tinh chỉnh cho môi trường Local-First & AI-First.

```text
┌────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│  [Open]  feat(auth): Add OAuth2 PKCE login flow  #vmr-01                     [Edit] [Approve] [Close]  │
├────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│  Assignee: QuocTA (Local User)    Reviewers: [🤖 Security Bot] [🤖 CodeStyle Bot] [+]                   │
│  Labels:   [feature] [backend] [security] [+]                             Target: main ← feat/oauth2   │
├────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│  [Overview / Discussion]      [Commits (3)]      [Changes / Diff (12)]      [Conflict Report (0)]      │
└────────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

### 2.1. Title & Markdown Description
- **Title**: Tiêu đề tóm tắt của Virtual MR/PR (ví dụ: `feat(auth): Add OAuth2 PKCE login flow`). Mặc định được gợi ý từ commit message gần nhất hoặc tên nhánh nguồn (`compareBranch`), có thể chỉnh sửa inline hoặc qua dialog bất kỳ lúc nào.
- **Description (Markdown)**:
  - Hỗ trợ đầy đủ cú pháp GitHub Flavored Markdown (GFM): headings, task lists (`- [x] Done`), code blocks với syntax highlighting, tables, blockquotes, checklist.
  - Cho phép AI Agent tự động sinh nội dung PR description từ git diff (Auto-generate summary & release notes).
  - Lưu trữ dưới dạng văn bản Markdown thuần túy trong SQLite cục bộ.

### 2.2. Assignee (Người chịu trách nhiệm)
- Trong môi trường local desktop của Stage0, **Assignee luôn là User hiện tại ở local**.
- Thông tin định danh được tự động trích xuất từ Git local/global config:
  - `user.name` (ví dụ: `QuocTA`)
  - `user.email` (ví dụ: `quocta@example.com`)
  - Avatar đại diện: Tạo tự động theo chữ cái đầu hoặc Gravatar hash qua email.
- Không thể gán Assignee khác trừ khi người dùng cấu hình lại Git identity trong Repository Settings hoặc App Preferences.

### 2.3. Reviewers (Hội đồng Phê duyệt bằng AI Agent Bots)
- **Cơ chế Reviewers**: Luôn là các **AI Agent Bots** độc lập (tính năng nền tảng cho tương tác AI-Human pair programming).
- **Hỗ trợ Đa Agent (Multi-Agent Review)**: Người dùng có thể add nhiều Agent với các vai trò chuyên biệt cùng tham gia vào 1 Virtual MR:
  - `Security Auditor Bot`: Chuyên quét lỗ hổng OWASP, rò rỉ token/secret, validate input.
  - `Performance & Memory Bot`: Đánh giá độ phức tạp thuật toán, cấp phát bộ nhớ, query N+1.
  - `Code Style & Linting Bot`: Kiểm tra convention, naming, formatting, test coverage.
  - `Architecture Reviewer Bot`: Đánh giá tính module hóa, SOLID principles, breaking changes.
- Danh sách các bots được phép tham gia review được quản lý trong **Repository Settings** (thừa kế từ App Preferences).

### 2.4. Hệ thống Discussions, Review Lifecycle & Quy trình Resolve Comments ngoài IDE

Vì Stage0 hoạt động thuần túy như một **Sandbox Canvas**, quy trình trao đổi và giải quyết comment được phân định rạch ròi:

```text
┌─────────────────┐       ┌───────────────────────┐       ┌────────────────────────┐
│  AI Agent Bot   │ ────► │  Stage0 Sandbox View  │ ────► │  Developer's Ext IDE   │
│ (Review & Báo   │       │ (Hiển thị Diff, Lỗi,  │       │ (VS Code, Cursor, Zed) │
│  lỗi tại dòng)  │       │  Nút "Open in Editor")│       │ (Tự sửa code & commit) │
└─────────────────┘       └───────────┬───────────┘       └───────────┬────────────┘
                                      │                               │
                                      ▼                               ▼
                          ┌───────────────────────┐       ┌────────────────────────┐
                          │ User bấm "Resolve"    │ ◄──── │ Git Commit mới tạo ra  │
                          │ trên Stage0 Thread    │       │ trên branch nguồn      │
                          └───────────────────────┘       └────────────────────────┘
```

#### Hai cấp độ Discussion:
1. **General MR Discussion (Thảo luận chung toàn bộ PR)**:
   - Thảo luận tổng quan về kiến trúc, phạm vi thay đổi giữa User và các AI Agent Bots.
2. **Line-Level Diff Discussion (Bình luận trực tiếp trên dòng code trong Split/Unified Diff)**:
   - AI Bot phân tích diff và gắn nhận xét trực tiếp vào dòng mã cụ thể (`file_path`, `line_number`, `diff_side`).
   - Gắn kèm **Review Action Mark**: `Comment` (Góp ý), `Approve` (Phê duyệt), `Request Changes` (Yêu cầu sửa đổi).

#### Quy trình Resolve Comment & Tái Thẩm Định (Resolution & Re-verification Workflow):
1. **Tiếp nhận phản hồi trong Sandbox**: Developer đọc nhận xét/cảnh báo của AI Bot trên Diff Viewer của Stage0.
2. **Chuyển tiếp sang Editor ngoài (IDE Hand-off)**:
   - Tại mỗi thread comment, Stage0 cung cấp nút thao tác nhanh: **"Open in Editor at line"** (hỗ trợ URI Scheme: `vscode://file/{path}:{line}`, `cursor://file/{path}:{line}`, `zed://file/{path}:{line}`).
   - Phím tắt tiện ích: `Shift+Alt+R` (Mở file manager), `Ctrl+Shift+C` (Copy relative path), `Shift+Alt+C` (Copy absolute path).
3. **Developer tự sửa mã nguồn trong IDE**: Developer tự điều chỉnh logic code theo nhận xét trong editor của mình và thực hiện `git commit` trên nhánh `compareBranch`.
4. **Cập nhật và Tái Thẩm Định trên Stage0**:
   - Khi quay lại Stage0, developer nhấn `Ctrl+R` (*Refresh Diff*) hoặc hệ thống tự động phát hiện commit mới để nạp lại git diff trong sandbox.
   - Developer có hai phương thức để đóng thread thảo luận:
     - **Cách A: Yêu cầu AI Bot Tái Thẩm Định (`[🤖 Re-verify Fix]`)**: AI Bot đọc lại đoạn code mới sửa, tự động thẩm định và resolve nếu đạt.
     - **Cách B: Đóng thủ công (`[✔ Manual Resolve]`)**: Dành cho trường hợp false positive hoặc dev có chủ đích thiết kế riêng.

### 2.4.1. Cơ chế AI Re-Review & Verification (Kiểm tra lại sau khi Fix)

Để đảm bảo việc sửa code của developer thực sự khắc phục được lỗi mà AI Bot đã chỉ ra, Stage0 cung cấp hai cấp độ tái thẩm định:

```text
┌── 🤖 Security Bot: "Cảnh báo: secret_key đang được log ra console ở mức DEBUG." ─────────────┐
│ [↗ Open in IDE (L42)]  [Reply...]                                                            │
├────────────────────────────────────────────────────────────────────────────────────────────┤
│ 👤 QuocTA: "Đã mask dữ liệu nhạy cảm bằng hàm sanitize() ở commit a1b2c3d."                   │
│                                                                                            │
│ 🔘 [🤖 Re-verify Fix]   [✔ Manual Resolve]                                                 │
└────────────────────────────────────────────────────────────────────────────────────────────┘
```

#### 1. Tái Thẩm Định Cấp độ Thread (Thread-Level "Re-verify Fix")
- **Kích hoạt**: Developer bấm nút **`[🤖 Re-verify Fix]`** trực tiếp trên từng thread comment đang mở.
- **Ngữ cảnh gửi cho AI Bot (Verification Payload)**:
  - **Vấn đề ban đầu**: Nội dung nhận xét/yêu cầu thay đổi trước đó của Bot.
  - **Incremental Diff**: Git diff tương ứng với vùng code quanh dòng được comment giữa commit cũ và commit mới nhất.
  - **Full Context Snippet**: Đoạn code hoàn chỉnh sau khi sửa kèm 10 dòng lân cận.
- **Phản hồi của AI Bot**:
  - **Nếu ĐÃ ĐẠT (Pass)**:
    - Bot tự động phản hồi vào thread: *"Đã kiểm tra commit `a1b2c3d`. Vấn đề bảo mật đã được xử lý triệt để bằng `sanitize()`. Fix Verified!"*.
    - Hệ thống tự động chuyển `is_resolved = 1`, ghi nhận `resolve_type = 'ai_verified'`, `verified_by_bot = 'Security Bot'`.
    - Thread được gắn badge nổi bật: `[✔ AI-Verified by Security Bot]` và tự động thu gọn.
  - **Nếu CHƯA ĐẠT (Fail)**:
    - Bot reply phân tích cụ thể tại sao bản sửa vẫn chưa đạt hoặc chỉ ra lỗi mới phát sinh (ví dụ: *"Hàm sanitize() vẫn in ra độ dài key, cần bỏ hoàn toàn"*).
    - Cập nhật trạng thái `verification_status = 'fail'`, giữ nguyên trạng thái `Unresolved` và cờ `Changes Requested`.

#### 2. Tái Quét Toàn Diện Cấp độ Virtual MR (MR-Level Incremental Re-Review)
Dành cho trường hợp developer đẩy nhiều commit hoặc sửa đổi hàng loạt file:
- **Auto-Detection**: Stage0 giám sát HEAD commit của nhánh `compareBranch`. Khi có commit mới, banner thông báo xuất hiện:
  $$\text{New commits detected: } \texttt{a1b2c3d} \text{ (3 files changed)} \quad \longrightarrow \quad \mathbf{[Re-run Active Reviewers]}$$
- **Incremental Scanning**: Các AI Reviewer bots đang active sẽ quét diff tăng dần (`previous_head..new_head`).
- **Batch Resolution**:
  - Bot tự động duyệt qua toàn bộ các thread đang mở thuộc các file vừa được chỉnh sửa.
  - Tự động verify và đóng các thread đã được giải quyết thỏa đáng.
  - Tự động cập nhật tiến độ review tổng thể của MR (ví dụ: *Resolved 4/4 discussions $\rightarrow$ Tự động chuyển MR sang trạng thái `Approved`*).

#### 3. Bảng So sánh Hai Phương thức Resolve:

| Tiêu chí | AI-Verified Resolve (`Re-verify Fix`) | Manual Resolve (`Manual Resolve`) |
| :--- | :--- | :--- |
| **Bản chất** | Khách quan, tự động hóa với sự bảo chứng của AI | Chủ quan do Developer quyết định |
| **Ai đóng thread?** | **AI Reviewer Bot tự đóng** sau khi chạy kiểm thử logic | **Developer tự bấm đóng** |
| **Trường hợp áp dụng** | Kiểm tra logic phức tạp, bảo mật, convention, thuật toán | False Positive (AI hiểu sai ngữ cảnh), hoặc chủ ý kiến trúc riêng |
| **Dấu vết ghi nhận** | `resolve_type = 'ai_verified'`, badge `[✔ AI-Verified]` | `resolve_type = 'manual'`, ghi nhận user name |

### 2.5. Trạng thái của Virtual MR/PR (Status Lifecycle)
Virtual MR chỉ có 3 trạng thái rõ ràng, không có trạng thái Merged:

```text
       ┌───────────────┐
       │     Open      │ ◄── (Đang xem xét, review, sửa code)
       └───────┬───────┘
               │
       ┌───────┴───────┐
       ▼               ▼
┌──────────────┐ ┌────────────────┐
│   Approved   │ │ Closed/Declined│
└──────────────┘ └────────────────┘
```

1. **`Open`**: Trạng thái mặc định khi khởi tạo. Cả User và AI Agents có thể tiếp tục comment, push thêm commit mới trên nhánh nguồn, cập nhật diff.
2. **`Approved`**: Đã được phê duyệt (khi các AI Reviewer bots cần thiết hoặc người dùng xác nhận đạt yêu cầu chất lượng). Lúc này developer tự tin có thể push nhánh lên Git remote thật để mở PR/MR chính thức.
3. **`Closed / Declined`**: Đã đóng hoặc từ chối phiên review. Giữ lại toàn bộ lịch sử comment và ghi chú để tra cứu sau này, nhưng tab được đưa vào lưu trữ (archived).

### 2.6. Commits List & Commit Inspection
- Hiển thị danh sách toàn bộ các commit nằm trong phạm vi so sánh:
  $$\text{Commit Range} = \text{baseBranch}..\text{compareBranch}$$
- Thông tin từng commit: Commit Hash (short & full), Commit Message (subject & body), Author (Tên & Email), Authored Time, thống kê số file thay đổi (+Additions / -Deletions).
- Nhấp vào một commit cụ thể sẽ lọc diff viewer chỉ hiển thị thay đổi do commit đó tạo ra.

### 2.7. Hệ thống Labels (Quản lý theo Repository-Level)
- Cho phép gắn một hoặc nhiều nhãn (labels) vào Virtual MR để tiện tìm kiếm, lọc và phân loại:
  - Loại công việc: `feature`, `bugfix`, `refactor`, `hotfix`, `documentation`.
  - Độ ưu tiên: `p0-urgent`, `p1-high`, `p2-medium`.
  - Trạng thái review: `needs-review`, `ai-approved`, `changes-requested`.
- **Lưu ý kiến trúc đặc thù**: Danh sách Labels được **quản lý độc quyền trong Repository Settings**, KHÔNG nằm trong App Preferences toàn cục, nhằm đảm bảo nhãn gắn liền với quy chuẩn riêng của từng dự án.

---

## 3. Thiết kế Hộp thoại Cài đặt Repository (Repository Settings Dialog)

### 3.1. Phân định Trách nhiệm: Repository Settings vs. App Preferences

| Tiêu chí | App Preferences (Toàn cục) | Repository Settings (Theo từng Repo) |
| :--- | :--- | :--- |
| **Phạm vi (Scope)** | Toàn bộ ứng dụng Stage0 trên máy tính | Riêng biệt cho từng repository đang mở |
| **Vị trí lưu trữ** | LocalStorage / `app_preferences.json` | Bảng `repo_settings` trong SQLite cục bộ |
| **Nội dung cấu hình** | Theme, Editor font, ligatures, inline blame, danh mục Global AI Providers & API Keys (Gemini, Claude, OpenAI, Ollama) | Git Remotes, Branches & Tags mặc định, Danh mục Labels của repo, Phân quyền & Custom prompt cho AI Agent Bots |

### 3.2. Cấu trúc UI của Repository Settings Dialog

Hộp thoại được kích hoạt qua menu:  
`Repository` $\rightarrow$ `Repository Settings...` (Phím tắt: `Ctrl+,` khi đang trong ngữ cảnh repository, hoặc nút icon bánh răng trên Repo Header).

Giao diện gồm Sidebar bên trái và Content bên phải chia thành 4 tabs chính:

```text
┌── Repository Settings ────────────────────────────────────────────────────────────────────────── ✕ ──┐
│ ┌───────────────┐ ┌───────────────────────────────────────────────────────────────────────────────┐ │
│ │ 🌐 Remotes    │ │ Git Remotes Management                                     [+ Add Remote]     │ │
│ │ 🌿 Branches/Tags │ origin    https://github.com/my-org/my-project.git  (fetch & push)  [Edit] [🗑] │ │
│ │ 🏷️ Labels     │ │ upstream  https://github.com/upstream/my-project.git (fetch only)    [Edit] [🗑] │ │
│ │ 🤖 AI Reviewers│ │                                                                               │ │
│ └───────────────┘ │ [Test Connection]                                                             │ │
│                   └───────────────────────────────────────────────────────────────────────────────┘ │
│                                                                                  [Cancel]  [Save]   │
└─────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

#### Tab 1: Quản lý Remote (Remote Management)
- **Danh sách remotes**: Hiển thị tất cả remotes hiện có (`origin`, `upstream`, fork remotes...).
- **Chi tiết từng remote**: Tên remote, Fetch URL, Push URL.
- **Thao tác**:
  - `Add Remote`: Thêm remote mới với tên và URL (SSH / HTTPS).
  - `Edit Remote`: Sửa URL hoặc đổi tên remote.
  - `Remove Remote`: Xóa remote cấu hình.
  - `Test Connection / Ping`: Thực hiện ping `git ls-remote` để kiểm tra kết nối mạng và quyền xác thực (SSH key / Personal Access Token).

#### Tab 2: Quản lý Branches và Tags (Branches & Tags Management)
- **Default Base Branch**: Thiết lập nhánh đích mặc định dùng khi tạo bất kỳ Virtual MR mới nào trong repo này (mặc định: `main` hoặc `develop`).
- **Quản lý Branches**:
  - Danh sách local branches và remote-tracking branches.
  - Badge chỉ báo: Nhánh hiện tại (`HEAD`), nhánh bảo vệ (protected), số commit ahead/behind so với default base.
  - Thao tác: Tạo branch mới từ ref bất kỳ, đổi tên branch, xóa branch an toàn (`git branch -d`) hoặc cưỡng chế (`git branch -D`).
- **Quản lý Tags**:
  - Danh sách tags theo thời gian hoặc ngữ nghĩa semver.
  - Xem thông tin commit mà tag trỏ tới, tag message (annotated tag).
  - Tạo tag mới (`Lightweight` hoặc `Annotated`) tại HEAD hoặc commit hash bất kỳ.
  - Xóa tag cục bộ và hỗ trợ đẩy xóa tag lên remote.

#### Tab 3: Quản lý Labels (Repository-Scoped Labels)
- **Danh sách Labels của repo**: Mỗi label gồm: Tên (Name), Mã màu hiển thị (Color Hex/Badge), Mô tả chi tiết (Description).
- **Thao tác**:
  - `Create Label`: Tạo label mới với color picker (có sẵn bảng màu Catppuccin / GitHub style).
  - `Edit Label`: Chỉnh sửa tên, đổi màu hoặc mô tả của nhãn.
  - `Delete Label`: Xóa nhãn (tự động gỡ nhãn khỏi các Virtual MRs của repo).
  - `Load Presets`: Nạp nhanh bộ nhãn tiêu chuẩn (GitHub Standard Labels, GitLab Workflow Labels, v.v.).

#### Tab 4: Quản lý AI Agent Bots được phép tham gia review (Reviewer Bots Policy)
- **Cơ chế Kế thừa (Inheritance Model)**:
  - Mặc định, checkbox **"Inherit AI Bots from App Preferences"** được kích hoạt. Repo sẽ thừa hưởng toàn bộ danh sách Bots và API Keys đã đăng ký ở cấp toàn cục.
- **Ghi đè theo dự án (Per-Repository Overrides)**:
  - Bật/tắt riêng từng bot cho repo này (ví dụ: Repo React Frontend thì tắt `Rust Auditor Bot`, chỉ giữ `TypeScript & React Bot`).
  - **Custom Repository Instructions / Rules**: Cho phép bổ sung System Prompt riêng cho các bot khi review trong repo này (ví dụ: *"Dự án này sử dụng Tailwind v4, không dùng styled-components; API endpoints phải theo chuẩn REST v2"*).
  - Cấu hình mức độ tự động review: Auto-trigger review khi mở Virtual MR hoặc chỉ review khi được User gán (assigned).

---

## 4. Các Mô hình Thiết kế UI/UX Không gian làm việc

### 4.1. Mô hình 1: Multi-Tab Workspace (Trung tâm điều khiển chính)
TabBar nằm trực tiếp dưới MenuBar, phản ánh trực quan các Virtual MR đang hoạt động:

```text
┌─────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ Stage0  File  Edit  View  Repository  Branch  Sandbox  Help                                          — □ ✕│
├─────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ [📁 stage0] │ [x] feat/auth → main 🟢 │ [x] fix/login → v1.2 ⚠️2 │ [x] refactor → main ⚪ │ [+]           │
├───────────────────────┬─────────────────────────────────────────────────────────────────────────────────┤
│ [Open] OAuth2 PKCE    │ [Overview]  [Commits (3)]  [Changes (14)]  [Discussions (2 unresolved)]         │
│ Assignee: QuocTA      │ ─────────────────────────────────────────────────────────────────────────────── │
│ Reviewers: [Security] │ Line 42: src/auth.rs                                                            │
│ Labels: [feature]     │   - let raw_token = token.clone();                                              │
│                       │   + let raw_token = sanitize(&token);                                           │
│                       │   ┌── 🤖 Security Bot: "Cảnh báo: secret_key đang được log ra console ở mức DEBUG." ─────────────┐│
│                       │   │ [↗ Open in IDE (L42)]  [Reply...]         [🤖 Re-verify Fix]  [✔ Manual Resolve]       ││
│                       │   └────────────────────────────────────────────────────────────────────────────────────────────┘│
└───────────────────────┴─────────────────────────────────────────────────────────────────────────────────┘
```

- **Tab Header**:
  - Tiêu đề tab: Hiển thị tên nhánh nguồn $\rightarrow$ đích hoặc tiêu đề tùy chỉnh.
  - Badge trạng thái conflict:
    - `🟢 Clean`: Hợp nhất trơn tru không xung đột.
    - `⚠️ 2 conflicts`: Phát hiện 2 vị trí xung đột.
    - `⚪ Computing`: Đang tính toán diff ngầm trên background.
  - Phím tắt tiện ích: `Ctrl+T` (Tạo Virtual MR mới), `Ctrl+W` (Đóng tab hiện tại), `Ctrl+Tab` (Chuyển tab liền kề), `Alt+1..9` (Nhảy tới tab 1-9).

### 4.2. Mô hình 2: Saved Virtual MRs Drawer (Sidebar Panel)
Tương tự như Pull Requests Panel trong GitHub Desktop:
- Hiển thị toàn bộ danh sách Virtual MRs của repo theo các nhóm: `Active / Open`, `Approved`, `Closed / Archived`.
- Cho phép tìm kiếm theo Title, lọc theo Label, lọc theo Reviewer Bot.
- Lưu trữ bền vững vào SQLite, mở app lại là nạp ngay lập tức.

### 4.3. Mô hình 3: Stacked PRs / Graph Dependency
- Hỗ trợ trực quan hóa chuỗi các Virtual MR phụ thuộc nhau:
  $$\text{main} \leftarrow \text{branch-1 (VMR #1)} \leftarrow \text{branch-2 (VMR #2)} \leftarrow \text{branch-3 (VMR #3)}$$
- Khi nhánh cơ sở `branch-1` có commit mới, hệ thống tự động kích hoạt **Cascade Re-check**: chạy lại dự đoán xung đột cho `VMR #2` và `VMR #3`.

---

## 5. Cấu trúc Dữ liệu & State Management

### 5.1. Database Schema Hoàn chỉnh (SQLite `local_mr.db`)

Tất cả các thực thể của Virtual MR, Discussions, Labels và Repo Settings được chuẩn hóa trong SQLite:

```sql
-- 1. Bảng cấu hình Repository Settings
CREATE TABLE IF NOT EXISTS repo_settings (
    repo_id TEXT PRIMARY KEY,
    default_base_branch TEXT DEFAULT 'main',
    inherit_global_agents BOOLEAN DEFAULT 1,
    custom_agent_rules TEXT,              -- Bổ sung quy tắc chung cho AI agents trong repo
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 2. Bảng quản lý Labels của từng Repository
CREATE TABLE IF NOT EXISTS repo_labels (
    id TEXT PRIMARY KEY,
    repo_id TEXT NOT NULL,
    name TEXT NOT NULL,
    color TEXT NOT NULL,                  -- Mã màu HEX ví dụ '#ef4444' hoặc Catppuccin color
    description TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(repo_id, name)
);

-- 3. Bảng quản lý Virtual MR Sessions
CREATE TABLE IF NOT EXISTS virtual_mr_sessions (
    id TEXT PRIMARY KEY,
    repo_id TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT,                     -- Nội dung mô tả chuẩn Markdown
    base_branch TEXT NOT NULL,
    compare_branch TEXT NOT NULL,
    status TEXT DEFAULT 'open',           -- 'open' | 'approved' | 'closed'
    assignee_name TEXT,                   -- Tên local user từ git config
    assignee_email TEXT,                  -- Email local user từ git config
    is_pinned BOOLEAN DEFAULT 0,
    sandbox_adapter_type TEXT DEFAULT 'in_memory',
    sandbox_instance_id TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 4. Bảng liên kết Virtual MR Session và Labels (N - N)
CREATE TABLE IF NOT EXISTS virtual_mr_session_labels (
    session_id TEXT NOT NULL,
    label_id TEXT NOT NULL,
    PRIMARY KEY(session_id, label_id),
    FOREIGN KEY(session_id) REFERENCES virtual_mr_sessions(id) ON DELETE CASCADE,
    FOREIGN KEY(label_id) REFERENCES repo_labels(id) ON DELETE CASCADE
);

-- 5. Bảng liên kết AI Agent Reviewers cho từng Session
CREATE TABLE IF NOT EXISTS virtual_mr_session_reviewers (
    session_id TEXT NOT NULL,
    agent_id TEXT NOT NULL,               -- ID định danh của AI Agent Bot
    agent_name TEXT NOT NULL,
    review_status TEXT DEFAULT 'pending', -- 'pending' | 'reviewing' | 'approved' | 'changes_requested' | 'commented'
    assigned_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY(session_id, agent_id),
    FOREIGN KEY(session_id) REFERENCES virtual_mr_sessions(id) ON DELETE CASCADE
);

-- 6. Bảng quản lý Discussion Threads
CREATE TABLE IF NOT EXISTS virtual_mr_discussions (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL,
    file_path TEXT,                       -- NULL nếu là thảo luận chung toàn MR
    diff_side TEXT,                       -- 'left' | 'right' | NULL
    line_number INTEGER,                  -- NULL nếu là file-level comment hoặc general comment
    commit_id TEXT,                       -- Commit hash tại thời điểm comment
    is_resolved BOOLEAN DEFAULT 0,        -- Trạng thái resolve thread
    resolve_type TEXT DEFAULT 'manual',   -- 'manual' | 'ai_verified'
    resolved_by TEXT,                     -- Tên người/bot đã bấm resolve
    resolved_at DATETIME,
    verification_status TEXT DEFAULT 'none', -- 'none' | 'verifying' | 'pass' | 'fail'
    verified_by_bot TEXT,                 -- Tên/ID của AI bot đã kiểm tra
    verified_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(session_id) REFERENCES virtual_mr_sessions(id) ON DELETE CASCADE
);

-- 7. Bảng quản lý từng Comment trong Discussion
CREATE TABLE IF NOT EXISTS virtual_mr_comments (
    id TEXT PRIMARY KEY,
    discussion_id TEXT NOT NULL,
    author_type TEXT NOT NULL,            -- 'user' | 'ai_agent'
    author_id TEXT NOT NULL,              -- 'local-user' hoặc agent_id
    author_name TEXT NOT NULL,
    author_avatar TEXT,
    body TEXT NOT NULL,                   -- Nội dung comment Markdown
    review_action TEXT,                   -- 'comment' | 'approve' | 'request_changes' | NULL
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(discussion_id) REFERENCES virtual_mr_discussions(id) ON DELETE CASCADE
);

-- Chỉ mục tối ưu tốc độ truy vấn
CREATE INDEX IF NOT EXISTS idx_vmr_repo ON virtual_mr_sessions(repo_id);
CREATE INDEX IF NOT EXISTS idx_discussions_session ON virtual_mr_discussions(session_id);
CREATE INDEX IF NOT EXISTS idx_comments_discussion ON virtual_mr_comments(discussion_id);
CREATE INDEX IF NOT EXISTS idx_labels_repo ON repo_labels(repo_id);
```

### 5.2. TypeScript Types Model (`frontend/features/virtual-mr/types/virtualMr.ts`)

```typescript
export type VirtualMrStatus = 'open' | 'approved' | 'closed';
export type ReviewActionType = 'comment' | 'approve' | 'request_changes';
export type ReviewerState = 'pending' | 'reviewing' | 'approved' | 'changes_requested' | 'commented';
export type AuthorType = 'user' | 'ai_agent';
export type ResolveType = 'manual' | 'ai_verified';
export type VerificationStatus = 'none' | 'verifying' | 'pass' | 'fail';

export interface RepoLabel {
  id: string;
  repoId: string;
  name: string;
  color: string;
  description?: string;
}

export interface VirtualMrComment {
  id: string;
  discussionId: string;
  authorType: AuthorType;
  authorId: string;
  authorName: string;
  authorAvatar?: string;
  body: string; // Markdown content
  reviewAction?: ReviewActionType;
  createdAt: string;
  updatedAt: string;
}

export interface VirtualMrDiscussion {
  id: string;
  sessionId: string;
  filePath?: string | null;
  diffSide?: 'left' | 'right' | null;
  lineNumber?: number | null;
  commitId?: string | null;
  isResolved: boolean;
  resolveType?: ResolveType;
  resolvedBy?: string | null;
  resolvedAt?: string | null;
  verificationStatus?: VerificationStatus;
  verifiedByBot?: string | null;
  verifiedAt?: string | null;
  comments: VirtualMrComment[];
  createdAt: string;
}

export interface VirtualMrReviewer {
  agentId: string;
  agentName: string;
  reviewStatus: ReviewerState;
  assignedAt: string;
}

export interface VirtualMrCommit {
  hash: string;
  shortHash: string;
  subject: string;
  body?: string;
  authorName: string;
  authorEmail: string;
  authoredDate: string;
}

export interface VirtualMrSession {
  id: string;
  repoId: string;
  title: string;
  description: string; // Markdown description
  baseBranch: string;
  compareBranch: string;
  status: VirtualMrStatus;
  assignee: {
    name: string;
    email: string;
    avatarUrl?: string;
  };
  reviewers: VirtualMrReviewer[];
  labels: RepoLabel[];
  discussions: VirtualMrDiscussion[];
  commits: VirtualMrCommit[];
  diffPayload: MrDiffPayload | null;
  conflictReport: ConflictReport | null;
  selectedFilePath: string | null;
  isPinned: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface RepoSettings {
  repoId: string;
  defaultBaseBranch: string;
  inheritGlobalAgents: boolean;
  customAgentRules?: string;
  activeAgentIds: string[];
}
```

### 5.3. Frontend Zustand Store Refactoring (`frontend/features/virtual-mr/store/useVirtualMrStore.ts`)

```typescript
interface VirtualMrState {
  // Session Registry
  sessions: VirtualMrSession[];
  activeSessionId: string | null;
  
  // Repo Settings & Labels
  repoSettings: RepoSettings | null;
  repoLabels: RepoLabel[];

  // Active Computed Selectors
  getActiveSession: () => VirtualMrSession | null;

  // Session Lifecycle Actions
  createSession: (baseBranch?: string, compareBranch?: string, title?: string) => Promise<string>;
  closeSession: (sessionId: string) => Promise<void>;
  switchSession: (sessionId: string) => void;
  updateSessionStatus: (sessionId: string, status: VirtualMrStatus) => Promise<void>;
  updateSessionDetails: (sessionId: string, title: string, description: string) => Promise<void>;

  // Labels Actions
  addLabelToSession: (sessionId: string, labelId: string) => Promise<void>;
  removeLabelFromSession: (sessionId: string, labelId: string) => Promise<void>;
  createRepoLabel: (label: Omit<RepoLabel, 'id'>) => Promise<RepoLabel>;
  deleteRepoLabel: (labelId: string) => Promise<void>;

  // Reviewers & Discussions Actions
  assignReviewerAgent: (sessionId: string, agentId: string) => Promise<void>;
  removeReviewerAgent: (sessionId: string, agentId: string) => Promise<void>;
  createDiscussion: (sessionId: string, payload: {
    filePath?: string;
    lineNumber?: number;
    diffSide?: 'left' | 'right';
    initialComment: string;
    reviewAction?: ReviewActionType;
  }) => Promise<void>;
  replyToDiscussion: (discussionId: string, body: string, reviewAction?: ReviewActionType) => Promise<void>;
  toggleResolveDiscussion: (discussionId: string, resolved: boolean) => Promise<void>;
  
  // Re-verification Actions
  reverifyDiscussionFix: (discussionId: string, agentId?: string) => Promise<boolean>;
  reverifyAllDiscussions: (sessionId: string) => Promise<void>;
}
```

---

## 6. Tích hợp Backend Engine, Sandbox & AI Agent Orchestration

### 6.1. Git Review Engine (No Working-Tree/Index Changes)
- Phép tính diff, commits range và kiểm tra xung đột giữa `compareBranch` và `baseBranch` được thực thi qua các lệnh Git trên Backend Rust. Conflict prediction có thể dùng `git merge-tree --write-tree`; Git có thể ghi tree/blob objects vào object database, nhưng luồng review này không checkout hoặc merge vào working tree/index của người dùng.
- Luồng này không chủ động sửa `.git/index`. Khả năng chạy đồng thời và giới hạn hiệu năng phụ thuộc vào từng command, kích thước repository và giới hạn subprocess; không cam kết số lượng phiên đồng thời cố định hoặc hoàn toàn stateless.

### 6.2. Cơ chế Điều phối AI Agent Bots (AI Agent Orchestration)

#### 6.2.1. Luồng Review Khởi tạo (Initial Review)
1. **Context Preparation**: Khi người dùng assign một AI Bot hoặc bấm *"Request Review"*, hệ thống tổng hợp ngữ cảnh gồm:
   - Metadata của MR: Title, Description, Labels.
   - Commit history và thống kê files changed.
   - Raw diff và Conflict report.
   - Quy tắc dự án (Project Rules) lấy từ `RepoSettings`.
2. **Execution Flow**:
   - Backend Rust hoặc frontend gọi tới provider của bot (OpenAI, Anthropic Claude, Gemini, hoặc Local Ollama).
   - Bot phân tích và gửi trả danh sách các nhận xét kèm số dòng code cụ thể (`filePath`, `lineNumber`, `diffSide`, `body`, `review_action`).
3. **Persist Discussions**: Kết quả phân tích được tự động lưu vào bảng `virtual_mr_discussions` và `virtual_mr_comments`, hiển thị tức thì trên DiffViewer của người dùng.

#### 6.2.2. Luồng Tái Thẩm Định (AI Re-Verification Flow)
1. **Targeted Payload Generation**: Khi developer bấm `[Re-verify Fix]`, hệ thống không gửi toàn bộ repository diff mà chỉ trích xuất:
   - Comment ban đầu của Bot (lý do cảnh báo / yêu cầu sửa).
   - Commit message và git diff của riêng file/hunk vừa sửa giữa commit lúc bot comment và commit HEAD hiện tại.
   - Snippet code thực tế hiện thời.
2. **Bot Evaluation & Structured Output**:
   - Bot trả về kết quả dạng JSON: `{ "verdict": "pass" | "fail", "comment": "...", "suggested_action": "resolve" | "keep_open" }`.
3. **Auto-Resolution**:
   - Nếu `verdict == "pass"`, hệ thống tự động cập nhật `is_resolved = 1`, `resolve_type = 'ai_verified'`, `verified_by_bot = agent_id`, và ghi thêm 1 comment xác nhận của bot vào thread.

---

## 7. Lộ trình Triển khai (Execution Roadmap)

### Giai đoạn 1: Tab-based Multi-Session & New Repository Settings Dialog
1. **Repository Settings Dialog**:
   - Triển khai modal quản lý: Remotes, Branches & Tags, Repo-scoped Labels, AI Reviewers policy.
   - Lưu cấu hình vào bảng `repo_settings` và `repo_labels` trong SQLite.
2. **Multi-Tab Workspace**:
   - Triển khai `TabBar.tsx` với hot-switching (<50ms).
   - Quản lý danh sách `sessions: VirtualMrSession[]` trên frontend store.
   - Hỗ trợ tạo tab mới, đóng tab, chuyển tab bằng phím tắt.

### Giai đoạn 2: Đặc tả Đầy đủ Virtual MR/PR (GitLab/GitHub Parity)
1. **MR Overview & Details**:
   - UI hiển thị Header, Title inline edit, Markdown Description editor/viewer.
   - Hiển thị Assignee (Local user), Reviewers badge, Labels selector bar.
   - Thay đổi trạng thái MR: `Open` $\leftrightarrow$ `Approved` $\leftrightarrow$ `Closed/Declined`.
2. **Commits View**:
   - Tab Commits hiển thị danh sách commits trong khoảng `base..compare`.
   - Xem chi tiết từng commit diff.

### Giai đoạn 3: Threaded Discussions & External IDE Hand-off Workflow
1. **Inline & General Discussions**:
   - Bổ sung nút bấm tạo comment trực tiếp trên từng dòng diff trong Split/Unified view.
   - Cung cấp hành động: Comment, Approve mark, Request Changes mark.
2. **External IDE Integration (Hand-off)**:
   - Deep-linking mở file tại dòng comment trong IDE ngoài của developer (`vscode://`, `cursor://`, `zed://`).
   - Tự động phát hiện Git commit mới tạo ra từ IDE ngoài để nạp lại diff trong Sandbox.
3. **Discussion Resolution**:
   - Developer tự fix code ngoài IDE, sau đó nhấn Resolve / Unresolve conversation thread trên Stage0.
   - Bộ lọc xem unresolved threads và bộ đếm tiến độ review (ví dụ: *3 of 5 discussions resolved*).

### Giai đoạn 4: Tích hợp AI Agent Bots Reviewer & Re-Verification Engine
1. **AI Agent Registry & Execution**:
   - Tích hợp các mẫu Bots cơ bản: Code Quality Bot, Security Bot.
   - Hỗ trợ AI phản hồi vào thread hoặc tự động tạo review report.
2. **AI Re-Verification Engine**:
   - Tính năng `[Re-verify Fix]` trên từng thread và `Incremental Re-review` khi phát hiện commit mới.
   - Cơ chế tự động đóng thread khi AI thẩm định thành công (*AI-Verified Resolve*).
3. **Stacked PRs & Cascade Prediction**:
   - Liên kết chuỗi Virtual MR phụ thuộc và tự động cascade re-check khi có thay đổi.

---

*Tài liệu được quản lý và cập nhật theo tiêu chuẩn kiến trúc mã nguồn của Stage0.*
