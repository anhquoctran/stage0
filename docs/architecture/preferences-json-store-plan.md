# Kế hoạch refactor Preferences sang `preferences.json`

**Trạng thái:** đang triển khai; cập nhật rà soát ngày 2026-10-19.

Tài liệu này ghi lại các yêu cầu đã thống nhất, phạm vi dữ liệu dự kiến chuyển đổi, luồng chỉnh sửa trực tiếp bằng JSON và các rủi ro cần xử lý. Tình trạng implementation và các hạng mục kỹ thuật còn mở được theo dõi trong mục “Tình trạng triển khai và vấn đề còn mở”.

**Kiểm chứng gần nhất (2026-10-19):** `pnpm test` 123/123 và `cargo test --lib` 156/156 đều thành công; `pnpm typecheck` và `pnpm check:architecture` cũng đã qua trong vòng kiểm chứng gần đây. `rustfmt --check` trên các module Rust đã chạm còn báo khác biệt định dạng; chưa chạy formatter để tránh mở rộng diff hiện có ngoài phần cần thiết.

## Mục tiêu và phạm vi

- Dùng một file `preferences.json` làm nguồn cấu hình bền vững duy nhất cho dữ liệu Preferences của app. File dùng cú pháp JSON có comment (JSONC), để người dùng có thể ghi chú và chỉnh sửa thủ công.
- Mọi giá trị trong file đều **app-scoped**. Không lưu giá trị theo repository trong file này.
- Ngoại lệ lưu trữ: giá trị bí mật bắt buộc nằm trong OS keychain; SQLite chỉ giữ ánh xạ ID của bản ghi sang tham chiếu keychain. SQLite không tiếp tục là nơi lưu metadata Preferences hoặc cấu hình thường.
- Tính năng repo settings lưu JSON là một tính năng riêng, triển khai sau; không gộp vào refactor này.
- Preferences dialog vẫn là giao diện thân thiện để chỉnh các giá trị cấu hình. Người dùng nâng cao có thể mở editor JSONC tích hợp ngay trong app.

## Các quyết định đã thống nhất

