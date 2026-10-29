# Kiến trúc đa cửa sổ

> Trạng thái: Đã triển khai baseline trong Tauri v2 và React. Tài liệu này mô tả hành vi hiện tại, các giới hạn có chủ đích và những điểm cần kiểm thử khi mở rộng.

## Mục tiêu và bất biến

Stage0 cho phép mở nhiều cửa sổ để làm việc với nhiều working tree đồng thời. Mỗi cửa sổ có WebView, DOM, JavaScript runtime và Zustand store riêng; các cửa sổ vẫn thuộc cùng một tiến trình Tauri và dùng chung Rust application state, SQLite, menu hệ thống và sandbox manager.

Các bất biến:

1. Một working tree vật lý chỉ được gán cho tối đa một cửa sổ trong tiến trình ứng dụng.
2. Mở lại working tree đang có sẽ focus và đưa cửa sổ tương ứng ra trước, không tạo bản thứ hai.
3. Cửa sổ Welcome có thể nhận working tree đầu tiên. Nếu cửa sổ hiện tại đã có repository, yêu cầu mở repository khác sẽ tạo cửa sổ mới.
4. `Open in New Window` yêu cầu cửa sổ mới, nhưng không phá vỡ bất biến duy nhất: nếu repository đã mở, Stage0 focus cửa sổ hiện tại của repository đó.
5. Đóng repository chỉ gỡ repository khỏi cửa sổ hiện tại; đóng cửa sổ không ảnh hưởng các cửa sổ còn lại.

“Repository” trong các bất biến này là working tree trên đĩa. Hai Git worktree riêng biệt có đường dẫn vật lý khác nhau được xem là hai working tree khác nhau, dù Git có thể chia sẻ common directory và refs giữa chúng.

## Định danh và chuẩn hóa working tree

Mọi đường dẫn được kiểm tra trong `window_manager::resolve_repository` trước khi lưu, so khớp hoặc gắn watcher:

- Đường dẫn phải tồn tại, trỏ tới thư mục và có `.git` (thư mục hoặc file, để hỗ trợ linked worktree).
- `dunce::canonicalize` loại bỏ alias đường dẫn như symlink và chuẩn hóa đường dẫn hệ điều hành.
- Trên Unix, định danh dùng cặp device/inode của thư mục; trên Windows dùng volume serial/file index để nhận diện cùng thư mục qua các alias đường dẫn. Nếu Windows filesystem không cung cấp physical identity, từ chối mở thay vì hạ xuống so sánh path và có nguy cơ tạo cửa sổ trùng. Trên nền tảng khác, dùng canonical path.
- Database lưu canonical path. Upsert theo path trả về bản ghi thực tế đã lưu để không tạo ID frontend khác ID persisted khi path đã tồn tại.
- Kiểm tra `.git` hiện là kiểm tra cấu trúc tối thiểu (`exists`), không chạy `git rev-parse`; metadata hỏng vẫn có thể khiến thao tác Git sau đó thất bại và phải được hiển thị như lỗi thao tác.

Không tự lowercase đường dẫn để định danh: quy tắc phân biệt hoa/thường phụ thuộc filesystem. Physical file identity sau canonicalization là khóa chống mở trùng trong tiến trình.

## Điều phối cửa sổ ở backend

`WindowManagerState` là registry có mutex, gồm:

- `window label -> WindowRecord`: repository hiện tại, chính sách khôi phục gần nhất và trạng thái đang mở.
- `RepoIdentity -> window label`: cửa sổ sở hữu working tree.

Quyết định định tuyến và đặt chỗ repository diễn ra trong cùng critical section. Điều này ngăn hai lệnh IPC đồng thời cùng tạo cửa sổ cho một repository. Các kết quả `OpenRepoOutcome` được serialize thành `opened_here`, `focused_existing` hoặc `opened_new_window` để frontend chỉ cập nhật đúng cửa sổ.

Khi tạo cửa sổ, backend đặt reservation trước, tạo `WebviewWindow`, hoàn tất reservation rồi gắn watcher. Nếu tạo cửa sổ thất bại, reservation và mapping được dọn. Khi repository đóng hoặc cửa sổ bị hủy, registry và watcher theo label được gỡ. Các cửa sổ repository mang title `Stage0 — <tên repo>`; cửa sổ rỗng dùng `Stage0 — Virtual MR Sandbox`. Cửa sổ động dùng lại cấu hình custom frame, shadow và kích thước tối thiểu theo nền tảng; cửa sổ chính và cửa sổ mới dùng cùng giao diện `index.html`. Backend focus cửa sổ ngay sau khi tạo, rồi xác nhận focus một lần nữa khi lần tải trang đầu của WebView hoàn tất để tránh cửa sổ chính giành lại z-order trong lúc cửa sổ mới đang khởi tạo. Những lần reload sau không tự đưa cửa sổ lên trước.

