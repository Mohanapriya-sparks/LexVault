# LexVault Presentation Orchestrator
# Starts Hardhat, Backend, Frontend, and optional Cloudflare Tunnel with full process tracking.
[CmdletBinding()]
param(
    [switch]$PublicTunnel,
    [switch]$ResetDemo
)

$ErrorActionPreference = "Stop"
$RepoRoot = (Resolve-Path "$PSScriptRoot\..").Path
Set-Location $RepoRoot

$RuntimeDir = Join-Path $RepoRoot ".runtime"
$LogDir = Join-Path $RuntimeDir "logs"
$SessionFile = Join-Path $RuntimeDir "presentation-session.json"

if (-not (Test-Path $LogDir)) {
    New-Item -ItemType Directory -Path $LogDir -Force | Out-Null
}

function Write-Banner {
    param([string]$Text, [string]$Color = "Cyan")
    Write-Host "`n=======================================================" -ForegroundColor $Color
    Write-Host "  $Text" -ForegroundColor $Color
    Write-Host "=======================================================`n" -ForegroundColor $Color
}

function Get-PortPid {
    param([int]$Port)
    $conn = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($conn) {
        return [int]$conn.OwningProcess
    }
    return $null
}

function Start-DetachedProcess {
    param(
        [string]$CommandLine,
        [string]$WorkingDirectory
    )
    $res = Invoke-CimMethod -ClassName Win32_Process -MethodName Create -Arguments @{
        CommandLine = $CommandLine
        CurrentDirectory = $WorkingDirectory
    }
    return [int]$res.ProcessId
}

function Wait-ForPort {
    param(
        [int]$Port,
        [string]$ServiceName,
        [string]$LogFile,
        [int]$TimeoutSeconds = 30
    )
    Write-Host "Waiting for $ServiceName on port $Port (timeout: ${TimeoutSeconds}s)..." -ForegroundColor Yellow
    $stopwatch = [System.Diagnostics.Stopwatch]::StartNew()
    while ($stopwatch.Elapsed.TotalSeconds -lt $TimeoutSeconds) {
        $p = Get-PortPid -Port $Port
        if ($null -ne $p) {
            Write-Host "  -> $ServiceName is ready and listening on port $Port (PID: $p, $([math]::Round($stopwatch.Elapsed.TotalSeconds, 1))s)!" -ForegroundColor Green
            return $true
        }
        Start-Sleep -Milliseconds 500
    }
    Write-Host "`n[ERROR] $ServiceName failed to start on port $Port within $TimeoutSeconds seconds." -ForegroundColor Red
    if (Test-Path $LogFile) {
        Write-Host "[ERROR] Log output from $LogFile :" -ForegroundColor Red
        Get-Content $LogFile -Tail 25 | Write-Host -ForegroundColor DarkRed
    }
    return $false
}

function Find-Cloudflared {
    $candidates = @(
        (Join-Path $RepoRoot "cloudflared-windows-amd64.exe"),
        (Join-Path $RepoRoot "cloudflared.exe"),
        "$env:USERPROFILE\Downloads\cloudflared-windows-amd64.exe",
        "$env:USERPROFILE\Downloads\cloudflared.exe"
    )
    foreach ($cand in $candidates) {
        if (Test-Path $cand) {
            return $cand
        }
    }
    $cmd = Get-Command cloudflared-windows-amd64.exe -ErrorAction SilentlyContinue
    if ($cmd) { return $cmd.Source }
    $cmd = Get-Command cloudflared.exe -ErrorAction SilentlyContinue
    if ($cmd) { return $cmd.Source }
    return $null
}

Write-Banner "LexVault Presentation Startup Orchestrator" "Cyan"

# 0. Handle Interactive Reset Confirmation
if ($ResetDemo) {
    Write-Host "WARNING: DEMO RESET REQUESTED!" -ForegroundColor Yellow
    Write-Host "This will re-deploy contracts and re-seed clean baseline demo cases (#101, #102, #103, #107)." -ForegroundColor Yellow
    $confirm = Read-Host "Type 'RESET-DEMO' to confirm clean reset"
    if ($confirm -ne "RESET-DEMO") {
        Write-Host "Reset aborted by user. Exiting." -ForegroundColor Red
        exit 1
    }
    Write-Host "Confirmed. Proceeding with clean reset..." -ForegroundColor Green

    # If previous session exists, shut it down first
    if (Test-Path $SessionFile) {
        & "$PSScriptRoot\presentation_stop.ps1"
    }
}

