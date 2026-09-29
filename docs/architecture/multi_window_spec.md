# Kiến trúc Kỹ thuật: Hệ thống Đa Cửa Sổ (Multi-Window Architecture)

> **Trạng thái:** Bản thảo kỹ thuật (Technical Specification / RFC)  
> **Phiên bản:** v1.0.0  
> **Áp dụng cho:** Stage0 Desktop Engine (Tauri v2 + React 19)  

---

## 1. Mục tiêu & Nguyên tắc Bất biến (Core Invariants)

### 1.1. Mục tiêu
Cho phép người dùng mở đồng thời nhiều cửa sổ ứng dụng Stage0 độc lập, phục vụ việc đối chiếu, so sánh và kiểm tra merge conflict trên nhiều repository khác nhau trên máy tính cùng một lúc.

### 1.2. Nguyên tắc Bất biến: 1 Repo Duy nhất trên mỗi Cửa sổ
Hệ thống tuân thủ nghiêm ngặt nguyên tắc:
$$\forall \text{ Window } W_i, W_j \ (i \neq j): \quad \text{PhysicalPath}(W_i) \neq \text{PhysicalPath}(W_j)$$

1. **Tính duy nhất theo Physical Path (Đường dẫn vật lý trên đĩa)**:
   - Một repository trên đĩa chỉ được phép mở tại **tối đa một cửa sổ** tại một thời điểm.
   - Tránh hiện tượng 2 cửa sổ cùng thao tác, cùng lock file hoặc xung đột watcher trên cùng 1 cây thư mục `.git`.
2. **Cơ chế Chuyển tiếp Tiêu điểm (Focus Redirection)**:
   - Nếu người dùng cố gắng mở một repository đã được mở trong một cửa sổ khác (từ Menu, Recent Projects, Welcome Screen, hoặc CLI/Explorer) &rarr; Stage0 **không mở cửa sổ mới**, mà tự động **mang cửa sổ đang chứa repo đó lên đầu (Bring to Front), Unminimize và kích hoạt Focus**.
3. **Cửa sổ Khởi tạo (Empty / Welcome Window)**:
   - Cửa sổ chưa mở repo nào (đang ở Welcome Screen) có thể tiếp nhận repo mới ngay tại cửa sổ đó, hoặc người dùng có thể yêu cầu mở trong cửa sổ mới (*"Open in New Window"*).

---

## 2. Chuẩn hoá Đường dẫn Vật lý (Physical Path Canonicalization)

Hệ thống tập tin (đặc biệt trên Windows và macOS) tiềm ẩn nhiều vấn đề về đường dẫn trùng lặp logic:
- **Case-insensitivity**: `D:\Stage0` vs `d:\stage0` vs `D:/stage0`.
- **Dấu phân cách**: `/` vs `\`.
- **Symlinks & Junction points**: Thư mục symbolic link trỏ đến thư mục gốc.
- **Đường dẫn rút gọn (8.3 filenames)**: `C:\PROGRA~1` vs `C:\Program Files`.

### Giải pháp kỹ thuật (Rust Backend):
Mọi đường dẫn repo nhận vào **bắt buộc** phải đi qua hàm chuẩn hoá trước khi so khớp hoặc gán vào cửa sổ:

```rust
use std::path::{Path, PathBuf};
use dunce::canonicalize; // dunce loại bỏ tiền tố '\\?\' rườm rà trên Windows

pub fn canonicalize_repo_path<P: AsRef<Path>>(path: P) -> Result<PathBuf, String> {
    let p = path.as_ref();
    if !p.exists() {
        return Err("Repository path does not exist on disk".to_string());
    }
    
    // Chuẩn hoá symlink, junction, chữ hoa/thường
    let canonical = dunce::canonicalize(p)
        .map_err(|e| format!("Failed to canonicalize path {:?}: {}", p, e))?;

    // Đảm bảo là thư mục và có chứa .git
    if !canonical.is_dir() {
        return Err("Path is not a directory".to_string());
    }
    if !canonical.join(".git").exists() {
        return Err("Directory does not contain a valid .git folder".to_string());
    }

    Ok(canonical)
}
```

---

## 3. Kiến trúc Quản lý Cửa sổ ở Backend (Tauri v2 Core)

### 3.1. Trạng thái Quản lý Tập trung (`WindowManagerState`)

Tạo một state thread-safe quản lý vòng đời và ánh xạ giữa đường dẫn vật lý và cửa sổ:

```rust
use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::Mutex;
use tauri::{AppHandle, Manager, WebviewWindow};

pub struct WindowRecord {
    pub window_label: String,
    pub canonical_path: Option<PathBuf>, // None nếu là Empty/Welcome Window
}

