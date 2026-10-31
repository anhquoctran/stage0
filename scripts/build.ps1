<#
.SYNOPSIS
    Stage0 production builder for Windows.
.DESCRIPTION
    Delegates to the cross-platform Node.js builder.
.PARAMETER WebOnly
    Build web assets only.
.PARAMETER SkipTypeCheck
    Skip TypeScript verification.
#>
param(
    [switch]$WebOnly,
    [switch]$SkipTypeCheck
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
if ($WebOnly) { $NodeArgs += "--web-only" }
if ($SkipTypeCheck) { $NodeArgs += "--skip-typecheck" }

& node (Join-Path $ScriptDir "build.mjs") @NodeArgs
exit $LASTEXITCODE
