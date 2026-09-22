# LexVault Presentation Preflight Verification Script
# Non-destructive, read-only audit of all services, cryptography, role mappings, and isolated demo cases.
[CmdletBinding()]
param()

$RepoRoot = (Resolve-Path "$PSScriptRoot\..").Path
$RuntimeDir = Join-Path $RepoRoot ".runtime"
$SessionFile = Join-Path $RuntimeDir "presentation-session.json"

$passedChecks = 0
$totalChecks = 0
$failures = @()

function Test-Check {
    param(
        [string]$Name,
        [scriptblock]$Condition,
        [string]$SuccessMessage,
        [string]$FailureMessage
    )
    $script:totalChecks++
    Write-Host -NoNewline "  Checking $Name... " -ForegroundColor Yellow
    try {
        $res = & $Condition
        if ($res) {
            $script:passedChecks++
            Write-Host "[PASS]" -ForegroundColor Green
            if ($SuccessMessage) {
                Write-Host "    -> $SuccessMessage" -ForegroundColor DarkGreen
            }
        } else {
            Write-Host "[FAIL]" -ForegroundColor Red
            if ($FailureMessage) {
                Write-Host "    -> $FailureMessage" -ForegroundColor Red
            }
            $script:failures += "$Name : $FailureMessage"
        }
    } catch {
        Write-Host "[FAIL]" -ForegroundColor Red
        Write-Host "    -> Exception: $($_.Exception.Message)" -ForegroundColor Red
        $script:failures += "$Name : $($_.Exception.Message)"
    }
}

Write-Host "`n=======================================================" -ForegroundColor Cyan
Write-Host "  LexVault Pre-Presentation Verification (Preflight)" -ForegroundColor Cyan
Write-Host "=======================================================`n" -ForegroundColor Cyan
Write-Host "Mode: Read-only EVM eth_call: no transaction submitted, no blockchain state changed and no gas fee paid.`n" -ForegroundColor DarkGray

# 1. Frontend HTTP 200
Test-Check -Name "Frontend HTTP Status (Port 3000)" `
    -Condition {
        $res = Invoke-WebRequest -Uri "http://localhost:3000" -UseBasicParsing -TimeoutSec 5
        return ($res.StatusCode -eq 200)
    } `
    -SuccessMessage "Frontend server is responding with HTTP 200 OK at http://localhost:3000" `
    -FailureMessage "Frontend server on port 3000 is unreachable or returned non-200."

# 2. Backend HTTP 200 & /api/cases
$caseData = $null
Test-Check -Name "Backend API Endpoint (/api/cases)" `
    -Condition {
        $raw = Invoke-RestMethod -Uri "http://localhost:3001/api/cases" -Method Get -TimeoutSec 5
        if ($raw.success -eq $true -and $raw.cases) {
            $script:caseData = $raw
            return $true
        }
        return $false
    } `
    -SuccessMessage "Backend API is responding at http://localhost:3001/api/cases" `
    -FailureMessage "Backend API is unreachable or returned invalid response."

# 3. Hardhat RPC & Chain ID 31337
Test-Check -Name "Hardhat JSON-RPC Chain ID (31337)" `
    -Condition {
        $rpcPayload = @{ jsonrpc = "2.0"; method = "eth_chainId"; params = @(); id = 1 } | ConvertTo-Json
        $rpcRes = Invoke-RestMethod -Uri "http://127.0.0.1:8545" -Method Post -Body $rpcPayload -ContentType "application/json" -TimeoutSec 5
        $chainIdDec = [Convert]::ToInt32($rpcRes.result, 16)
        return ($chainIdDec -eq 31337)
    } `
    -SuccessMessage "Hardhat RPC connected on 127.0.0.1:8545 with chainId 31337 (0x7a69)" `
    -FailureMessage "Hardhat RPC failed or returned unexpected chainId."

# 4. Isolated Case Registry (#101, #102, #103, #107)
Test-Check -Name "Demo Cases Exact Isolation (#101, #102, #103, #107)" `
    -Condition {
        if (-not $script:caseData) { return $false }
        $ids = @($script:caseData.cases | ForEach-Object { [int]$_.caseId } | Sort-Object)
        $expected = @(101, 102, 103, 107)
        if ($ids.Length -ne 4) { return $false }
        for ($i = 0; $i -lt 4; $i++) {
            if ($ids[$i] -ne $expected[$i]) { return $false }
        }
        return $true
    } `
    -SuccessMessage "Exact 4 isolated presentation cases registered: #101, #102, #103, #107 (Total: 4)" `
    -FailureMessage "Registered cases do not exactly match [#101, #102, #103, #107]."

