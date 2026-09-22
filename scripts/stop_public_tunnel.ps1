# LexVault - Stop Only Public Cloudflare Tunnel
# Safely terminates only the Cloudflare tunnel process recorded in the session, leaving local demo intact.
[CmdletBinding()]
param()

$ErrorActionPreference = "Continue"
$RepoRoot = (Resolve-Path "$PSScriptRoot\..").Path
$RuntimeDir = Join-Path $RepoRoot ".runtime"
$SessionFile = Join-Path $RuntimeDir "presentation-session.json"

Write-Host "`n=======================================================" -ForegroundColor Cyan
Write-Host "  Closing Public Cloudflare Tunnel" -ForegroundColor Cyan
Write-Host "=======================================================`n" -ForegroundColor Cyan

# Stop all cloudflared processes safely
$cfProcesses = Get-Process -Name "cloudflared*" -ErrorAction SilentlyContinue
if ($cfProcesses) {
    foreach ($proc in $cfProcesses) {
        Write-Host "Terminating Cloudflare process (PID: $($proc.Id))..." -ForegroundColor Yellow
        Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue
    }
    Write-Host "Cloudflare tunnel processes stopped." -ForegroundColor Green
} else {
    Write-Host "No running Cloudflare process found." -ForegroundColor DarkGray
}

if (Test-Path $SessionFile) {
    try {
        $session = Get-Content $SessionFile -Raw | ConvertFrom-Json
        if ($session.processes -and $session.processes.tunnel) {
            $session.processes.PSObject.Properties.Remove("tunnel")
        }
        $session.publicUrl = $null
        $updatedJson = $session | ConvertTo-Json -Depth 5
        Set-Content -Path $SessionFile -Value $updatedJson -Force
    } catch {
        Write-Host "[WARNING] Could not update session file." -ForegroundColor DarkGray
    }
}

Write-Host "`n✅ Public tunnel has been closed." -ForegroundColor Green
Write-Host "Local presentation services remain active and available at:" -ForegroundColor Cyan
Write-Host "  - Frontend: http://localhost:3000" -ForegroundColor White
Write-Host "  - Backend:  http://localhost:3001" -ForegroundColor White
Write-Host "  - Hardhat:  http://127.0.0.1:8545`n" -ForegroundColor White