# 1. Hardhat Node (Port 8545)
$hardhatPort = 8545
$hardhatLog = Join-Path $LogDir "hardhat.log"
$hardhatErrLog = Join-Path $LogDir "hardhat_err.log"

$existingHhPid = Get-PortPid -Port $hardhatPort
if ($null -ne $existingHhPid) {
    Write-Host "  -> Hardhat node is already running on port $hardhatPort (PID: $existingHhPid)." -ForegroundColor Green
    $hardhatPid = $existingHhPid
} else {
    Write-Host "Starting Hardhat node on 127.0.0.1:$hardhatPort..." -ForegroundColor Cyan
    $hhCli = Join-Path $RepoRoot "node_modules\hardhat\internal\cli\cli.js"
    $hhCmd = "cmd.exe /c node `"$hhCli`" node --hostname 127.0.0.1 --port $hardhatPort > `"$hardhatLog`" 2> `"$hardhatErrLog`""
    $null = Start-DetachedProcess -CommandLine $hhCmd -WorkingDirectory $RepoRoot
    
    if (-not (Wait-ForPort -Port $hardhatPort -ServiceName "Hardhat Node" -LogFile $hardhatLog -TimeoutSeconds 25)) {
        exit 1
    }
    $hardhatPid = Get-PortPid -Port $hardhatPort
}

# 2. Check if contracts are deployed on active Hardhat node
$deploymentPath = Join-Path $RepoRoot "deployment.json"
$needsDeployment = $false

if ($ResetDemo -or (-not (Test-Path $deploymentPath))) {
    $needsDeployment = $true
} else {
    try {
        $dep = Get-Content $deploymentPath -Raw | ConvertFrom-Json
        $ledgerAddr = $dep.custodyLedgerAddress
        $rpcPayload = @{ jsonrpc = "2.0"; method = "eth_getCode"; params = @($ledgerAddr, "latest"); id = 1 } | ConvertTo-Json
        $rpcRes = Invoke-RestMethod -Uri "http://127.0.0.1:$hardhatPort" -Method Post -Body $rpcPayload -ContentType "application/json" -TimeoutSec 5
        if (-not $rpcRes.result -or $rpcRes.result -eq "0x") {
            Write-Host "No contract bytecode found at $ledgerAddr on active node. Deployment required." -ForegroundColor Yellow
            $needsDeployment = $true
        } else {
            Write-Host "  -> Verified contract bytecode present at $ledgerAddr on active node." -ForegroundColor Green
        }
    } catch {
        $needsDeployment = $true
    }
}

if ($needsDeployment) {
    Write-Host "Deploying smart contracts to Hardhat network (localhost)..." -ForegroundColor Cyan
    $deployOut = & npx hardhat run "$RepoRoot\scripts\deploy.js" --network localhost 2>&1
    Write-Host ($deployOut -join "`n") -ForegroundColor DarkGray
    if ($LASTEXITCODE -ne 0) {
        Write-Host "[ERROR] Contract deployment failed!" -ForegroundColor Red
        exit 1
    }
    Write-Host "Contracts deployed successfully." -ForegroundColor Green

    # 3. Seed demo cases (#101, #102, #103, #107)
    Write-Host "Seeding baseline demo cases (#101, #102, #103, #107)..." -ForegroundColor Cyan
    $seedOut = & npx hardhat run "$RepoRoot\scripts\seed_demo.js" --network localhost 2>&1
    Write-Host ($seedOut -join "`n") -ForegroundColor DarkGray
    if ($LASTEXITCODE -ne 0) {
        Write-Host "[ERROR] Seed demo script failed!" -ForegroundColor Red
        exit 1
    }
    Write-Host "Demo cases seeded successfully." -ForegroundColor Green
}

# 4. Backend Server (Port 3001)
$backendPort = 3001
$backendLog = Join-Path $LogDir "backend.log"
$backendErrLog = Join-Path $LogDir "backend_err.log"

$existingBackendPid = Get-PortPid -Port $backendPort
$needBackendRestart = $false

