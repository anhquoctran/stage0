# Stage0 - Hướng dẫn Development Hot Reload & Build Production Đa Môi Trường

Tài liệu này cung cấp hướng dẫn đầy đủ về cách chạy **Dev Server với Hot Reload** và **Đóng gói ứng dụng (Build + Optimized Production)** cho cả 3 nền tảng: **Windows**, **macOS**, và **Linux**.

---

## 1. Yêu cầu Tiên quyết (Prerequisites) theo Môi trường

| Môi trường | Node.js | Rust & Cargo | Công cụ Hệ thống Bổ sung |
| :--- | :--- | :--- | :--- |
| **Windows 10/11** | Node.js >= 18 LTS | Rust >= 1.77 (`rustup`) | Visual Studio C++ Build Tools, Microsoft Edge WebView2 (có sẵn trên Win 10/11) |
| **macOS** (Apple Silicon & Intel) | Node.js >= 18 LTS | Rust >= 1.77 (`rustup`) | Xcode Command Line Tools (`xcode-select --install`) |
| **Linux** (Ubuntu / Debian / Fedora / Arch) | Node.js >= 18 LTS | Rust >= 1.77 (`rustup`) | `libwebkit2gtk-4.1-dev`, `libssl-dev`, `libsecret-1-dev`, `build-essential`, `pkg-config` |

### Cài đặt nhanh dependencies trên Linux:
```bash
# Ubuntu / Debian / Pop!_OS
sudo apt update && sudo apt install -y build-essential pkg-config libwebkit2gtk-4.1-dev libappindicator3-dev librsvg2-dev patchelf libssl-dev libsecret-1-dev

# Fedora
sudo dnf install webkit2gtk4.1-devel openssl-devel libsecret-devel

# Arch Linux
sudo pacman -S webkit2gtk-4.1 openssl libsecret base-devel
```

---

## 2. Chạy Development với Hot Reload

Hệ thống hỗ trợ 2 chế độ dev linh hoạt:
1. **Web Dev Mode (`--web`)**: Chạy Vite frontend trên trình duyệt thông thường với mock engine. Cực nhanh cho việc phát triển giao diện UI, Tailwind CSS và components.
2. **Desktop App Mode (`--app`)**: Khởi động cửa sổ ứng dụng Tauri native với Hot Reload đồng thời cho cả Frontend (Vite HMR) và Backend (Rust auto-recompile).

### Cách 1: Sử dụng lệnh npm chuẩn (Khuyên dùng - Đa môi trường)
```bash
# 1. Chạy Web Browser Hot Reload (nhanh nhất)
npm run dev
# hoặc
npm run dev:web

# 2. Chạy Full Native Desktop App với Rust backend
npm run dev:app
# hoặc
npm run dev:desktop
```

### Cách 2: Sử dụng Script Node.js trực tiếp (`scripts/dev.mjs`)
Script Node.js tự động nhận diện OS, kiểm tra các dependency hệ thống và kiểm tra port 1420:
```bash
node scripts/dev.mjs --web
node scripts/dev.mjs --app
node scripts/dev.mjs --port 3000
```

### Cách 3: Sử dụng Shell Script / PowerShell tương ứng từng OS
- **Windows (PowerShell)**:
  ```powershell
  .\scripts\dev.ps1 -Mode App
  .\scripts\dev.ps1 -Mode Web
  ```
- **Windows (Command Prompt / CMD)**:
  ```cmd
  scripts\dev.cmd --app
  scripts\dev.cmd --web
  ```
- **macOS / Linux (Bash / Zsh)**:
  ```bash
  chmod +x scripts/dev.sh
  ./scripts/dev.sh --app
  ./scripts/dev.sh --web
  ```

---

## 3. Đóng gói Production Đã Tối Ưu (Build + Optimized Production)

Quá trình build tự động áp dụng các tối ưu hóa chuyên sâu:
1. **TypeScript Strict Verification**: Tự động chạy `tsc --noEmit` ngăn chặn các lỗi kiểu dữ liệu trước khi build.
2. **Vite Frontend Minification & Tree-shaking**: Nén mã nguồn JavaScript/CSS, tối ưu Tailwind v4 chunks.
3. **Rust Compiler Profile Release**:
   - `opt-level = 3`: Tối đa hóa hiệu năng và tốc độ xử lý CPU.
   - `lto = true`: Link-Time Optimization xuyên suốt các thư viện.
   - `codegen-units = 1`: Tối ưu hóa binary toàn cục.
   - `panic = "abort"`: Loại bỏ unwinding tables, giảm 20-30% dung lượng file thực thi.
   - `strip = true`: Loại bỏ toàn bộ debug symbols thừa trong binary.
4. **Tự động tính mã băm SHA-256**: Hiển thị bảng tổng hợp kích thước file và mã băm kiểm tra tính toàn vẹn.

### Cách 1: Chạy qua lệnh npm
```bash
# Đóng gói Desktop App Production cho hệ điều hành hiện tại
npm run build:prod
# hoặc
npm run build:app

# Chỉ build gói Web tĩnh (dist/)
npm run build:web
```

### Cách 2: Chạy qua Script Cross-Platform (`scripts/build.mjs`)
```bash
node scripts/build.mjs
node scripts/build.mjs --web-only
```

### Cách 3: Chạy script chuyên dụng từng hệ điều hành
- **Windows (PowerShell)**:
  ```powershell
  .\scripts\build.ps1
  ```
- **Windows (CMD)**:
  ```cmd
  scripts\build.cmd
  ```
- **macOS / Linux**:
  ```bash
  chmod +x scripts/build.sh
  ./scripts/build.sh
  ```

---

## 4. Định dạng và Vị trí File Cài đặt Sau khi Build

Tất cả các gói cài đặt production được lưu tại:
`backend/target/release/bundle/`

| Hệ điều hành | Định dạng Installer | Đường dẫn chi tiết |
| :--- | :--- | :--- |
| **Windows** | `.exe` (NSIS Installer) | `backend/target/release/bundle/nsis/Stage0_0.1.0_x64-setup.exe` |
| **Windows** | `.msi` (Windows Installer) | `backend/target/release/bundle/msi/Stage0_0.1.0_x64_en-US.msi` |
| **macOS** | `.dmg` (Apple Disk Image) | `backend/target/release/bundle/dmg/Stage0_0.1.0_aarch64.dmg` |
| **macOS** | `.app` (Standalone Application) | `backend/target/release/bundle/macos/Stage0.app` |
| **Linux** | `.AppImage` (Portable binary) | `backend/target/release/bundle/appimage/stage0_0.1.0_amd64.AppImage` |
| **Linux** | `.deb` (Debian/Ubuntu package) | `backend/target/release/bundle/deb/stage0_0.1.0_amd64.deb` |

---

## 5. Xử lý Sự cố Thường gặp (Troubleshooting)

### Port 1420 bị chiếm dụng:
Nếu thông báo port `1420` đang được dùng bởi tiến trình khác:
- **Windows**: `netstat -ano | findstr :1420` rồi `taskkill /PID <PID> /F`
- **macOS/Linux**: `lsof -i :1420` rồi `kill -9 <PID>`

### Lỗi thiếu WebView2 trên Windows:
- Windows 10/11 hiện đại đã cài sẵn WebView2 Runtime. Nếu thiếu, tải từ trang chính thức của Microsoft: [WebView2 Runtime Evergreen Bootstrapper](https://go.microsoft.com/fwlink/p/?LinkId=2124703).

### Quyền thực thi trên macOS/Linux:
Nếu gặp lỗi `Permission denied`:
```bash
chmod +x scripts/*.sh scripts/*.mjs
```
