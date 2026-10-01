<#
.SYNOPSIS
    Stage0 Development Hot Reload Runner for Windows
.DESCRIPTION
    Runs the Stage0 Virtual MR application with hot-reload support on Windows.
.PARAMETER Mode
    'App' (default) to run full Tauri desktop app with native backend.
    'Web' to run fast browser-based mock environment.
.PARAMETER Port
    Local web-mode dev port (default: 1420). Tauri app mode uses port 1420.
.EXAMPLE
    .\scripts\dev.ps1
    .\scripts\dev.ps1 -Mode Web
    .\scripts\dev.ps1 -Port 3000
#>

param(
    [ValidateSet("App", "Web")]
    [string]$Mode = "App",
    [ValidateRange(1, 65535)]
    [int]$Port = 1420
)

$ErrorActionPreference = "Stop"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$RootDir = Split-Path -Parent $ScriptDir
Set-Location $RootDir

Write-Host ""
Write-Host "======================================================" -ForegroundColor Cyan
Write-Host "  * Stage0 Virtual MR Sandbox - Dev Runner (Windows)" -ForegroundColor Magenta
Write-Host "======================================================" -ForegroundColor Cyan
Write-Host "Platform : Windows ($([System.Environment]::GetEnvironmentVariable('PROCESSOR_ARCHITECTURE')))" -ForegroundColor DarkGray
Write-Host "Mode     : $Mode" -ForegroundColor White
if ($Mode -eq "App" -and $Port -ne 1420) {
    Write-Host "[WARN] -Port applies only to Web mode; Tauri desktop uses port 1420." -ForegroundColor Yellow
}
$TargetPort = if ($Mode -eq "App") { 1420 } else { $Port }
Write-Host "Port     : $TargetPort" -ForegroundColor DarkGray
Write-Host "------------------------------------------------------" -ForegroundColor Cyan
Write-Host ""

# 1. Verify Node.js
if (-not (Get-Command "node" -ErrorAction SilentlyContinue)) {
    Write-Host "[ERROR] Node.js is not found in PATH." -ForegroundColor Red
    Write-Host "Please install Node.js >= 18 from https://nodejs.org or via 'winget install OpenJS.NodeJS.LTS'"
    exit 1
}

$NodeVer = node --version
Write-Host "[OK] Node.js detected: $NodeVer" -ForegroundColor Green

# 2. Verify Rust & Cargo for native desktop mode
if ($Mode -eq "App") {
    if (-not (Get-Command "cargo" -ErrorAction SilentlyContinue)) {
        Write-Host "[WARN] Rust/Cargo is not installed or not in PATH." -ForegroundColor Yellow
        Write-Host "       Install Rust from https://rustup.rs or via 'winget install Rustlang.Rustup'"
        Write-Host "       Falling back to Web browser mode (-Mode Web)..." -ForegroundColor Yellow
        $Mode = "Web"
    } else {
        $RustVer = rustc --version
        Write-Host "[OK] Rust detected   : $RustVer" -ForegroundColor Green
    }
}

# 3. Check npm dependencies
if (-not (Test-Path "$RootDir\node_modules")) {
    Write-Host ""
    Write-Host "[INFO] Installing npm packages..." -ForegroundColor Yellow
    npm install
}

# Check the exact port the selected mode will use. Never kill an unrelated
# application automatically to make a development port available.
$Listener = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Loopback, $TargetPort)
$PortAvailable = $true
try {
    $Listener.Start()
} catch {
    $PortAvailable = $false
} finally {
    $Listener.Stop()
}
if (-not $PortAvailable) {
    Write-Host "[ERROR] Port $TargetPort is already in use. Close the owning process or choose another Web-mode port." -ForegroundColor Red
    exit 1
}

# 4. Launch Hot Reload
if ($Mode -eq "App") {
    Write-Host ""
    Write-Host "[INFO] Starting Tauri Native Desktop App with Hot Reload..." -ForegroundColor Green
    Write-Host "       Frontend: http://127.0.0.1:$TargetPort" -ForegroundColor DarkGray
    Write-Host "       Backend : Watching backend/src/*.rs for recompilation" -ForegroundColor DarkGray
    Write-Host ""
    npx tauri dev
} else {
    Write-Host ""
    Write-Host "[INFO] Starting Vite Web Server with Hot Reload..." -ForegroundColor Green
    Write-Host "       URL: http://127.0.0.1:$($TargetPort)/?mock" -ForegroundColor DarkGray
    Write-Host ""
    npx vite --host 127.0.0.1 --port $TargetPort --strictPort
}