Registry chỉ có phạm vi một tiến trình. `tauri-plugin-single-instance` chuyển lần khởi chạy thứ hai về tiến trình đang chạy; nếu đối số là đường dẫn working tree hoặc theo dạng `--open-repo <path>`, tiến trình hiện hữu sẽ mở hoặc focus repository đó. Chưa cấu hình file association của Finder/Explorer, do đó việc double-click thư mục trong OS không được đảm bảo gọi Stage0.

## Khởi tạo frontend và định tuyến repository

Không truyền repository qua query parameter. Query parameter vừa yêu cầu encode/decode, vừa có nguy cơ bị xử lý hai lần. Frontend truy vấn `get_window_startup_context`, lấy repository/policy từ registry backend và sau đó khởi tạo store:

- Cửa sổ `main` rỗng được phép khôi phục repository gần nhất còn hợp lệ.
- Cửa sổ Welcome mới bắt đầu rỗng, không tự mở lại repository ở cửa sổ khác.
- Cửa sổ được tạo cho repository nhận repository từ startup context.
- Nếu một tiến trình khác yêu cầu mở repository vào cửa sổ Welcome đã chạy, backend gửi `repo-open-request`; frontend cũng lấy startup context sau khi đăng ký listener để tránh phụ thuộc vào thời điểm event.

Các thao tác mở từ dialog, Recents và Clone đều đi qua cùng API định tuyến. Chỉ `opened_here` mới gắn repository vào Zustand store hiện tại. Kết quả mở/focus ở cửa sổ khác không làm thay đổi trạng thái của cửa sổ đang gọi.

### Hợp đồng IPC

Tên tham số phía frontend dùng camelCase theo quy ước invoke của Tauri; dữ liệu serialize trả về dùng snake_case theo struct Rust.

| Command | Tham số | Kết quả / ý nghĩa |
| --- | --- | --- |
| `get_window_startup_context` | Không có | `{ repo, restore_recent }` của cửa sổ gọi lệnh. |
| `open_repo_dialog` | `forceNewWindow?: boolean` | `null` nếu hủy picker; nếu chọn repo, trả `OpenRepoOutcome`. |
| `open_repo_by_path` | `repoPath: string`, `forceNewWindow?: boolean` | Chuẩn hóa, ghi Recents rồi định tuyến; trả `OpenRepoOutcome`. |
| `create_new_window` | Không có | Tạo Welcome window rỗng, không restore Recents; trả window label. |
| `close_repository_window` | Không có | Gỡ repo và watcher của cửa sổ gọi, giữ cửa sổ ở Welcome. |

`OpenRepoOutcome` là union có discriminator `action`: `opened_here` có `repo`; `focused_existing` có `window_label` và `repo`; `opened_new_window` có `window_label` và `repo`. Frontend chỉ gọi `attachRepoToCurrentWindow` trong trường hợp `opened_here`. Không dựa vào event để khởi tạo một cửa sổ mới: `get_window_startup_context` là nguồn trạng thái chuẩn trong vòng đời tiến trình hiện tại; `repo-open-request` chỉ giúp cập nhật Welcome window đã chạy.

Quy tắc định tuyến tương ứng:

| Tình huống | Hành vi |
| --- | --- |
| Repo đã mở ở cửa sổ gọi lệnh | Focus cửa sổ đó; trả `opened_here`. |
| Repo đã mở ở cửa sổ khác | Unminimize/show/focus cửa sổ đang sở hữu repo; trả `focused_existing`. |
| Repo mới, cửa sổ gọi rỗng và `forceNewWindow` tắt | Gắn repo vào cửa sổ gọi; trả `opened_here`. |
| Repo mới, cửa sổ gọi đã có repo hoặc `forceNewWindow` bật | Tạo repo window mới; trả `opened_new_window`. |
| Repo mới từ single-instance handoff | Tái sử dụng Welcome window đang chạy nếu có; nếu không thì tạo repo window. |

Nếu một yêu cầu đồng thời gặp reservation đang mở, backend chờ tối đa khoảng 2 giây lấy window handle. Nếu không thấy handle, lệnh trả lỗi có thể thử lại; reservation của cửa sổ tạo repo được xóa nếu build thất bại.

## Watcher và sự kiện

`WatcherState` giữ một debouncer theo window label. Khi repository có thay đổi liên quan, Rust phát `repo-fs-changed` bằng `emit_to` tới cửa sổ sở hữu watcher; payload mang canonical `repo_path`. Frontend xác minh payload trùng repository hiện tại trước khi refresh diff. Vì vậy event của cửa sổ khác không làm tải lại dữ liệu nhầm.