# 5. Case #101 Custody Handoffs Count (Exactly 2)
Test-Check -Name "Case #101 Custody Handoffs Count" `
    -Condition {
        $c101 = $script:caseData.cases | Where-Object { $_.caseId -eq 101 }
        return ($c101 -and $c101.custodyEventCount -eq 2)
    } `
    -SuccessMessage "Case #101 has exactly 2 custody handoffs recorded on ledger" `
    -FailureMessage "Case #101 custodyEventCount is not 2."

# 6. Case #101 Current Custodian Address
$case101Custodian = $null
Test-Check -Name "Case #101 Current Custodian Address" `
    -Condition {
        $c101 = $script:caseData.cases | Where-Object { $_.caseId -eq 101 }
        $expectedAddress = "0x90F79bf6EB2c4f870365E785982E1f101E93b906"
        if ($c101 -and ($c101.custodian.ToLower() -eq $expectedAddress.ToLower())) {
            $script:case101Custodian = $c101.custodian
            return $true
        }
        return $false
    } `
    -SuccessMessage "Case #101 current custodian is 0x90F79bf6EB2c4f870365E785982E1f101E93b906" `
    -FailureMessage "Case #101 custodian does not match expected Court Reviewer address."

# 7. Canonical Role Mapping Audit
Test-Check -Name "Canonical Role Mappings (Court Reviewer & Defense Lawyer)" `
    -Condition {
        $c107 = $script:caseData.cases | Where-Object { $_.caseId -eq 107 }
        $c107Matches = ($c107 -and ($c107.custodian.ToLower() -eq "0x3c44cdddb6a900fa2b585dd299e03d12fa4293bc"))
        $c101Matches = ($script:case101Custodian -and ($script:case101Custodian.ToLower() -eq "0x90f79bf6eb2c4f870365e785982e1f101e93b906"))
        return ($c107Matches -and $c101Matches)
    } `
    -SuccessMessage "Case #101 maps to Court Reviewer (0x90F7...b906) and Case #107 maps to Defense Lawyer (0x3C44...93BC)" `
    -FailureMessage "Role address mappings are inconsistent with canonical specification."

# 8. Intact Case #101 ZK-SNARK Verification (eth_call / EVM View)
Test-Check -Name "ZK Proof Verification for Case #101 (Groth16 + Solidity Verifier)" `
    -Condition {
        $body = @{ caseId = 101 } | ConvertTo-Json
        $zkRes = Invoke-RestMethod -Uri "http://localhost:3001/api/verify-zk" -Method Post -Body $body -ContentType "application/json" -TimeoutSec 15
        if ($zkRes.isValid -eq $true -and $zkRes.onChainVerified -eq $true) {
            Write-Host ""
            Write-Host "      [ZK Audit] Deployed Solidity Verifier Result: VALID" -ForegroundColor Green
            Write-Host "      [ZK Audit] Execution Method: Read-only EVM eth_call: no transaction submitted, no blockchain state changed and no gas fee paid." -ForegroundColor Green
            Write-Host "      [ZK Audit] Prover Generation Time: $($zkRes.generationTimeMs) ms" -ForegroundColor DarkGreen
            return $true
        }
        return $false
    } `
    -SuccessMessage "Groth16 ZK proof generated and successfully verified on-chain via Groth16Verifier.sol eth_call" `
    -FailureMessage "ZK verification failed or returned invalid."

# 9. Public Tunnel Verification (if configured)
if (Test-Path $SessionFile) {
    try {
        $sess = Get-Content $SessionFile -Raw | ConvertFrom-Json
        if ($sess.publicUrl) {
            Test-Check -Name "Public Tunnel Reachability ($($sess.publicUrl))" `
                -Condition {
                    $pubUi = Invoke-WebRequest -Uri $sess.publicUrl -UseBasicParsing -TimeoutSec 10
                    $pubApi = Invoke-RestMethod -Uri "$($sess.publicUrl)/api/cases" -Method Get -TimeoutSec 10
                    return ($pubUi.StatusCode -eq 200 -and $pubApi.success -eq $true -and $pubApi.cases.Count -eq 4)
                } `
                -SuccessMessage "Public tunnel verified: Remote UI and API functioning seamlessly." `
                -FailureMessage "Public tunnel URL failed to respond or returned invalid data."
        }
    } catch {}
}

# Final Result
Write-Host "`n-------------------------------------------------------" -ForegroundColor DarkGray
Write-Host "Passed: $passedChecks / $totalChecks checks" -ForegroundColor White

if ($passedChecks -eq $totalChecks) {
    Write-Host "`n=======================================================" -ForegroundColor Green
    Write-Host "  PRESENTATION PREFLIGHT: PASS" -ForegroundColor Green
    Write-Host "=======================================================`n" -ForegroundColor Green
    exit 0
} else {
    Write-Host "`n=======================================================" -ForegroundColor Red
    Write-Host "  PRESENTATION PREFLIGHT: FAIL" -ForegroundColor Red
    Write-Host "=======================================================`n" -ForegroundColor Red
    Write-Host "Failures encountered:" -ForegroundColor Red
    foreach ($f in $failures) {
        Write-Host "  - $f" -ForegroundColor Red
    }
    Write-Host ""
    exit 1
}