pub struct WindowManagerState {
    // Mapping: canonical_path -> window_label
    pub repo_to_window: Mutex<HashMap<PathBuf, String>>,
    // Mapping: window_label -> Option<canonical_path>
    pub window_to_repo: Mutex<HashMap<String, Option<PathBuf>>>,
}
```

### 3.2. Đặt nhãn Cửa sổ (Window Labeling Strategy)
Để đảm bảo nhãn cửa sổ (window label) duy nhất và hợp lệ theo chuẩn Tauri (chỉ chứa ký tự chữ, số, gạch ngang, gạch dưới):
- **Cửa sổ mặc định/trống**: `main`, `win_welcome_<uuid>`.
- **Cửa sổ gắn với repo**: `win_repo_<sha256(canonical_path)[0..16]>` hoặc `win_<uuid>`.

### 3.3. Luồng Xử lý Mở Repo (Open Repository Flow)

```text
User yêu cầu mở repo: path P
             │
             ▼
   canonical_path = canonicalize(P)
             │
      Đã tồn tại trong
   repo_to_window mapping?
     ┌───────┴───────┐
    YES              NO
     │               │
     ▼               ▼
 Lấy window_label   Có cửa sổ hiện tại nào đang rỗng
 và tìm WebviewWindow  (đang ở Welcome Screen) không?
     │                     ┌──────────┴──────────┐
     ▼                    YES                    NO
 - unminimize()            │                     │
 - show()                  ▼                     ▼
 - set_focus()       Tái sử dụng         Tạo WebviewWindow mới
 (Redirect focus)    cửa sổ hiện tại     (WebviewWindowBuilder)
                           │                     │
                           └──────────┬──────────┘
                                      ▼
                        - Lưu mapping vào WindowManagerState
                        - Gán Watcher cho canonical_path
                        - Điều hướng Webview tới URL kèm repo context