Watcher được gỡ khi đóng repository hoặc khi cửa sổ bị hủy. Các file sinh trong `node_modules`, `target`, `bin`, `obj` và một số thư mục Git nội bộ được bỏ qua để hạn chế refresh không cần thiết.

## Menu và vòng đời

Menu hệ thống trên macOS là tài nguyên cấp ứng dụng, không thuộc riêng một WebView. Hành động của menu được gửi đến cửa sổ đang focus; `Zoom` cũng thao tác trên cửa sổ đó thay vì label cố định `main`. Menu hỗ trợ Open, Open in New Window, Clone, Recents, New Window (`Cmd/Ctrl + Shift + N`), Close Repository và Close Window (`Cmd + W` trên macOS, `Ctrl + W` trên các nền tảng khác).

Recents và SQLite được dùng chung giữa các cửa sổ. “Close Repository” giữ cửa sổ và đưa nó về màn hình Welcome; “Close Window” chỉ hủy cửa sổ hiện tại. Khi cửa sổ bị hủy, handler vòng đời backend xóa mapping và watcher tương ứng.

Các hành động menu macOS không broadcast toàn app: backend gửi `menu-action` tới WebView đang focus. `New Window` và `Close Window` được xử lý trực tiếp ở backend; các hành động còn lại được frontend của cửa sổ đích dispatch. Trên macOS, accelerator native đã sở hữu các phím Open/Clone/New Window để tránh frontend thực thi trùng lần thứ hai.

## SQLite và trạng thái chia sẻ

Các cửa sổ dùng chung một `Database` trong tiến trình, với một `rusqlite::Connection` được bảo vệ bằng mutex. WAL cho phép nhiều reader cùng đọc và giảm chặn giữa reader/writer; SQLite vẫn chỉ có một writer tại một thời điểm. `busy_timeout` giúp chờ lock ngắn, không phải cam kết không bao giờ có lock. Các thao tác database tiếp tục phải dùng prepared statement/parameter binding.

`SandboxManager` hiện cũng là application-scoped: loại sandbox đang hoạt động và danh sách instance được chia sẻ giữa các cửa sổ. Đây là cấu hình cấp ứng dụng có chủ đích trong baseline hiện tại, không phải trạng thái riêng từng cửa sổ. Nếu sản phẩm cần chọn engine độc lập theo repository/cửa sổ, cần chuyển khóa trạng thái sang repo identity hoặc window label và bổ sung migration/test riêng.

`localStorage` cùng origin cũng được chia sẻ giữa các WebView. Chỉ nên dùng nó cho preferences cấp ứng dụng; trạng thái workspace/repository phải ở store theo WebView hoặc được khóa bằng repo/window identity.

## Lỗi và khôi phục

- Đường dẫn không tồn tại, không phải thư mục, không có `.git`, hoặc không canonicalize được: từ chối mở với lỗi cụ thể.
- Repository đã có cửa sổ: focus cửa sổ đó; nếu cửa sổ đang được tạo, chờ ngắn để lấy handle, nếu không lấy được trả lỗi để người dùng thử lại.
- Tạo cửa sổ thất bại: xóa reservation và mapping để lần thử tiếp theo không bị kẹt.
- Watcher không khởi tạo được: ghi cảnh báo, vẫn cho phép mở repository; người dùng vẫn có thể refresh thủ công.
- Repository bị xóa sau khi vào Recents: validation loại repository đó khỏi luồng khôi phục tự động; mở thủ công sẽ hiển thị lỗi.
- Nếu frontend không lấy được startup context, khởi tạo fallback theo luồng Welcome hiện hành thay vì để cửa sổ trắng.

## Phạm vi kiểm thử cần duy trì

1. Upsert lặp lại cùng canonical path giữ nguyên repository ID.
2. Symlink tới cùng working tree tạo cùng `RepoIdentity`; thư mục không phải Git bị từ chối.
3. Hai yêu cầu mở đồng thời cùng repository chỉ tạo một cửa sổ; yêu cầu sau focus cửa sổ đó.
4. Mở repository thứ hai từ cửa sổ đang có repository tạo cửa sổ mới; mở từ Welcome dùng lại Welcome.
5. Close Repository gỡ watcher/mapping nhưng giữ cửa sổ; Close Window chỉ dọn trạng thái cửa sổ đó.
6. Watcher và menu action chỉ ảnh hưởng đúng cửa sổ mục tiêu.
7. Startup restore chỉ chạy ở cửa sổ được đánh dấu; cửa sổ mới không chiếm repository đã mở.
8. Kiểm tra dynamic window trên macOS/Windows/Linux để xác nhận custom frame, min-size, maximize/fullscreen và focus.

## Bản đồ mã nguồn và quy trình xác minh

