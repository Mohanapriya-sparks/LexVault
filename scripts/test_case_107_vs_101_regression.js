const assert = require("assert");

const BACKEND_URL = "http://localhost:3001";

async function runRegressionSuite() {
    console.log("================================================================================");
    console.log("  LEXVAULT REGRESSION TEST SUITE: CASE #107 VS CASE #101 ISOLATION & RETRIEVAL");
    console.log("================================================================================\n");

    let totalTests = 0;
    let passedTests = 0;

    function recordTest(testName, fn) {
        totalTests++;
        try {
            fn();
            console.log(`  ✅ [PASS] ${testName}`);
            passedTests++;
        } catch (err) {
            console.error(`  ❌ [FAIL] ${testName}`);
            console.error(`     Error: ${err.message}`);
        }
    }

    // -------------------------------------------------------------------------
    // TEST GROUP 1: On-Chain Event-Log Enumeration & Public Privacy Assertion
    // -------------------------------------------------------------------------
    console.log("--- TEST GROUP 1: /api/cases On-Chain Event-Log Enumeration ---");
    const casesRes = await fetch(`${BACKEND_URL}/api/cases`);
    const casesData = await casesRes.json();

    recordTest("GET /api/cases returns success: true and isContractConnected", () => {
        assert.strictEqual(casesData.success, true);
        assert.ok(Array.isArray(casesData.cases));
        assert.ok(casesData.cases.length > 0, "Should have registered cases on-chain");
        assert.ok(casesData.snapshotBlock > 0, "Snapshot block should be positive");
    });

    recordTest("GET /api/cases exhibits 100% absence of raw filenames or MIME types in public view", () => {
        for (const c of casesData.cases) {
            assert.strictEqual(c.filename, undefined, `Case #${c.caseId} leaked filename in public API!`);
            assert.strictEqual(c.mimeType, undefined, `Case #${c.caseId} leaked mimeType in public API!`);
            assert.ok(c.evidenceLabel.startsWith("Evidence Item #"), `Case #${c.caseId} label must be generic Evidence Item #${c.caseId}`);
            assert.ok(c.merkleRoot && c.merkleRoot.startsWith("0x"), `Case #${c.caseId} missing on-chain merkleRoot`);
            assert.ok(c.custodian && c.custodian.startsWith("0x"), `Case #${c.caseId} missing custodian`);
        }
    });

    const case101Summary = casesData.cases.find(c => c.caseId === 101);
    const case107Summary = casesData.cases.find(c => c.caseId === 107);

    recordTest("Both Case #101 and Case #107 are registered and present in on-chain event logs", () => {
        assert.ok(case101Summary, "Case #101 must exist in on-chain event logs");
        assert.ok(case107Summary, "Case #107 must exist in on-chain event logs");
    });

    // -------------------------------------------------------------------------
    // TEST GROUP 2: Strict Isolation Between Case #107 and Case #101 Metadata
    // -------------------------------------------------------------------------
    console.log("\n--- TEST GROUP 2: On-Chain Metadata Isolation (Case #107 vs #101) ---");
    const case101Res = await fetch(`${BACKEND_URL}/api/case/101`);
    const case101Detail = await case101Res.json();

    const case107Res = await fetch(`${BACKEND_URL}/api/case/107`);
    const case107Detail = await case107Res.json();

    recordTest("Case #101 and Case #107 have completely distinct on-chain Merkle roots", () => {
        assert.strictEqual(case101Detail.isRegistered, true);
        assert.strictEqual(case107Detail.isRegistered, true);
        assert.notStrictEqual(
            case107Detail.onChainRecord.merkleRoot,
            case101Detail.onChainRecord.merkleRoot,
            "Case #107 and #101 must not share the same Merkle root!"
        );
    });

    recordTest("Case #107 contains ZERO Case #101 Merkle root, registration tx, or custody history", () => {
        const c101Root = case101Detail.onChainRecord.merkleRoot.toLowerCase();
        const c101Tx = (case101Detail.registrationTxHash || "").toLowerCase();
        const c107Json = JSON.stringify(case107Detail).toLowerCase();

        assert.ok(!c107Json.includes(c101Root), "Case #107 detail response leaked Case #101 Merkle root!");
        if (c101Tx.length > 10) {
            assert.ok(!c107Json.includes(c101Tx), "Case #107 detail response leaked Case #101 registration tx hash!");
        }
        assert.strictEqual(case107Detail.evidenceLabel, "Evidence Item #107");
    });

    recordTest("Custody history labels handoffs as 'Ledger-Authenticated Transaction'", () => {
        for (const h of case107Detail.custodyHistory) {
            assert.strictEqual(h.transactionType, "Ledger-Authenticated Transaction");
        }
    });

    // -------------------------------------------------------------------------
    // TEST GROUP 3: Decryption Payload Isolation & Zero Cross-Case Contamination
    // -------------------------------------------------------------------------
    console.log("\n--- TEST GROUP 3: Decryption & Shamir Key Isolation ---");
    
    // Decrypt Case #107
    const dec107Res = await fetch(`${BACKEND_URL}/api/decrypt-evidence`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            caseId: 107,
            role: "Court Reviewer",
            approvals: ["Investigator", "Forensic Officer"],
        }),
    });
    const dec107Data = await dec107Res.json();

    recordTest("POST /api/decrypt-evidence for Case #107 succeeds with valid 2-of-3 quorum", () => {
        assert.strictEqual(dec107Res.status, 200);
        assert.strictEqual(dec107Data.success, true);
        assert.strictEqual(dec107Data.caseId, 107);
    });

    // Decrypt Case #101
    const dec101Res = await fetch(`${BACKEND_URL}/api/decrypt-evidence`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            caseId: 101,
            role: "Court Reviewer",
            approvals: ["Investigator", "Forensic Officer"],
        }),
    });
    const dec101Data = await dec101Res.json();

    recordTest("POST /api/decrypt-evidence for Case #101 succeeds with valid 2-of-3 quorum", () => {
        assert.strictEqual(dec101Res.status, 200);
        assert.strictEqual(dec101Data.success, true);
        assert.strictEqual(dec101Data.caseId, 101);
    });

    recordTest("Case #107 decrypted payload contains NO Case #101 text or metadata", () => {
        const text107 = Buffer.from(dec107Data.contentBase64, "base64").toString("utf8");
        const text101 = Buffer.from(dec101Data.contentBase64, "base64").toString("utf8");

        console.log(`     • Case #107 Decrypted Header: "${text107.slice(0, 45).replace(/\n/g, ' ')}..."`);
        console.log(`     • Case #101 Decrypted Header: "${text101.slice(0, 45).replace(/\n/g, ' ')}..."`);

        assert.ok(text107.includes("107"), "Decrypted Case #107 text must contain '107'");
        assert.ok(!text107.includes("101"), "Decrypted Case #107 text MUST NOT contain '101'!");
        assert.notStrictEqual(dec107Data.contentBase64, dec101Data.contentBase64, "Payload ciphertexts/plaintexts must differ!");
        assert.notStrictEqual(dec107Data.filename, dec101Data.filename, "Filenames must differ!");
    });

    // -------------------------------------------------------------------------
    // TEST GROUP 4: Unregistered Case Boundary & Negative Access Control
    // -------------------------------------------------------------------------
    console.log("\n--- TEST GROUP 4: Unregistered Case Boundary Enforcement ---");

    const unregCaseId = 888888;
    const unregDetailRes = await fetch(`${BACKEND_URL}/api/case/${unregCaseId}`);
    const unregDetail = await unregDetailRes.json();

    recordTest("GET /api/case/:unregisteredId returns isRegistered: false with null record", () => {
        assert.strictEqual(unregDetail.isRegistered, false);
        assert.strictEqual(unregDetail.onChainRecord, null);
        assert.strictEqual(unregDetail.custodyHistory.length, 0);
    });

    const unregZkRes = await fetch(`${BACKEND_URL}/api/verify-zk`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ caseId: unregCaseId }),
    });
    const unregZk = await unregZkRes.json();

    recordTest("POST /api/verify-zk for unregistered case returns 404 and isRegistered: false", () => {
        assert.strictEqual(unregZkRes.status, 404);
        assert.strictEqual(unregZk.isValid, false);
        assert.strictEqual(unregZk.isRegistered, false);
    });

    const unregDecRes = await fetch(`${BACKEND_URL}/api/decrypt-evidence`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ caseId: unregCaseId, role: "Court Reviewer", approvals: ["Investigator", "Forensic Officer"] }),
    });

    recordTest("POST /api/decrypt-evidence for unregistered case returns 404 error", () => {
        assert.strictEqual(unregDecRes.status, 404);
    });

    // -------------------------------------------------------------------------
    // SUMMARY
    // -------------------------------------------------------------------------
    console.log("\n================================================================================");
    console.log(`  REGRESSION TEST RESULTS: ${passedTests}/${totalTests} TESTS PASSED (${passedTests === totalTests ? "100% SUCCESS" : "FAILURES DETECTED"})`);
    console.log("================================================================================\n");

    if (passedTests !== totalTests) {
        process.exit(1);
    }
}

runRegressionSuite().catch((err) => {
    console.error("Fatal test execution error:", err);
    process.exit(1);
});
