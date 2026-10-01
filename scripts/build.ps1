<#
.SYNOPSIS
    Stage0 Optimized Production Builder for Windows
.DESCRIPTION
    Builds the optimized production installer for Windows (.exe NSIS installer and .msi).
    Applies LTO, binary stripping, and creates SHA-256 integrity checksums.
.PARAMETER WebOnly
    Only build the frontend web assets in dist/ directory.
.PARAMETER SkipTypeCheck
    Skip the TypeScript verification phase.
.EXAMPLE
    .\scripts\build.ps1
    .\scripts\build.ps1 -WebOnly
#>

param(
    [switch]$WebOnly,
    [switch]$SkipTypeCheck
)

$ErrorActionPreference = "Stop"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$RootDir = Split-Path -Parent $ScriptDir
$BackendDir = Join-Path $RootDir "backend"
$DistDir = Join-Path $RootDir "dist"
Set-Location $RootDir

Write-Host ""
Write-Host "======================================================" -ForegroundColor Cyan
Write-Host "  * Stage0 Virtual MR Sandbox - Production Build (Win)" -ForegroundColor Magenta
Write-Host "======================================================" -ForegroundColor Cyan
Write-Host "Platform : Windows ($([System.Environment]::GetEnvironmentVariable('PROCESSOR_ARCHITECTURE')))" -ForegroundColor DarkGray
Write-Host "Mode     : $(if ($WebOnly) { 'Web Only' } else { 'Full Windows Desktop Release' })" -ForegroundColor White
Write-Host "------------------------------------------------------" -ForegroundColor Cyan
Write-Host ""

# 0. Synchronize Software About & Release Information
node scripts/generate-about-info.mjs
if ($LASTEXITCODE -ne 0) {
    Write-Host "[ERROR] Failed to synchronize release metadata." -ForegroundColor Red
    exit 1
}

# 1. TypeScript Verification
if (-not $SkipTypeCheck) {
    Write-Host "[1/4] Running TypeScript strict type checking..." -ForegroundColor Cyan
    npx tsc --noEmit
    if ($LASTEXITCODE -ne 0) {
        Write-Host "[ERROR] TypeScript validation failed." -ForegroundColor Red
        exit 1
    }
    Write-Host "[OK] TypeScript check passed cleanly." -ForegroundColor Green
    Write-Host ""
}

# 2. Clean previous dist
Write-Host "[2/4] Cleaning previous build artifacts..." -ForegroundColor Cyan
if (Test-Path $DistDir) {
    Remove-Item -Recurse -Force $DistDir
}
Write-Host "[OK] Cleaned $DistDir" -ForegroundColor Green
Write-Host ""

# 3. Compile Frontend with Vite
Write-Host "[3/4] Compiling optimized frontend bundle with Vite..." -ForegroundColor Cyan
npx vite build
if ($LASTEXITCODE -ne 0) {
    Write-Host "[ERROR] Vite build failed." -ForegroundColor Red
    exit 1
}
Write-Host "[OK] Frontend assets compiled to dist/" -ForegroundColor Green
Write-Host ""

if ($WebOnly) {
    Write-Host "[SUCCESS] Web production build completed at $DistDir" -ForegroundColor Green
    exit 0
}

# 4. Build Native Desktop Installer with Tauri
Write-Host "[4/4] Compiling release binary and packaging Windows installers (.exe / .msi)..." -ForegroundColor Cyan
Write-Host "      Optimizations: LTO=true, Opt-level=3, Strip=true, Codegen-units=1" -ForegroundColor DarkGray
Write-Host ""

if (-not $env:RUSTFLAGS) {
    # Keep standard target CPU architecture compatibility
}
npx tauri build

if ($LASTEXITCODE -ne 0) {
    Write-Host "[ERROR] Tauri build failed." -ForegroundColor Red
    exit 1
}

# 5. Output Summary & Checksums
Write-Host ""
Write-Host "======================================================" -ForegroundColor Cyan
Write-Host "  [OK] Production Build Succeeded!" -ForegroundColor Green
Write-Host "======================================================" -ForegroundColor Cyan

$BundleDir = Join-Path $BackendDir "target\release\bundle"
if (Test-Path $BundleDir) {
    $Installers = Get-ChildItem -Path $BundleDir -Recurse -Include *.exe, *.msi

    if ($Installers.Count -gt 0) {
        Write-Host ""
        Write-Host "Generated Installers and Checksums:" -ForegroundColor White
        Write-Host "--------------------------------------------------------------------------------" -ForegroundColor DarkGray
        foreach ($item in $Installers) {
            $SizeMB = [math]::Round($item.Length / 1MB, 2)
            $Hash = (Get-FileHash -Path $item.FullName -Algorithm SHA256).Hash.Substring(0, 16)
            Write-Host "  * $($item.Name) ($SizeMB MB) - SHA256: $Hash..." -ForegroundColor Green
            Write-Host "    Path: $($item.FullName)" -ForegroundColor DarkGray
        }
        Write-Host "--------------------------------------------------------------------------------" -ForegroundColor DarkGray
    }
}

Write-Host ""
Write-Host "[DONE] Ready for distribution." -ForegroundColor Green
Write-Host ""
