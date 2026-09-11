param([switch]$NoBrowser)
$ErrorActionPreference = 'Stop'
$gameFolder = $PSScriptRoot
$gameUrl = 'http://127.0.0.1:4174'
$gameRunning = $false
try {
    $gameHealth = Invoke-RestMethod -Uri "$gameUrl/__skyway_health" -TimeoutSec 2
    $gameRunning = $gameHealth.app -eq 'monster-skyway'
} catch { }
if (-not $gameRunning) {
    $gameNode = Get-Command node -ErrorAction SilentlyContinue
    if (-not $gameNode) { throw 'Install Node.js 22.12 or newer, then run Play.cmd again.' }
    if (-not (Test-Path -LiteralPath (Join-Path $gameFolder 'dist/index.html'))) { throw 'Build the game first: npm ci, then npm run build.' }
    $gameLogs = Join-Path $gameFolder '.tmp'
    New-Item -ItemType Directory -Path $gameLogs -Force | Out-Null
    Start-Process -FilePath $gameNode.Source -ArgumentList @('scripts/serve.mjs') -WorkingDirectory $gameFolder -WindowStyle Hidden -RedirectStandardOutput (Join-Path $gameLogs 'server.log') -RedirectStandardError (Join-Path $gameLogs 'server-error.log') | Out-Null
    for ($attempt = 0; $attempt -lt 25; $attempt++) {
        Start-Sleep -Milliseconds 200
        try {
            $gameHealth = Invoke-RestMethod -Uri "$gameUrl/__skyway_health" -TimeoutSec 1
            if ($gameHealth.app -eq 'monster-skyway') { $gameRunning = $true; break }
        } catch { }
    }
    if (-not $gameRunning) { throw "The game could not start. Check $gameLogs/server-error.log; port 4174 may already be in use." }
}
Write-Host "Monster Skyway is ready: $gameUrl"
if (-not $NoBrowser) { Start-Process $gameUrl }
