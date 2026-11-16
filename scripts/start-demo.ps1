param([switch]$SkipInstall)
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$runtimePath = Join-Path $projectRoot '.local'
New-Item -ItemType Directory -Force -Path $runtimePath | Out-Null
$recordPath = Join-Path $runtimePath 'processes.json'
if (Test-Path -LiteralPath $recordPath) { throw 'Run scripts/stop-demo.ps1 before starting again.' }
foreach ($port in @(18080,3100)) {
    $listener = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Loopback,$port)
    try { $listener.Start() } catch { throw "Port $port is already in use." } finally { $listener.Stop() }
}
Push-Location $projectRoot
try {
    & mvn.cmd -f backend/pom.xml package -DskipTests
    if ($LASTEXITCODE -ne 0) { throw 'Backend build failed.' }
    Push-Location (Join-Path $projectRoot 'frontend')
    try {
        if (!$SkipInstall) { & npm.cmd ci; if ($LASTEXITCODE -ne 0) { throw 'Dependency installation failed.' } }
        & npm.cmd run build
        if ($LASTEXITCODE -ne 0) { throw 'Frontend build failed.' }
    } finally { Pop-Location }
    $javaCommand = (Get-Command java.exe).Source
    $nodeCommand = (Get-Command node.exe).Source
    $backend = Start-Process -FilePath $javaCommand -ArgumentList @('-jar','target/yingyan-server-0.1.0.jar','--spring.profiles.active=demo') -WorkingDirectory (Join-Path $projectRoot 'backend') -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $runtimePath 'backend.log') -RedirectStandardError (Join-Path $runtimePath 'backend-error.log')
    $frontend = Start-Process -FilePath $nodeCommand -ArgumentList @('node_modules/next/dist/bin/next','start','--hostname','127.0.0.1','--port','3100') -WorkingDirectory (Join-Path $projectRoot 'frontend') -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $runtimePath 'frontend.log') -RedirectStandardError (Join-Path $runtimePath 'frontend-error.log')
    @(@{id=$backend.Id;name='java';ticks=$backend.StartTime.ToUniversalTime().Ticks.ToString()},@{id=$frontend.Id;name='node';ticks=$frontend.StartTime.ToUniversalTime().Ticks.ToString()}) | ConvertTo-Json | Set-Content -LiteralPath $recordPath
    $ready = $false
    for ($attempt=0;$attempt -lt 60;$attempt++) {
        try {
            $health = Invoke-RestMethod -Uri 'http://127.0.0.1:18080/actuator/health' -TimeoutSec 2
            if ($health.status -eq 'UP') { $page = Invoke-WebRequest -Uri 'http://127.0.0.1:3100/api/system' -UseBasicParsing -TimeoutSec 2; if($page.StatusCode -eq 200){$ready=$true;break} }
        } catch {}
        Start-Sleep -Milliseconds 500
    }
    if (!$ready) { throw 'Services not ready. Inspect .local logs, then run stop-demo.ps1.' }
    Write-Host 'Yingyan is ready: http://127.0.0.1:3100'
    Write-Host 'Demo account: director / yingyan-demo-2026 (unless overridden in .env).'
    Write-Host 'Stop: powershell -ExecutionPolicy Bypass -File scripts/stop-demo.ps1'
} finally { Pop-Location }
