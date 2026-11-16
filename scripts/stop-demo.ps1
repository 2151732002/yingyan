$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$recordPath = Join-Path $projectRoot '.local/processes.json'
if (!(Test-Path -LiteralPath $recordPath)) { Write-Host 'No owned demo processes recorded.'; exit }
$entries = Get-Content -Raw -LiteralPath $recordPath | ConvertFrom-Json
$stopped = 0
foreach ($entry in $entries) {
    $owned = Get-Process -Id $entry.id -ErrorAction SilentlyContinue
    if ($owned -and $owned.ProcessName -eq $entry.name -and $owned.StartTime.ToUniversalTime().Ticks.ToString() -eq $entry.ticks) {
        Stop-Process -Id $owned.Id
        $owned.WaitForExit(5000) | Out-Null
        $stopped++
    }
}
Remove-Item -LiteralPath $recordPath
Write-Host "Stopped $stopped owned processes; saved projects and assets are retained."
