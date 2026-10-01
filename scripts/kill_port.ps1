param(
    [ValidateRange(1, 65535)]
    [int]$Port = 1420
)

$ErrorActionPreference = "Stop"

$connections = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
$processIds = @($connections | Select-Object -ExpandProperty OwningProcess -Unique)

if ($processIds.Count -eq 0) {
    Write-Host "No process is listening on port $Port."
    exit 0
}

foreach ($processId in $processIds) {
    if ($processId -le 0 -or $processId -eq $PID) {
        continue
    }

    $processInfo = Get-CimInstance Win32_Process -Filter "ProcessId = $processId" -ErrorAction SilentlyContinue
    $processName = if ($processInfo) { $processInfo.Name } else { "unknown process" }
    Write-Host "PID $processId ($processName) is listening on port $Port."
    $answer = Read-Host "Terminate this process? Type Y to confirm"
    if ($answer -ceq "Y") {
        Stop-Process -Id $processId -Force -ErrorAction Stop
        Write-Host "Terminated PID $processId."
    } else {
        Write-Host "Left PID $processId running."
    }
}