if ($null -ne $existingBackendPid) {
    if ($needsDeployment) {
        Write-Host "Restarting backend (PID: $existingBackendPid) to connect to fresh contracts..." -ForegroundColor Yellow
        Stop-Process -Id $existingBackendPid -Force -ErrorAction SilentlyContinue
        Start-Sleep -Seconds 1
        $needBackendRestart = $true
    } else {
        try {
            $healthCheck = Invoke-RestMethod -Uri "http://localhost:$backendPort/api/cases" -Method Get -TimeoutSec 3
            if ($healthCheck.success -eq $true) {
                Write-Host "  -> Express backend is healthy on port $backendPort (PID: $existingBackendPid)." -ForegroundColor Green
                $backendPid = $existingBackendPid
            } else {
                $needBackendRestart = $true
            }
        } catch {
            Write-Host "Backend on port $backendPort returned unhealthy. Restarting..." -ForegroundColor Yellow
            Stop-Process -Id $existingBackendPid -Force -ErrorAction SilentlyContinue
            Start-Sleep -Seconds 1
            $needBackendRestart = $true
        }
    }
} else {
    $needBackendRestart = $true
}

if ($needBackendRestart) {
    Write-Host "Starting Express backend on port $backendPort..." -ForegroundColor Cyan
    $tsNodeBin = Join-Path $RepoRoot "node_modules\ts-node\dist\bin.js"
    $backendCmd = "cmd.exe /c node `"$tsNodeBin`" backend/src/server.ts > `"$backendLog`" 2> `"$backendErrLog`""
    $null = Start-DetachedProcess -CommandLine $backendCmd -WorkingDirectory $RepoRoot

    if (-not (Wait-ForPort -Port $backendPort -ServiceName "Express Backend" -LogFile $backendLog -TimeoutSeconds 30)) {
        exit 1
    }
    $backendPid = Get-PortPid -Port $backendPort
}

# 5. Handle Cloudflare Public Tunnel
$publicHostname = $null
$publicUrl = $null
$tunnelPid = $null
$tunnelLog = Join-Path $LogDir "cloudflared.log"

if ($PublicTunnel) {
    # Stop any prior running tunnel instances first to prevent port contention
    $oldTunnels = Get-Process -Name "cloudflared*" -ErrorAction SilentlyContinue
    if ($oldTunnels) {
        $oldTunnels | Stop-Process -Force -ErrorAction SilentlyContinue
        Start-Sleep -Milliseconds 500
    }

    $cloudflaredPath = Find-Cloudflared
    if (-not $cloudflaredPath) {
        Write-Host "[ERROR] cloudflared-windows-amd64.exe was not found on the system." -ForegroundColor Red
        Write-Host "Please place cloudflared-windows-amd64.exe in the repository root or Downloads folder." -ForegroundColor Yellow
        exit 1
    }
    Write-Host "Found Cloudflare binary: $cloudflaredPath" -ForegroundColor DarkGray
    Write-Host "Starting Cloudflare Quick Tunnel to http://127.0.0.1:3000..." -ForegroundColor Cyan

    # Clear previous tunnel log
    if (Test-Path $tunnelLog) { Remove-Item $tunnelLog -Force -ErrorAction SilentlyContinue }

    $cfCmd = "`"$cloudflaredPath`" tunnel --protocol http2 --url http://127.0.0.1:3000 --logfile `"$tunnelLog`""
    $tunnelSpawnPid = Start-DetachedProcess -CommandLine $cfCmd -WorkingDirectory $RepoRoot

    Write-Host "Extracting generated trycloudflare.com tunnel URL..." -ForegroundColor Yellow
    $sw = [System.Diagnostics.Stopwatch]::StartNew()
    $extractedUrl = $null

    while ($sw.Elapsed.TotalSeconds -lt 25) {
        if (Test-Path $tunnelLog) {
            $logContent = Get-Content $tunnelLog -Raw -ErrorAction SilentlyContinue
            if ($logContent -match 'https://[a-zA-Z0-9-]+\.trycloudflare\.com') {
                $extractedUrl = $matches[0]
                break
            }
        }
        Start-Sleep -Milliseconds 500
    }

    if (-not $extractedUrl) {
        Write-Host "[ERROR] Failed to obtain trycloudflare.com URL from tunnel output within 25 seconds." -ForegroundColor Red
        if (Test-Path $tunnelLog) { Get-Content $tunnelLog -Tail 20 | Write-Host -ForegroundColor DarkRed }
        exit 1
    }

    $uriObj = [System.Uri]$extractedUrl
    $publicHostname = $uriObj.Host
    $publicUrl = $extractedUrl
    $tunnelPid = $tunnelSpawnPid

    Write-Host "  -> Public Tunnel Established: $extractedUrl" -ForegroundColor Green
    Write-Host "  -> Passing Host to Vite: $publicHostname" -ForegroundColor Cyan
}