- `backend/src/core/window_manager.rs`: chuẩn hóa path, file identity, registry, định tuyến, build/focus window và cleanup.
- `backend/src/features/git/commands.rs`, `backend/src/core/commands/window.rs`: IPC cho Open, startup context, New Window và Close Repository.
- `backend/src/lib.rs`: khởi tạo state, single-instance handoff, startup args và destroyed-window cleanup.
- `backend/src/features/git/watcher/mod.rs`: một watcher/debouncer theo window label, event gửi đích danh.
- `backend/src/core/menu.rs`: menu macOS cấp app và chuyển action tới cửa sổ focus.
- `frontend/core/App.tsx`, `frontend/features/git/store/useGitStore.ts`, `frontend/features/git/types/git.ts`: bootstrap theo cửa sổ, định tuyến state và kiểu IPC.

Trước khi thay đổi luồng này, chạy `cargo check --lib`, `cargo test --lib`, `npm run typecheck`, `npm run build` và `git diff --check`. Unit tests hiện xác nhận symlink alias dùng cùng identity, path không phải Git bị từ chối và upsert cùng path giữ nguyên ID. Các race giữa nhiều cửa sổ, native focus/menu và custom frame vẫn cần kiểm thử thủ công trên desktop; build/typecheck không thay thế được kiểm thử GUI đó.

## App-wide Preferences utility window (2026-10-29)

Preferences is one independent native Tauri window per application process, with
label `preferences`. It has no repository identity, watcher, recent-repo restore
or onboarding. Its custom macOS/Windows frame and Linux System/Custom selection
follow the existing desktop conventions. Initial size is 1100×800, with a
900×620 minimum. Closing a repository does not close this utility.

All repo-window buttons, shortcuts, notification actions and deep links route to
`ApplicationService.openPreferencesWindow`. The native Preferences/Keymaps menu
uses the same Rust operation. A process-wide async creation lock covers lookup
and build, so concurrent requests cannot create multiple editors. Existing
windows are unminimized, shown and focused; explicit section requests navigate
without discarding an open draft. Requests arriving during load are retained
until the frontend has installed its listeners.

| Command | Input | Behavior |
| --- | --- | --- |
| `open_preferences_window` | `tab?: string` | Validate a bounded section identifier; create or focus the singleton. |
| `preferences_window_ready` | None | Only the Preferences caller; deliver queued navigation, enable guarded close and reveal/focus. |
| `close_preferences_window` | None | Only the Preferences caller; destroy after its existing Cancel/OK workflow completes. |

Native `CloseRequested` is intercepted after readiness and sent only to the
Preferences window. Its Cancel callback discards changes since the last Apply;
it does not approve closing while Apply is running. Cancel, Escape, the custom
close button and native close menu retain the same transaction semantics. Apply
stays open; OK closes only after a successful save. JSONC editing and other
immediate actions retain the existing transaction contract. Readiness resets on
page load and destruction; an uninitialized window can still be closed.

JSON preferences remain app-wide and Rust-owned. Every WebView subscribes once
to the existing application-targeted `preferences-changed` revision event,
reloads the current document, and publishes to feature-owned runtime handlers.
UI language continues using its separate `app-language-changed`/Day.js flow.
No draft, repository path or secret is broadcast. Existing revision conflicts,
credential rollback and app-language persistence are preserved. The browser
fallback remains an in-page Preferences dialog.

Verification: architecture, TypeScript, locale validation, Cargo check and all
252 Rust library tests pass (serial execution). The focused frontend suite has
56 passing tests. The complete Node suite has 527 tests / 496 pass / 31 fail;
all remaining failure locations predate this change. The stale platform-operation
count assertion was updated for the new window commands.

An isolated macOS native smoke run, using a separate app identifier and test
preferences, confirmed concurrent opens create one real window, frontend IPC
readiness, native CloseRequested → Cancel → destruction, reopening, focus reuse,
and Preferences surviving closure of the workspace window. Browser DOM checks
confirmed the standalone layout at 1100×800 and 900×620. Windows/Linux native
execution and a manual two-repository GUI session remain unverified.

## Preferences transaction limitations

The async editor captures the JSON revision before its patch and rejects a
conflicting write instead of rebasing a rollback snapshot over newer settings.
A failed read aborts before touching the file or credentials. JSON replacement
is atomic and validated; the OS keychain batch has compensating rollback.

This is not an ACID transaction across resources: JSON and runtime events are
published before the keychain batch finishes; a crash or failed compensation
can leave them inconsistent. OS startup/PATH integration is applied separately
and can fail independently. Full crash recovery and isolation need a coordinated
native commit protocol with a durable recovery journal, staged keychain values,
and delayed publication; external OS integration needs reconciliation and
cannot be made part of a single atomic commit with the current platform APIs.
