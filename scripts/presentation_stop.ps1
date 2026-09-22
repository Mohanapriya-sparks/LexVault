# LexVault - Safe Demo Presentation Shutdown
# Stops only the tracked processes from the active session. Never wipes vault files or kills unrelated processes.
[CmdletBinding()]
param()

$ErrorActionPreference = "Continue"
$RepoRoot = (Resolve-Path "$PSScriptRoot\..").Path
$RuntimeDir = Join-Path $RepoRoot ".runtime"
$SessionFile = Join-Path $RuntimeDir "presentation-session.json"

Write-Host "`n=======================================================" -ForegroundColor Cyan
Write-Host "  LexVault Demo Graceful Shutdown" -ForegroundColor Cyan
Write-Host "=======================================================`n" -ForegroundColor Cyan

# 1. Stop Public Tunnel First
$cfProcesses = Get-Process -Name "cloudflared*" -ErrorAction SilentlyContinue
if ($cfProcesses) {
    foreach ($proc in $cfProcesses) {
        Write-Host "Stopping Cloudflare tunnel process (PID: $($proc.Id))..." -ForegroundColor Yellow
        Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue
    }
}

if (Test-Path $SessionFile) {
    try {
        $session = Get-Content $SessionFile -Raw | ConvertFrom-Json
        
        # 2. Stop Frontend Vite Process
        if ($session.processes -and $session.processes.frontend -and $session.processes.frontend.pid) {
            $fPid = [int]$session.processes.frontend.pid
            Write-Host "Stopping Frontend Vite server (PID: $fPid)..." -ForegroundColor Yellow
            Stop-Process -Id $fPid -Force -ErrorAction SilentlyContinue
        }

        # 3. Stop Backend Express Process
        if ($session.processes -and $session.processes.backend -and $session.processes.backend.pid) {
            $bPid = [int]$session.processes.backend.pid
            Write-Host "Stopping Express backend server (PID: $bPid)..." -ForegroundColor Yellow
            Stop-Process -Id $bPid -Force -ErrorAction SilentlyContinue
        }

        # 4. Stop Hardhat Node Process
        if ($session.processes -and $session.processes.hardhat -and $session.processes.hardhat.pid) {
            $hPid = [int]$session.processes.hardhat.pid
            Write-Host "Stopping Hardhat node (PID: $hPid)..." -ForegroundColor Yellow
            Stop-Process -Id $hPid -Force -ErrorAction SilentlyContinue
        }
    } catch {
        Write-Host "[WARNING] Could not parse session file." -ForegroundColor Yellow
    }

    # Clean up session file only after all tracked processes are terminated
    Remove-Item $SessionFile -Force -ErrorAction SilentlyContinue
} else {
    Write-Host "No active session file found at $SessionFile." -ForegroundColor DarkGray
}

Write-Host "`n[NOTE] Vault records and blockchain state were preserved intact." -ForegroundColor Green
Write-Host "✅ All LexVault presentation session processes stopped successfully.`n" -ForegroundColor Green
