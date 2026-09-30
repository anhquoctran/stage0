# Stage0 - Cross-Platform Development Hot Reload & Production Build Guide

This document provides a comprehensive guide on running the **Development Server with Hot Reload** and packaging the application with **Optimized Production Builds** across **Windows**, **macOS**, and **Linux**.

---

## 1. Prerequisites by Platform

| Platform | Node.js | Rust & Cargo | Additional System Tools |
| :--- | :--- | :--- | :--- |
| **Windows 10/11** | Node.js >= 18 LTS | Rust >= 1.77 (`rustup`) | Visual Studio C++ Build Tools, Microsoft Edge WebView2 (pre-installed on Win 10/11) |
| **macOS** (Apple Silicon & Intel) | Node.js >= 18 LTS | Rust >= 1.77 (`rustup`) | Xcode Command Line Tools (`xcode-select --install`) |
| **Linux** (Ubuntu / Debian / Fedora / Arch) | Node.js >= 18 LTS | Rust >= 1.77 (`rustup`) | `libwebkit2gtk-4.1-dev`, `libssl-dev`, `libsecret-1-dev`, `build-essential`, `pkg-config` |

### Quick dependency installation for Linux:
```bash
# Ubuntu / Debian / Pop!_OS
sudo apt update && sudo apt install -y build-essential pkg-config libwebkit2gtk-4.1-dev libappindicator3-dev librsvg2-dev patchelf libssl-dev libsecret-1-dev

# Fedora
sudo dnf install webkit2gtk4.1-devel openssl-devel libsecret-devel

# Arch Linux
sudo pacman -S webkit2gtk-4.1 openssl libsecret base-devel
```

---

## 2. Running Development with Hot Reload

The project supports two flexible development modes:
1. **Web Dev Mode (`--web`)**: Runs the Vite frontend in standard web browsers with the mock sandbox engine. Extremely fast for developing UI, Tailwind CSS, and React components without requiring a native Rust build.
2. **Desktop App Mode (`--app`)**: Launches the native Tauri desktop window with synchronized Hot Reload for both Frontend (Vite HMR) and Backend (Rust recompilation via Cargo).

### Method 1: Standard npm Scripts (Recommended & Cross-Platform)
```bash
# 1. Run Web Browser Hot Reload (Fastest for UI development)
npm run dev
# or
npm run dev:web

# 2. Run Native Desktop App with Rust backend hot reload
npm run dev:app
# or
npm run dev:desktop
```

### Method 2: Direct Node.js Script (`scripts/dev.mjs`)
The cross-platform Node.js script automatically detects the host OS, checks system prerequisites, and verifies port 1420 availability:
```bash
node scripts/dev.mjs --web
node scripts/dev.mjs --app
node scripts/dev.mjs --port 3000
```

### Method 3: OS-Specific Shell / PowerShell Scripts
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

## 3. Optimized Production Packaging (Build + Release)

The production build pipeline automatically applies deep optimizations:
1. **TypeScript Strict Verification**: Runs `tsc --noEmit` automatically to prevent any type errors before bundling.
2. **Vite Frontend Minification & Tree-shaking**: Compresses JavaScript/CSS bundles and optimizes Tailwind v4 chunks.
3. **Rust Compiler Release Profile**:
   - `opt-level = 3`: Maximizes CPU runtime execution performance.
   - `lto = true`: Link-Time Optimization across all dependency crates.
   - `codegen-units = 1`: Performs global whole-program optimization for smaller binary sizes.
   - `panic = "abort"`: Removes stack unwinding tables, reducing binary footprint by 20–30%.
   - `strip = true`: Strips debug symbols and symbol tables from the final executable.
4. **Automated SHA-256 Checksums**: Generates a summary table displaying package file sizes and integrity hashes.

### Method 1: Standard npm Scripts
```bash
# Package production desktop installers for the current OS
npm run build:prod
# or
npm run build:app

# Build static web distribution only (dist/)
npm run build:web
```

### Method 2: Cross-Platform Node.js Script (`scripts/build.mjs`)
```bash
node scripts/build.mjs
node scripts/build.mjs --web-only
```

### Method 3: OS-Specific Scripts
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

## 4. Output Formats and Artifact Locations

All production installer artifacts are stored in:
`backend/target/release/bundle/`

| Platform | Installer Format | Detailed Output Path |
| :--- | :--- | :--- |
| **Windows** | `.exe` (NSIS Installer) | `backend/target/release/bundle/nsis/Stage0_0.1.0_x64-setup.exe` |
| **Windows** | `.msi` (Windows Installer) | `backend/target/release/bundle/msi/Stage0_0.1.0_x64_en-US.msi` |
| **macOS** | `.dmg` (Apple Disk Image) | `backend/target/release/bundle/dmg/Stage0_0.1.0_aarch64.dmg` |
| **macOS** | `.app` (Application Bundle) | `backend/target/release/bundle/macos/Stage0.app` |
| **Linux** | `.AppImage` (Portable Binary) | `backend/target/release/bundle/appimage/stage0_0.1.0_amd64.AppImage` |
| **Linux** | `.deb` (Debian/Ubuntu Package) | `backend/target/release/bundle/deb/stage0_0.1.0_amd64.deb` |

---

## 5. Troubleshooting

### Port 1420 is already in use:
If port `1420` is occupied by another process:
- **Windows**: Run `netstat -ano | findstr :1420` then `taskkill /PID <PID> /F`
- **macOS/Linux**: Run `lsof -i :1420` then `kill -9 <PID>`

### Missing WebView2 on Windows:
- Windows 10/11 comes with WebView2 Runtime pre-installed. If missing, download it from Microsoft's official portal: [WebView2 Runtime Evergreen Bootstrapper](https://go.microsoft.com/fwlink/p/?LinkId=2124703).

### Execution Permissions on macOS/Linux:
If you encounter a `Permission denied` error:
```bash
chmod +x scripts/*.sh scripts/*.mjs
```
