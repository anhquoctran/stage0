$port = 1420
$found = $false

# 1. Kill by TCP port connection
$connections = Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue
if ($connections) {
    foreach ($conn in $connections) {
        $pidToKill = $conn.OwningProcess
        if ($pidToKill -gt 0) {
            Write-Host "Found process $pidToKill listening on port $port. Terminating..."
            Stop-Process -Id $pidToKill -Force -ErrorAction SilentlyContinue
            $found = $true
        }
    }
}

# 2. Kill by netstat fallback
$netstatLines = netstat -ano | Select-String ":$port\s"
foreach ($line in $netstatLines) {
    $parts = ($line.ToString().Trim() -split '\s+')
    $netstatPid = [int]($parts[-1])
    if ($netstatPid -gt 0 -and $netstatPid -ne $PID) {
        Write-Host "Netstat found PID $netstatPid on port $port. Terminating..."
        Stop-Process -Id $netstatPid -Force -ErrorAction SilentlyContinue
        $found = $true
    }
}

# 3. Kill any lingering stage0.exe processes
Get-Process -Name "stage0" -ErrorAction SilentlyContinue | ForEach-Object {
    Write-Host "Killing dangling stage0 process (PID $($_.Id))..."
    Stop-Process -Id $_.Id -Force -ErrorAction SilentlyContinue
    $found = $true
}

# 4. Kill node processes associated with port 1420 or dev.mjs
Get-CimInstance Win32_Process -Filter "Name = 'node.exe'" -ErrorAction SilentlyContinue | ForEach-Object {
    if ($_.CommandLine -match "1420|dev\.mjs|tauri dev") {
        Write-Host "Killing Node dev server process (PID $($_.ProcessId))..."
        Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue
        $found = $true
    }
}

if (-not $found) {
    Write-Host "Port $port is completely free. No holding processes found."
} else {
    Write-Host "Successfully cleared port $port and related development processes."
}
