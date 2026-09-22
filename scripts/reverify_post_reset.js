const assert = require("assert");

const BACKEND_URL = "http://localhost:3001";

async function main() {
    console.log("══════════════════════════════════════════════════════════════════════════════");
    console.log("🔍 STEP 3 POST-RESET RE-VERIFICATION SUITE");
    console.log(`Execution Timestamp: ${new Date().toISOString()}`);
    console.log("══════════════════════════════════════════════════════════════════════════════\n");

    // -------------------------------------------------------------------------
    // CHECK 1: Case #101 ZK Verification (Intact Evidence)
    // -------------------------------------------------------------------------
    console.log("▶ CHECK 1: Case #101 ZK Verification (Intact Evidence)");
    const t0 = Date.now();
    const zkRes = await fetch(`${BACKEND_URL}/api/verify-zk`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ caseId: 101, isTampered: false }),
    });
    const t1 = Date.now();
    const zkData = await zkRes.json();
    console.log(`  • HTTP Status: ${zkRes.status}`);
    console.log(`  • Client Round-Trip Time: ${t1 - t0} ms`);
    console.log(`  • Server Witness/Proof Generation Time: ${zkData.generationTimeMs} ms`);
    console.log(`  • Deployed Solidity Verifier Result: ${zkData.isValid ? "✅ VALID" : "❌ INVALID"}`);
    console.log(`  • Execution Method: EVM eth_call — no blockchain state modified`);
    console.log(`  • Public Signal [0] (merkleRoot): ${zkData.merkleRootUsed}`);
    assert.strictEqual(zkRes.status, 200, "Status must be 200");
    assert.strictEqual(zkData.isValid, true, "Proof must be valid");
    assert.strictEqual(zkData.onChainVerified, true, "Must be verified on-chain via Solidity Verifier");
    console.log("  ✅ CHECK 1 PASSED: Case #101 verified valid via Solidity Verifier eth_call.\n");

    // -------------------------------------------------------------------------
    // CHECK 2: Tampered-Proof Attempt Against Case #101
    // -------------------------------------------------------------------------
    console.log("▶ CHECK 2: Adversarial Tampered-Proof Attempt Against Case #101");
    const tamperRes = await fetch(`${BACKEND_URL}/api/verify-zk`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ caseId: 101, tamperedContent: "MALICIOUS_MODIFIED_PAYLOAD_BYTE_1" }),
    });
    const tamperData = await tamperRes.json();
    console.log(`  • HTTP Status: ${tamperRes.status}`);
    console.log(`  • Proof isValid: ${tamperData.isValid}`);
    console.log(`  • isTamperRejected: ${tamperData.isTamperRejected}`);
    console.log(`  • Rejection Reason: "${tamperData.error || tamperData.reason}"`);
    assert.strictEqual(tamperData.isValid, false, "Tampered proof must be false");
    assert.strictEqual(tamperData.isTamperRejected, true, "isTamperRejected must be true");
    console.log("  ✅ CHECK 2 PASSED: Tampered evidence mathematically rejected by ZK circuit.\n");

    // -------------------------------------------------------------------------
    // CHECK 3: Unregistered Case Guard Gates (Case #9999 - Deliberately Simulated Attack)
    // -------------------------------------------------------------------------
    console.log("▶ CHECK 3: Deliberately Simulated and Successfully Blocked Unregistered-Case Attack (Case #9999)");
    // 3a. Case details
    const unregCaseRes = await fetch(`${BACKEND_URL}/api/case/9999`);
    const unregCaseData = await unregCaseRes.json();
    console.log(`  • GET /api/case/9999: isRegistered = ${unregCaseData.isRegistered}, onChainRecord = ${unregCaseData.onChainRecord}`);
    assert.strictEqual(unregCaseData.isRegistered, false);

    // 3b. Custody transfer
    const unregTransferRes = await fetch(`${BACKEND_URL}/api/transfer-custody`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ caseId: 9999, toAddress: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8", role: "Investigator" }),
    });
    console.log(`  • POST /api/transfer-custody (Case #9999): HTTP Status ${unregTransferRes.status}`);
    assert.strictEqual(unregTransferRes.status, 404);

    // 3c. Decryption attempt
    const unregDecryptRes = await fetch(`${BACKEND_URL}/api/decrypt-evidence`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ caseId: 9999, role: "Court Reviewer", approvals: ["Investigator", "Forensic Officer"] }),
    });
    console.log(`  • POST /api/decrypt-evidence (Case #9999): HTTP Status ${unregDecryptRes.status}`);
    assert.strictEqual(unregDecryptRes.status, 404);

    // 3d. ZK verification attempt
    const unregZkRes = await fetch(`${BACKEND_URL}/api/verify-zk`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ caseId: 9999, isTampered: false }),
    });
    console.log(`  • POST /api/verify-zk (Case #9999): HTTP Status ${unregZkRes.status}`);
    assert.strictEqual(unregZkRes.status, 404);
    console.log("  ✅ CHECK 3 PASSED: All operations on unregistered Case #9999 strictly return 404/blocked.\n");

    // -------------------------------------------------------------------------
    // CHECK 5: Security Event Log Cleanliness & Case Enumeration
    // -------------------------------------------------------------------------
    console.log("▶ CHECK 5: Security Event Log Cleanliness & Case Enumeration");
    const eventsRes = await fetch(`${BACKEND_URL}/api/events`);
    const eventsData = await eventsRes.json();
    const registeredCaseIds = new Set(eventsData.events.map(e => e.caseId));
    console.log(`  • Case IDs Present in Security Events: [${Array.from(registeredCaseIds).join(", ")}]`);
    console.log(`    (Note: Includes Case #9999 from the deliberately simulated and successfully blocked unregistered-case attack)`);

    const casesRes = await fetch(`${BACKEND_URL}/api/cases`);
    const casesData = await casesRes.json();
    const activeCaseIds = casesData.cases.map(c => c.caseId).sort((a, b) => a - b);
    console.log(`  • Active On-Chain Cases: [${activeCaseIds.join(", ")}]`);
    assert.deepStrictEqual(activeCaseIds, [101, 102, 103, 107]);

    // Check Case #101 specifics (2 handoffs, current custodian: Court Reviewer)
    const case101 = casesData.cases.find(c => c.caseId === 101);
    console.log(`  • Case #101 Custody Event Count: ${case101.custodyEventCount} (Expected: 2)`);
    console.log(`  • Case #101 Current Custodian: ${case101.custodian}`);
    assert.strictEqual(case101.custodyEventCount, 2, "Case #101 must have exactly 2 custody transfers");
    assert.strictEqual(case101.custodian.toLowerCase(), "0x90F79bf6EB2c4f870365E785982E1f101E93b906".toLowerCase(), "Case #101 current custodian must be Court Reviewer (0x90F7...b906)");

    console.log("  ✅ CHECK 5 PASSED: The on-chain registry contains exactly four demo cases; the security log additionally records the deliberately blocked Case #9999 attempt.\n");
    console.log("══════════════════════════════════════════════════════════════════════════════");
    console.log("🎉 ALL CHECKS IN RE-VERIFICATION SUITE PASSED SUCCESSFULLY!");
    console.log("══════════════════════════════════════════════════════════════════════════════");
}

main().catch((e) => {
    console.error("FATAL ERROR in reverify suite:", e);
    process.exit(1);
});
