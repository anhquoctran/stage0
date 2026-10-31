<#
.SYNOPSIS
    Stage0 development launcher for Windows.
.DESCRIPTION
    Delegates to the cross-platform Node.js launcher.
.PARAMETER Mode
    App (default) runs Tauri; Web runs Vite in the browser.
.PARAMETER Port
    Web-mode port (default 1420). App mode always uses Tauri's configured port.
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

if (Test-Path (Join-Path $RootDir ".nvmrc")) {
    $TargetNodeVer = (Get-Content (Join-Path $RootDir ".nvmrc") -Raw).Trim()
    if (Get-Command "nvm" -ErrorAction SilentlyContinue) {
        try { nvm use $TargetNodeVer | Out-Null } catch { }
    }
}

$NodeArgs = @()
if ($Mode -eq "Web") { $NodeArgs += "--web" }
if ($PSBoundParameters.ContainsKey("Port")) { $NodeArgs += @("--port", "$Port") }

& node (Join-Path $ScriptDir "dev.mjs") @NodeArgs
exit $LASTEXITCODE