```

### 3.4. Triển khai Lệnh IPC trong Rust

```rust
#[tauri::command]
pub async fn open_or_focus_repo(
    app: AppHandle,
    repo_path: String,
    force_new_window: Option<bool>,
) -> Result<String, String> {
    let canonical = canonicalize_repo_path(&repo_path)?;
    let win_state = app.state::<WindowManagerState>();

    // 1. Kiểm tra xem repo đã được mở ở cửa sổ nào chưa
    {
        let map = win_state.repo_to_window.lock().unwrap();
        if let Some(existing_label) = map.get(&canonical) {
            if let Some(window) = app.get_webview_window(existing_label) {
                // Focus và mang cửa sổ hiện có lên trước
                let _ = window.unminimize();
                let _ = window.show();
                let _ = window.set_focus();
                return Ok(format!("Focused existing window: {}", existing_label));
            }
        }
    }

    // 2. Quyết định mở ở cửa sổ mới hay cửa sổ hiện tại
    let new_label = format!("win_repo_{}", uuid::Uuid::new_v4().to_string().replace('-', ""));
    let encoded_path = urlencoding::encode(&canonical.to_string_lossy());
    let url = format!("/index.html?repo={}", encoded_path);

    let window = tauri::WebviewWindowBuilder::new(
        &app,
        &new_label,
        tauri::WebviewUrl::App(url.parse().unwrap()),
    )
    .title(format!("Stage0 - {}", canonical.file_name().unwrap().to_string_lossy()))
    .inner_size(1360.0, 840.0)
    .min_inner_size(1024.0, 680.0)
    .decorations(false)
    .build()
    .map_err(|e| format!("Failed to create window: {}", e))?;

    // 3. Cập nhật state quản lý cửa sổ
    {
        let mut repo_map = win_state.repo_to_window.lock().unwrap();
        let mut win_map = win_state.window_to_repo.lock().unwrap();
        repo_map.insert(canonical.clone(), new_label.clone());
        win_map.insert(new_label.clone(), Some(canonical));
    }

    Ok(new_label)
}
```

### 3.5. Dọn dẹp Tài nguyên khi Đóng Cửa sổ (Window Close Event)
Khi một cửa sổ bị đóng (`tauri::WindowEvent::Destroyed` hoặc `CloseRequested`):
1. Xoá nhãn cửa sổ khỏi `window_to_repo`.
2. Xoá `canonical_path` khỏi `repo_to_window`.
3. Huỷ đăng ký theo dõi thư mục trong `WatcherState` nếu không còn cửa sổ nào khác sử dụng repo đó.

---

## 4. Kiến trúc Frontend (React 19 + Zustand)

### 4.1. Khởi tạo Trạng thái Độc lập theo Cửa sổ
Mỗi `WebviewWindow` trong Tauri là một tiến trình WebView độc lập, sở hữu:
- Một vùng nhớ JavaScript / DOM riêng biệt.
- Một instance Zustand store `useGitStore` độc lập.
- Không chia sẻ biến global trong RAM &rarr; **tránh 100% tình trạng leak state giữa các repo**.

### 4.2. Khởi động Cửa sổ từ Query Parameter

Khi một cửa sổ được tạo ra với URL `/index.html?repo=D%3A%2Fmy-project`:

```typescript
// frontend/App.tsx hoặc store/useGitStore.ts
export const initWindowContext = async () => {
  const params = new URLSearchParams(window.location.search);
  const repoParam = params.get('repo');

  if (repoParam) {
    const decodedPath = decodeURIComponent(repoParam);
    console.log(`[Stage0] Initializing window with dedicated repo: ${decodedPath}`);
    // Tự động mở và nạp repo chuyên biệt cho cửa sổ này
    await useGitStore.getState().openRepoByPathDirect(decodedPath);
  } else {
    // Cửa sổ khởi tạo bình thường (Welcome Screen)
    await useGitStore.getState().initApp();
  }
};
```

---

## 5. Trải nghiệm Người dùng & Menu Tương tác (UX Design)

### 5.1. Phím tắt & Thao tác Menu
- **`Ctrl + Shift + N`** (`Cmd + Shift + N` trên macOS):
  - Mở một cửa sổ mới trống (New Window).
- **File Menu**:
  - `New Window` &rarr; Mở cửa sổ Welcome mới.
  - `Open Repository in New Window...` &rarr; Mở hộp thoại chọn thư mục và mở repo trong cửa sổ mới.
  - `Close Window` (`Ctrl + Shift + W`): Đóng cửa sổ hiện tại mà không làm tắt các cửa sổ repo khác.
- **Recent Projects**:
  - Khi click vào bất kỳ repo nào trong danh sách Recent:
    - Nếu repo đó đang được mở tại cửa sổ X &rarr; tự động chuyển focus sang cửa sổ X.
    - Nếu repo đó chưa mở &rarr; mở ngay tại cửa sổ hiện tại (nếu đang ở Welcome Screen) hoặc mở cửa sổ mới.

### 5.2. Titlebar & Taskbar
- Mỗi cửa sổ có tiêu đề tài liệu rõ ràng:
  - Cửa sổ repo: `Stage0 — <repo-name> [compare → base]`
  - Cửa sổ rỗng: `Stage0 — Virtual MR Sandbox`
- Trên Taskbar của hệ điều hành:
  - Mỗi cửa sổ hiển thị thumbnail riêng, click vào thumbnail nào chuyển ngay đến repo đó.

---

## 6. Xử lý Đồng thời & An toàn Dữ liệu (Concurrency & Data Safety)

1. **SQLite Concurrent Access (WAL Mode)**:
   - Tất cả các cửa sổ cùng ghi dữ liệu vào một file SQLite duy nhất (`local_mr.db`).
   - SQLite được cấu hình chế độ **WAL (Write-Ahead Logging)**:
     - Hỗ trợ không giới hạn số lượng luồng đọc đồng thời (*Concurrent Readers*).
     - Không bao giờ bị khoá bảng khi có cửa sổ đang đọc lịch sử diff hoặc credentials.
2. **File System Watcher**:
   - `WatcherState` ở backend Rust duy trì danh sách kênh theo dõi.
   - Khi file thay đổi, sự kiện `repo-fs-changed` phát ra có kèm payload `repo_path`.
   - Mỗi cửa sổ frontend chỉ lắng nghe và reload nếu `payload.repo_path === currentRepo.local_path`.

---

## 7. Lộ trình Triển khai Kỹ thuật (Implementation Milestones)

| Giai đoạn | Nội dung công việc | Kết quả đầu ra |
| :--- | :--- | :--- |
| **Giai đoạn 1** | Chuẩn hoá `canonicalize_repo_path` và xây dựng `WindowManagerState` trong Rust | Kiểm soát chặt chẽ mapping `PathBuf` &harr; `WindowLabel`, chống trùng lặp |
| **Giai đoạn 2** | Triển khai lệnh IPC `open_or_focus_repo` và `open_new_window` | Hỗ trợ mở cửa sổ mới và tự động focus cửa sổ cũ khi bấm trùng repo |
| **Giai đoạn 3** | Cập nhật Frontend `App.tsx` nạp repo theo URL param `?repo=` | Cửa sổ mới nạp thẳng repo vào trạng thái làm việc |
| **Giai đoạn 4** | Tích hợp menu `File > New Window` (`Ctrl+Shift+N`) và cập nhật danh sách Recents | Hoàn thiện phím tắt và thao tác UX |

---

*Tài liệu được quản lý tập trung trong kho lưu trữ mã nguồn Stage0.*