# 6. Frontend Vite Server (Port 3000)
$frontendPort = 3000
$frontendLog = Join-Path $LogDir "frontend.log"
$frontendErrLog = Join-Path $LogDir "frontend_err.log"

$existingFrontendPid = Get-PortPid -Port $frontendPort
$needFrontendRestart = $false

if ($null -ne $existingFrontendPid) {
    if ($PublicTunnel -and $publicHostname) {
        Write-Host "Frontend is running (PID: $existingFrontendPid), restarting Vite to load new tunnel allowedHost ($publicHostname)..." -ForegroundColor Yellow
        Stop-Process -Id $existingFrontendPid -Force -ErrorAction SilentlyContinue
        Start-Sleep -Seconds 1
        $needFrontendRestart = $true
    } else {
        Write-Host "  -> Vite Frontend is already running on port $frontendPort (PID: $existingFrontendPid)." -ForegroundColor Green
        $frontendPid = $existingFrontendPid
    }
} else {
    $needFrontendRestart = $true
}

if ($needFrontendRestart) {
    Write-Host "Starting Vite frontend on port $frontendPort..." -ForegroundColor Cyan
    $frontendDir = Join-Path $RepoRoot "frontend"
    $viteBin = Join-Path $frontendDir "node_modules\vite\bin\vite.js"
    
    $hostEnv = if ($publicHostname) { "set __VITE_ADDITIONAL_SERVER_ALLOWED_HOSTS=$publicHostname&& " } else { "" }
    $frontendCmd = "cmd.exe /c ${hostEnv}node `"$viteBin`" > `"$frontendLog`" 2> `"$frontendErrLog`""
    $null = Start-DetachedProcess -CommandLine $frontendCmd -WorkingDirectory $frontendDir

    if (-not (Wait-ForPort -Port $frontendPort -ServiceName "Vite Frontend" -LogFile $frontendLog -TimeoutSeconds 25)) {
        exit 1
    }
    $frontendPid = Get-PortPid -Port $frontendPort
}

# 7. Construct fresh session file
$session = @{
    startedAt = (Get-Date).ToString("o")
    processes = @{
        hardhat  = @{ pid = $hardhatPid; port = $hardhatPort; log = $hardhatLog }
        backend  = @{ pid = $backendPid; port = $backendPort; log = $backendLog }
        frontend = @{ pid = $frontendPid; port = $frontendPort; log = $frontendLog }
    }
    localFrontendUrl = "http://localhost:3000"
    localBackendUrl = "http://localhost:3001"
    rpcUrl = "http://127.0.0.1:8545"
    publicUrl = $publicUrl
}

if ($PublicTunnel -and $publicUrl) {
    $cfProcs = Get-Process -Name "cloudflared*" -ErrorAction SilentlyContinue | Select-Object -First 1
    $actualTunnelPid = if ($cfProcs) { $cfProcs.Id } else { $tunnelPid }
    $session.processes["tunnel"] = @{ pid = $actualTunnelPid; url = $publicUrl; log = $tunnelLog }
}

$sessionJson = $session | ConvertTo-Json -Depth 5
Set-Content -Path $SessionFile -Value $sessionJson -Force

# 8. Final Health Summary
Write-Banner "LexVault System Startup Complete" "Green"
Write-Host "  [+] Local Frontend:  http://localhost:3000" -ForegroundColor Cyan
Write-Host "  [+] Local Backend:   http://localhost:3001" -ForegroundColor Cyan
Write-Host "  [+] Hardhat Node:    http://127.0.0.1:8545 (Chain ID: 31337)" -ForegroundColor Cyan

if ($session.publicUrl) {
    Write-Host "`n  =======================================================" -ForegroundColor Magenta
    Write-Host "  🌟 JUDGE PUBLIC TUNNEL URL:" -ForegroundColor Magenta
    Write-Host "     $($session.publicUrl)" -ForegroundColor Yellow
    Write-Host "  =======================================================`n" -ForegroundColor Magenta
}

Write-Host "To verify system readiness, run:" -ForegroundColor White
Write-Host "  powershell -ExecutionPolicy Bypass -File scripts/presentation_preflight.ps1`n" -ForegroundColor Gray