1. **Một nguồn cấu hình chuẩn:** `preferences.json` là nguồn lâu dài duy nhất cho các giá trị Preferences. Store frontend/Zustand nếu còn cần sẽ chỉ là cache/view của cấu hình được backend nạp, không tự persist song song vào localStorage.
2. **Phạm vi app:** toàn bộ giá trị trong file áp dụng cho app hiện tại, không phụ thuộc repository đang mở.
3. **Ngoại lệ secrets:** giá trị bí mật ở OS keychain; SQLite giữ mapping khóa định danh sang keychain reference. Không ghi secret vào JSON, log, thông báo lỗi hoặc export cấu hình.
4. **Chỉnh sửa nâng cao trong app:** header của Preferences dialog có mục **Edit in preferences.json** và mở editor tích hợp.
5. **Autosave:** editor lưu tự động sau 2 giây kể từ lần sửa cuối.
6. **Cấu hình mặc định:** có bộ default được đóng gói cùng app, dùng cho cài đặt mới và lệnh Reset to Defaults.
7. **JSONC:** hỗ trợ comment dòng/khối và trailing comma; không hỗ trợ các mở rộng JSON5 như tên thuộc tính không quote hay chuỗi nháy đơn. Đây là dialect gần với VS Code JSONC. [VS Code JSON](https://code.visualstudio.com/Docs/languages/json), [Zed JSON](https://zed.dev/docs/languages/json).
8. **System prompt của bot do Stage0 sở hữu:** người dùng chỉ xem được, không sửa được. Prompt nền được chọn theo role; custom bot lưu role và phần instruction bổ sung của người dùng, không lưu đè prompt nền.

## Tình trạng triển khai và vấn đề còn mở

Đã có nền tảng backend JSONC với atomic write, revision conflict, giới hạn kích thước/độ sâu, từ chối secret, patch giữ comment/unknown fields, editor autosave 2 giây, bootstrap/migration một phần và SQLite mapping ID → keychain reference cho Git credentials lẫn MCP secrets. MCP secret values được gom thành một keychain record mỗi server; `preferences.json` chỉ chứa danh sách tên biến, còn SQLite không giữ giá trị bí mật. Migration legacy chỉ xóa browser storage sau khi JSON hợp lệ và các secret tương ứng đã vào keychain. Resolver native đã được triển khai fail-closed nhưng chưa có MCP process runner sử dụng nó. Writer trong cùng process dùng mutex; các process Stage0 dùng thêm OS file lock. Khi tự hòa giải patch cũ, frontend chỉ retry nếu các trường được patch không đổi; thay đổi chồng lấn sẽ báo conflict. Các quyết định sau đã được chốt trong implementation:

- JSONC hợp lệ được autosave và áp dụng runtime ngay; Preferences dialog thông thường vẫn giữ draft đến Apply/OK, Cancel bỏ phần draft kể từ lần Apply gần nhất.
- File lỗi được giữ nguyên để người dùng sửa; runtime dùng bản last-known-good hợp lệ, hoặc defaults nếu chưa có bản cứu hộ. File lỗi không được tự ghi đè.
- Audit trail là lịch sử vận hành, không nằm trong `preferences.json`; thao tác clear trail vẫn riêng biệt.
- Prompt system cũ tùy chỉnh được chuyển thành reviewer/custom instructions; prompt nền theo role do app sở hữu.

Vấn đề kỹ thuật còn lại trước khi coi refactor hoàn tất:

- **P1 — MCP runtime integration:** keychain storage, legacy migration và resolver native đã có; hiện app chưa có process runner cho MCP server được cấu hình trong Preferences, nên secret chưa được đưa vào môi trường tiến trình thực tế. Khi bổ sung runner, phải truyền env native trực tiếp cho child process, không trả secret qua IPC hoặc log, và fail closed nếu thiếu secret.
- **P1 — Schema regression coverage:** validator kiểm tra kiểu/range/enum; đã có test defaults, migration legacy đại diện, malformed records và giới hạn secret. Còn cần kiểm thử trên fixture export thực tế đã ẩn dữ liệu nhạy cảm trước phát hành.
- **P1 — Giao dịch Apply xuyên storage:** dialog ghi JSONC rồi commit batch keychain/SQLite và bù rollback khi lỗi. Unit tests bao phủ keyring failure, MCP batch rollback và JSON rollback; vẫn cần integration test native xuyên file–keychain–SQLite trên OS được hỗ trợ. Đây là transaction bù trừ, không phải ACID xuyên filesystem/keychain.
- **P1 — Kiểm chứng migration credential:** đã có test migration metadata cũ, compact lặp lại và failure không làm mất bảng/row. Còn cần chạy trên bản sao DB thực tế cùng OS keychain và rà orphan khi nâng cấp.
- **P1 — Ghi đồng thời với editor ngoài app:** hai cửa sổ/process Stage0 được tuần tự hóa và revision/hash kiểm tra trước write. VS Code/Zed không tham gia lock; còn một race nhỏ nếu editor ngoài sửa đúng giữa lần kiểm tra revision và atomic replace.
- **P1 — Persistence audit cuối:** các nhóm cấu hình chính đã chuyển sang JSON; localStorage còn onboarding/UI state, notification history và repo-scoped bot maps nằm ngoài phạm vi. Cần duy trì test/allowlist để preference mới không vô tình được persist song song.

Các mục trên là việc kỹ thuật còn lại, không phải lựa chọn sản phẩm đang chờ người dùng quyết định.

## Phạm vi dữ liệu Preferences

Bảng dưới đây là inventory dự kiến theo các mục đang xuất hiện trong Preferences dialog. Khi triển khai cần đối chiếu lại schema và các control thực tế để không bỏ sót trường mới.

| Nhóm | Dữ liệu dự kiến trong `preferences.json` | Ghi chú |
|---|---|---|
| General | `showInlineBlame`, `streamResponse`, `enableCodeReviewAssist` | `Accessible Mode` hiện là placeholder, chưa có giá trị lưu. `Single File Review` dùng chung `enableCodeReviewAssist`, không tạo khóa trùng. |
| Appearance | `themeMode`; viewer font gồm `fontFamily`, `fontSize`, bold/italic/underline, `lineSpacing`, `enableLigatures` | Chuyển khỏi localStorage nếu đang persist tại đó. |
| Editor / Diff | `showInlineBlame` | Dùng chung khóa General; “Split / Unified Toggleable” hiện chỉ là thông tin hiển thị, không phải preference. |
| AI | provider, auth mode/CLI type, model, base URL, temperature, reasoning effort, fast mode, max tokens, streaming, code review assist | System prompt nền không phải preference; API key/token là secret, không có giá trị thô trong file. |
| MCP servers | ID, tên, mô tả, loại, command, args, non-secret env, danh sách tên secret env, URL, cwd, enabled | Giá trị secret ở OS keychain; SQLite chỉ ánh xạ server ID sang keychain reference. Không xuất giá trị secret trong JSON/config export. Trạng thái test, tools count, last tested và message là runtime. |
| Reviewer bots | Danh sách bot toàn cục; role và instruction bổ sung do người dùng viết cho custom bot | App-scoped. System prompt nền được chọn theo role và không lưu trong file. Các map `repoActiveBotIds` / `repoCustomReviewers` theo repository không thuộc phạm vi file này. |
| Sandbox | Loại sandbox được chọn | Giá trị chọn là preference; trạng thái đang chạy/provisioning là runtime. |
| Guardrails | Toàn bộ cấu hình policy | Audit trail là dữ liệu lịch sử vận hành, không thuộc file Preferences. |
| Git | Git binary ID và path | Hiện đang dùng SQLite app settings; dự kiến chuyển giá trị thường sang JSON. |
| Notifications | Các kênh `aiReview`, `gitSync`, `guardrails` | Chuyển cấu hình kênh khỏi localStorage. Lịch sử notification không phải preference. |
| Git Credentials | Metadata không bí mật như ID, provider, server URL, account name, token type, label, source, helper và timestamps | Secret ở keychain. SQLite chỉ giữ mapping credential ID → keychain reference. `is_in_keyring` là trạng thái suy ra/runtime. |

Các trạng thái điều hướng/search của dialog, draft chưa lưu, trạng thái đăng nhập, kết quả test/probe/discovery, toast và dữ liệu UI tạm thời không phải cấu hình lâu dài. Các thao tác đăng nhập/đăng xuất, test kết nối, discovery, sandbox provisioning/execution và kiểm tra credential tiếp tục là hành động riêng, không chạy chỉ vì file được parse.

## Prompt bot theo role

System prompt là phần chỉ thị cốt lõi do Stage0 thiết kế để tạo cách làm việc và chất riêng của app. Prompt nền được quản lý bởi app theo role của bot, không thuộc `preferences.json` và không thay đổi được qua Preferences dialog hay chỉnh JSON thủ công. UI có thể hiển thị prompt nền ở chế độ chỉ đọc để người dùng hiểu bot sẽ làm việc ra sao.

Khi tạo custom bot, người dùng chọn role. Stage0 lấy prompt nền tương ứng với role đó; người dùng có thể thêm instruction riêng. JSON chỉ lưu role và instruction bổ sung, ví dụ `role` và `customInstructions`. Khi chạy bot, Stage0 ghép prompt nền của role với phần instruction bổ sung; không lưu prompt đã ghép ngược lại vào file. Đổi role sẽ đổi prompt nền theo role mới nhưng không tự xoá instruction người dùng đã nhập.

Prompt nền cần được kiểm soát như một phần của sản phẩm: được review/version cùng code hoặc tài nguyên app, có test theo từng role và chỉ thay đổi qua bản cập nhật Stage0. `Reset to Defaults` không sửa prompt nền; reset cấu hình bot có thể xoá instruction tùy chỉnh theo đúng phạm vi reset đã chọn.

Khi migration, `aiConfig.systemPrompt` cũ không còn ghi vào prompt nền. Nội dung tùy chỉnh khác mặc định được chuyển sang `reviewerInstructions`; prompt cũ của custom reviewer được chuyển sang `customInstructions`. Tài liệu [AI Preferences transaction](ai_preferences_transaction.md) cần tiếp tục đồng bộ với hành vi này.

### Các ranh giới còn cần rà soát

- **Guardrail audit trail:** đây là lịch sử vận hành, không phải cấu hình; giữ ngoài JSON và clear bằng hành động riêng.
- **Credential metadata:** JSON giữ metadata không bí mật và SQLite giữ mapping ID → keychain reference; cần hoàn tất migration/tests như ghi trong tình trạng triển khai.
- **Repo reviewer maps:** vẫn là repo-scoped và nằm ngoài file này; sẽ được xử lý khi làm tính năng repo settings riêng.

## Luồng editor và đồng bộ cấu hình

Luồng dự kiến:

1. Backend đọc file, parse JSONC, validate schema và nạp cấu hình cho runtime/store frontend.
2. Mục **Edit in preferences.json** mở editor tích hợp trên nội dung file hiện tại.
3. Khi người dùng ngừng gõ 2 giây, editor gửi bản nội dung tới backend để lưu. UI hiển thị `Saving`, `Saved`, `Invalid` hoặc `Unsaved` cùng lỗi có vị trí dòng/cột khi có thể.
4. Nội dung hợp lệ được validate toàn bộ trước khi áp dụng vào runtime. Nội dung lỗi cú pháp/schema không được áp dụng vào runtime.
5. Cập nhật từ giao diện Preferences phải ghi về cùng file chuẩn. Việc cập nhật trường qua GUI cần giữ comment, thứ tự/định dạng hợp lý và các trường chưa nhận diện được.
6. Ghi file qua file tạm cùng thư mục rồi thay thế nguyên tử; xử lý lỗi quyền ghi, hết dung lượng và lỗi thay thế như trạng thái chưa lưu.

Chỉnh sửa JSONC hợp lệ được lưu và áp dụng runtime ngay; chỉnh sửa qua giao diện Preferences vẫn theo draft đến Apply/OK. Cancel chỉ bỏ thay đổi kể từ lần Apply gần nhất. Tài liệu [AI Preferences transaction](ai_preferences_transaction.md) cần giữ đúng phân biệt giữa hai luồng.

### Nội dung lỗi và bản cứu hộ

Editor không ghi draft lỗi xuống file chuẩn: chỉ lưu sau khi cú pháp/schema hợp lệ. Bản hợp lệ được giữ trong sidecar last-known-good; nếu file bị sửa lỗi bên ngoài, app giữ nguyên nội dung đó cho editor nhưng dùng sidecar hoặc defaults làm runtime configuration. Không tự ghi đè file lỗi.

## Khởi tạo, file bị xoá/hỏng và reset

- **Cài mới / chưa có file:** tạo `preferences.json` từ default được đóng gói cùng app, sau đó nạp cấu hình đó.
- **File bị xoá sau khi đã dùng:** mặc định có thể tái tạo từ defaults, nhưng custom preferences sẽ mất nếu không có bản cứu hộ. Cần báo rõ app đã tạo lại file.
- **JSONC sai cú pháp hoặc sai schema:** không crash và không áp dụng cấu hình lỗi. Giữ nguyên bản lỗi để người dùng sửa; hiển thị lỗi cụ thể và cung cấp cách khôi phục defaults/bản last-known-good.
- **File của phiên bản mới hơn:** không tự serialize hoặc ghi đè bằng app cũ; giữ nguyên file và báo cấu hình không được hỗ trợ.
- **Reset to Defaults:** ghi default có phiên bản vào JSON qua cùng luồng atomic write. Không tự xoá keychain secrets hoặc SQLite credential mappings. Việc xoá credential phải là hành động riêng, có ý định rõ ràng.
- **Xoá audit log:** nếu trail vẫn là dữ liệu riêng, nút clear trail là hành động riêng, không bị Reset to Defaults xoá ngầm.

Default nên có phiên bản schema và được đóng gói trong tài nguyên app. Cần phân biệt “file chưa từng được tạo” với “file hiện hữu bị mất/hỏng” nếu UX cần khôi phục khác nhau; việc phân biệt này không thể dựa vào sự vắng mặt của file nếu không có dấu mốc bền vững khác.

## Rủi ro và biện pháp đề xuất

| Ưu tiên | Rủi ro | Biện pháp cần thiết |
|---|---|---|
| P0 | Autosave nội dung lỗi làm mất cấu hình hợp lệ cuối | Đã giữ draft lỗi ở editor, dùng last-known-good/default cho runtime và kiểm tra không ghi đè file lỗi; vẫn cần test thêm file bị xóa/hỏng giữa phiên. |
| P0 | Nhiều writer: editor, GUI Apply, nhiều cửa sổ app, VS Code/Zed cùng sửa file | Đã có Stage0 mutex + OS lock, revision/hash và phát hiện xung đột trường khi retry patch. External editors không lock được; race còn lại được ghi rõ ở mục vấn đề mở. |
| P0 | Secret bị dán vào JSON hoặc log, nhất là API keys/MCP env/credential metadata | API keys, Git credentials và MCP secret env đi qua keychain; schema từ chối secret values, MCP JSON chỉ giữ tên biến, còn config export loại secret env. Legacy browser storage chỉ bị xóa sau khi migration tương ứng thành công. Cần giữ invariant này khi thêm runner/runtime. |
| P1 | GUI viết lại file làm mất comments, unknown keys hoặc format | Đã dùng CST patch và có test round-trip comments, unknown fields và JSONC formatting. |
| P1 | Nâng cấp/hạ cấp schema làm mất trường hoặc hỏng file | Versioned migrations, giữ trường chưa biết; app cũ không rewrite schema mới; migration có backup và ghi nguyên tử. |
| P1 | Autosave được hiểu thành chạy MCP, probe hoặc tác vụ hệ thống | Parse/save không thực thi lệnh. Test/Connect/Provision/Run vẫn cần hành động rõ ràng riêng. |
| P1 | MCP secret được lưu an toàn nhưng vô tình lộ qua process-launch IPC/log | Chưa có Preferences MCP process runner. Khi triển khai, resolve secrets trong native backend và truyền trực tiếp vào child process env; không serialize resolved map về WebView/logs, fail closed khi thiếu. |
| P1 | JSON cũ chứa system prompt người dùng từng sửa | Migration bảo toàn nội dung cũ theo luồng chuyển thành custom instruction; không để nội dung này ghi đè prompt nền theo role. |
| P1 | UI hiển thị prompt nền khác prompt thực tế lúc chạy | Cùng một role catalog là nguồn để render preview và dựng prompt runtime; kiểm tra theo từng role. |
| P1 | Ghi thành công một phần giữa file, runtime, keychain và SQLite | Hiện dùng JSON patch trước, key batch sau và bù rollback file nếu keychain thất bại; giữ draft và báo nếu rollback lỗi. Unit tests kiểm tra lỗi keyring và rollback file; native integration test xuyên các storage vẫn còn. Đây không phải transaction ACID xuyên nhiều hệ lưu trữ. |
| P1 | App đóng/crash/ngủ trước khi debounce chạy; disk đầy hoặc ACL từ chối ghi | Flush khi đóng app, giữ nội dung chưa lưu, báo trạng thái; bảo toàn file cũ nếu atomic replace thất bại. |
| P1 | Metadata trong JSON vẫn nhạy cảm dù không chứa secret | Thư mục/file chỉ cho user hiện tại truy cập; cẩn thận với diagnostics, backup và đồng bộ cloud; JSON có command, đường dẫn, prompt và server URLs. |
| P2 | Khác biệt dialect JSONC giữa editor, parser và công cụ ngoài | Chốt cú pháp hỗ trợ; ưu tiên tập giao chung hoặc ghi rõ hỗ trợ block comments/trailing commas; test với VS Code/Zed. |
| P2 | File quá lớn, lồng sâu hoặc giá trị nằm ngoài range gây treo/lỗi runtime | Giới hạn kích thước/độ sâu và validate range/enum/format trước khi áp dụng. |
| P2 | Credential bị xoá khỏi JSON nhưng keychain mapping còn sót hoặc ngược lại | Có quy tắc reconciliation và cleanup riêng; không xoá secrets chỉ vì metadata không parse được. Hiển thị credential orphan để xử lý an toàn. |

Các quyền hệ điều hành cần được áp dụng cho file/thư mục ở từng nền tảng. Việc tạo, thay thế và khôi phục file phải xử lý symlink/path bất thường an toàn, tránh ghi ra ngoài app data directory.

## Kế hoạch triển khai đề xuất

Mức ưu tiên:

- **P0 — chặn triển khai:** phải chốt hoặc hoàn thành trước khi chuyển dữ liệu; sai ở đây có thể gây mất cấu hình, mở lộ secret hoặc làm sai nguồn dữ liệu.
- **P1 — bắt buộc để hoàn thành refactor:** thuộc phạm vi sản phẩm đã yêu cầu, phải xong trước khi coi tính năng sẵn sàng.
- **P2 — hardening sau lõi:** cải thiện khả năng chịu lỗi và tương thích ở các tình huống ít gặp; không được làm suy yếu bất biến P0/P1.

Độ phức tạp là ước lượng tương đối theo phạm vi kỹ thuật, chưa phải estimate ngày công: **M** là một module với vài tích hợp; **L** đi qua nhiều layer hoặc có migration/failure path; **XL** là thay đổi xuyên hệ thống, nhiều nền tảng và nhiều nguồn lưu trữ.

| Thứ tự | Hạng mục triển khai | Ưu tiên | Độ phức tạp | Phụ thuộc / lý do |
|---:|---|:---:|:---:|---|
| 1 | Chốt schema và semantics: inventory field, audit trail, Apply/editor runtime timing, JSONC dialect, recovery, Reset, role/prompt và migration prompt cũ | P0 | M | Chốt hợp đồng trước khi backend và UI dựa vào các giả định khác nhau. |
| 2 | Native preference service: defaults có version, JSONC parse/schema validation, read API và error model | P0 | L | Nền dùng chung cho startup, dialog, editor và migration. |
| 3 | File safety: atomic write, revision/hash conflict, serialized writes, recovery sau JSON lỗi, theo dõi thay đổi ngoài app và quyền file | P0 | L | Bảo vệ dữ liệu khi autosave, nhiều cửa sổ và editor ngoài cùng sửa file. |
| 4 | Migration và secret boundary: chuyển localStorage/SQLite settings/credential metadata vào JSON; secret ở keychain, SQLite còn mapping; có rollback/recovery | P0 | XL | Đã triển khai đường chính và kiểm tra bằng unit tests; cần xác minh fixture nâng cấp thật cùng OS keychain trước khi phát hành. |
| 5 | Refactor Preferences dialog: snapshot/draft/Apply/Cancel ghi về một store; system prompt nền read-only theo role; custom bot lưu role và instruction bổ sung | P1 | L | Phụ thuộc service và semantics đã chốt; đồng thời đổi đường đi của prompt runtime. |
| 6 | Editor JSONC trong app: header action, autosave 2 giây, trạng thái saved/invalid/conflict, sửa giữ comment và unknown fields | P1 | L | Phụ thuộc read/write API, recovery và conflict handling. Đây là yêu cầu sản phẩm cốt lõi. |
| 7 | Kiểm chứng và phát hành: first install/upgrade/reset, file lỗi/phiên bản mới, autosave/close, nhiều cửa sổ/ngoài app, secrets và credential orphan | P1 | L | Cần có sau các luồng chính; kiểm tra migration trên dữ liệu nâng cấp mẫu trước khi xóa store cũ. |
| 8 | Hardening bổ sung: giới hạn file/depth, xử lý filesystem đặc thù, thông báo orphan và rà soát backup/cloud sync | P2 | M | Có thể hoàn thiện sau lõi, nhưng không được bỏ qua kiểm tra secret/file permissions ở P0. |

**Đường găng dự kiến:** 1 → 2 → 3 → 4 → 5/6 → 7. Hạng mục 5 và 6 có thể phát triển song song sau khi read/write contract của service được cố định; hạng mục 4 cần hoàn tất migration và xác nhận rollback trước khi xóa persistence legacy.

## Tiêu chí hoàn tất dự kiến

- Mỗi preference trong dialog có một đường persist duy nhất vào `preferences.json`; không còn localStorage/SQLite song song cho cấu hình thường.
- Tất cả values app-scoped; không có repo setting trong file.
- Secrets không xuất hiện trong JSON/log; SQLite chỉ có mapping ID → keychain reference.
- MCP secrets chỉ được resolve trong backend để truyền trực tiếp vào process runtime; không xuất hiện trong IPC trả về WebView, config export hoặc log.
- File thiếu/hỏng/sai schema/phiên bản mới không làm app crash hoặc âm thầm phá nội dung; người dùng có đường khôi phục.
- Editor tự lưu đúng sau 2 giây, thể hiện lỗi/xung đột/chưa lưu, và thay đổi không làm mất comment/unknown keys.
- GUI, editor, các cửa sổ và thay đổi ngoài app không ghi đè lẫn nhau một cách âm thầm.
- Reset có phạm vi rõ ràng và không xoá keychain/mapping ngoài ý muốn.
- Prompt nền của Stage0 chỉ đọc, thay đổi theo role và không bị JSON ghi đè; custom bot lưu role cùng instruction bổ sung riêng.
- Tài liệu transaction hiện tại và hành vi Apply/OK/Cancel được đồng bộ với luồng editor autosave.
