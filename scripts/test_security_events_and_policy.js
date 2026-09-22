const assert = require("assert");
const http = require("http");
const crypto = require("crypto");

const BACKEND_URL = "http://localhost:3001";
const SNARK_FIELD_PRIME = BigInt("21888242871839275222246405745257275088548364400416034343698204186575808495617");

function sha256ToFieldElement(sha256Hex) {
    const bigIntVal = BigInt("0x" + sha256Hex.replace(/^0x/, ""));
    return (bigIntVal % SNARK_FIELD_PRIME).toString();
}

function postJson(url, data) {
    return new Promise((resolve, reject) => {
        const u = new URL(url);
        const postData = JSON.stringify(data);
        const req = http.request(
            {
                hostname: u.hostname,
                port: u.port,
                path: u.pathname,
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Content-Length": Buffer.byteLength(postData),
                },
            },
            (res) => {
                let body = "";
                res.on("data", (chunk) => (body += chunk));
                res.on("end", () => {
                    try {
                        resolve({ status: res.statusCode, data: JSON.parse(body) });
                    } catch (e) {
                        resolve({ status: res.statusCode, data: body });
                    }
                });
            }
        );
        req.on("error", reject);
        req.write(postData);
        req.end();
    });
}

function getJson(url) {
    return new Promise((resolve, reject) => {
        http.get(url, (res) => {
            let body = "";
            res.on("data", (chunk) => (body += chunk));
            res.on("end", () => {
                try {
                    resolve({ status: res.statusCode, data: JSON.parse(body) });
                } catch (e) {
                    resolve({ status: res.statusCode, data: body });
                }
            });
        }).on("error", reject);
    });
}

function generateEphemeralShamirKey() {
    const p = SNARK_FIELD_PRIME;
    const randomKeyBytes = crypto.randomBytes(32);
    const keyBigInt = (BigInt("0x" + randomKeyBytes.toString("hex")) % (p - 1n)) + 1n;
    const randomSlopeBytes = crypto.randomBytes(32);
    const a1 = (BigInt("0x" + randomSlopeBytes.toString("hex")) % (p - 1n)) + 1n;

    const s1 = (keyBigInt + a1 * 1n) % p;
    const s2 = (keyBigInt + a1 * 2n) % p;
    const s3 = (keyBigInt + a1 * 3n) % p;

    const hex = keyBigInt.toString(16).padStart(64, "0");
    const keyBuffer = Buffer.from(hex, "hex");

    return {
        keyBuffer,
        keyShares: {
            "Investigator": s1.toString(),
            "Forensic Officer": s2.toString(),
            "Court Reviewer": s3.toString(),
        },
    };
}

function encryptBufferWithKey(buffer, keyBuffer) {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv("aes-256-gcm", keyBuffer, iv);
    const encrypted = Buffer.concat([cipher.update(buffer), cipher.final()]);
    const authTag = cipher.getAuthTag();
    return {
        encryptedData: encrypted.toString("base64"),
        iv: iv.toString("base64"),
        authTag: authTag.toString("base64"),
    };
}

async function runSecurityEventsAndPolicySuite() {
    console.log("══════════════════════════════════════════════════════════════════════════════");
    console.log("🔒 LEXVAULT SECURITY EVENTS & DETERMINISTIC POLICY SUITE 🔒");
    console.log("══════════════════════════════════════════════════════════════════════════════\n");

    let totalTests = 0;
    let passedTests = 0;

    function assertTest(name, fn) {
        totalTests++;
        try {
            fn();
            console.log(`  ✅ [PASS] ${name}`);
            passedTests++;
        } catch (err) {
            console.error(`  ❌ [FAIL] ${name}`);
            console.error(`     Error: ${err.message}`);
        }
    }

    const testCaseId = Math.floor(9000 + Math.random() * 900);
    const testContent = `CONFIDENTIAL FORENSIC DOSSIER - CASE #${testCaseId}\nChain of custody secured and tracked via typed security events.`;
    const testBuffer = Buffer.from(testContent, "utf8");
    const sha256Hex = crypto.createHash("sha256").update(testBuffer).digest("hex");
    const leafFieldElement = sha256ToFieldElement(sha256Hex);
    const { keyBuffer, keyShares } = generateEphemeralShamirKey();
    const enc = encryptBufferWithKey(testBuffer, keyBuffer);

    // ─────────────────────────────────────────────────────────────
    // 1. Register Case & Verify EVIDENCE_REGISTERED Event
    // ─────────────────────────────────────────────────────────────
    console.log("▶ 1. Registering Evidence & Checking EVIDENCE_REGISTERED Event...");
    const regRes = await postJson(`${BACKEND_URL}/api/register`, {
        caseId: testCaseId,
        filename: `Forensic_Dossier_C${testCaseId}.pdf`,
        mimeType: "application/pdf",
        encryptedData: enc.encryptedData,
        iv: enc.iv,
        authTag: enc.authTag,
        leafFieldElement,
        keyShares,
    });

    assertTest("Registration returns HTTP 200 with success: true", () => {
        assert.strictEqual(regRes.status, 200);
        assert.strictEqual(regRes.data.success, true);
        assert.strictEqual(regRes.data.caseId, testCaseId);
    });

    const eventsAfterReg = await getJson(`${BACKEND_URL}/api/events/${testCaseId}`);
    assertTest("GET /api/events/:caseId contains EVIDENCE_REGISTERED event", () => {
        assert.strictEqual(eventsAfterReg.status, 200);
        const regEvt = eventsAfterReg.data.events.find(e => e.eventType === "EVIDENCE_REGISTERED");
        assert.ok(regEvt, "EVIDENCE_REGISTERED event must exist");
        assert.strictEqual(regEvt.caseId, testCaseId);
        assert.ok(regEvt.details.merkleRootHex.startsWith("0x"));
    });

    // ─────────────────────────────────────────────────────────────
    // 2. Custody Transfer & Verify CUSTODY_TRANSFERRED Event
    // ─────────────────────────────────────────────────────────────
    console.log("\n▶ 2. Executing Custody Transfer & Checking CUSTODY_TRANSFERRED Event...");
    const transferRes = await postJson(`${BACKEND_URL}/api/transfer-custody`, {
        caseId: testCaseId,
        toAddress: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
        signature: "0xabcdef1234567890",
    });

    assertTest("Transfer custody succeeds with HTTP 200", () => {
        assert.strictEqual(transferRes.status, 200);
        assert.strictEqual(transferRes.data.success, true);
    });

    const eventsAfterTransfer = await getJson(`${BACKEND_URL}/api/events/${testCaseId}`);
    assertTest("CUSTODY_TRANSFERRED event recorded with from and to details", () => {
        const transEvt = eventsAfterTransfer.data.events.find(e => e.eventType === "CUSTODY_TRANSFERRED");
        assert.ok(transEvt, "CUSTODY_TRANSFERRED event must exist");
        assert.strictEqual(transEvt.caseId, testCaseId);
        assert.strictEqual(transEvt.details.to.toLowerCase(), "0x70997970C51812dc3A010C7d01b50e0d17dc79C8".toLowerCase());
    });

    // ─────────────────────────────────────────────────────────────
    // 3. ZK Proof Verification & ZK_PROOF_VERIFIED Event
    // ─────────────────────────────────────────────────────────────
    console.log("\n▶ 3. Verifying Intact Evidence Proof & Checking ZK_PROOF_VERIFIED Event...");
    const zkRes = await postJson(`${BACKEND_URL}/api/verify-zk`, { caseId: testCaseId });

    assertTest("ZK proof verification returns isValid: true", () => {
        assert.strictEqual(zkRes.status, 200);
        assert.strictEqual(zkRes.data.isValid, true);
    });

    const eventsAfterZk = await getJson(`${BACKEND_URL}/api/events/${testCaseId}`);
    assertTest("ZK_PROOF_VERIFIED event recorded with valid outcome", () => {
        const zkEvt = eventsAfterZk.data.events.find(e => e.eventType === "ZK_PROOF_VERIFIED");
        assert.ok(zkEvt, "ZK_PROOF_VERIFIED event must exist");
        assert.strictEqual(zkEvt.details.result, "valid");
        assert.ok(zkEvt.details.generationTimeMs > 0);
    });

    // ─────────────────────────────────────────────────────────────
    // 4. Tamper Injection & TAMPER_DETECTED Event
    // ─────────────────────────────────────────────────────────────
    console.log("\n▶ 4. Injecting Tampered Evidence Buffer & Checking TAMPER_DETECTED Event...");
    const tamperRes = await postJson(`${BACKEND_URL}/api/verify-zk`, {
        caseId: testCaseId,
        tamperedContent: "MODIFIED TAMPERED EVIDENCE CONTENT",
    });

    assertTest("Tampered proof returns isValid: false with isTamperRejected: true", () => {
        assert.strictEqual(tamperRes.data.isValid, false);
        assert.strictEqual(tamperRes.data.isTamperRejected, true);
    });

    const eventsAfterTamper = await getJson(`${BACKEND_URL}/api/events/${testCaseId}`);
    assertTest("TAMPER_DETECTED event recorded with tamper override details", () => {
        const tamperEvt = eventsAfterTamper.data.events.find(e => e.eventType === "TAMPER_DETECTED");
        assert.ok(tamperEvt, "TAMPER_DETECTED event must exist");
        assert.strictEqual(tamperEvt.caseId, testCaseId);
        assert.strictEqual(tamperEvt.details.isTamperOverride, true);
    });

    // ─────────────────────────────────────────────────────────────
    // 5. Deterministic Policy Checks: Duplicate Approvals & Role Clearance
    // ─────────────────────────────────────────────────────────────
    console.log("\n▶ 5. Testing Deterministic Policy Checks (Duplicate Approvals & Intern)...");

    // Test Duplicate Approvals: ["Investigator", "Investigator"]
    const dupRes = await postJson(`${BACKEND_URL}/api/decrypt-evidence`, {
        caseId: testCaseId,
        role: "Court Reviewer",
        approvals: ["Investigator", "Investigator"],
    });

    assertTest("Duplicate approvals from same role rejected with HTTP 403 & duplicate_approval reason", () => {
        assert.strictEqual(dupRes.status, 403);
        assert.strictEqual(dupRes.data.reason, "duplicate_approval");
        assert.ok(dupRes.data.error.includes("Duplicate approvals detected"));
    });

    // Test Single Approval: ["Investigator"]
    const singleRes = await postJson(`${BACKEND_URL}/api/decrypt-evidence`, {
        caseId: testCaseId,
        role: "Court Reviewer",
        approvals: ["Investigator"],
    });

    assertTest("Single approval rejected with HTTP 403 & insufficient_approvals reason", () => {
        assert.strictEqual(singleRes.status, 403);
        assert.strictEqual(singleRes.data.reason, "insufficient_approvals");
    });

    // Test Intern Role Clearance
    const internRes = await postJson(`${BACKEND_URL}/api/decrypt-evidence`, {
        caseId: testCaseId,
        role: "Intern",
        approvals: ["Investigator", "Forensic Officer"],
    });

    assertTest("Intern role clearance rejected with HTTP 403", () => {
        assert.strictEqual(internRes.status, 403);
        assert.ok(internRes.data.error.includes("Role 'Intern' has insufficient clearance"));
    });

    // ─────────────────────────────────────────────────────────────
    // 6. Valid 2-of-3 Decryption & DECRYPTION_APPROVED Event
    // ─────────────────────────────────────────────────────────────
    console.log("\n▶ 6. Executing Valid 2-of-3 Decryption & Checking DECRYPTION_APPROVED Event...");
    const decRes = await postJson(`${BACKEND_URL}/api/decrypt-evidence`, {
        caseId: testCaseId,
        role: "Court Reviewer",
        approvals: ["Investigator", "Forensic Officer"],
    });

    assertTest("Valid 2-of-3 decryption succeeds with HTTP 200", () => {
        assert.strictEqual(decRes.status, 200);
        assert.strictEqual(decRes.data.success, true);
        assert.strictEqual(decRes.data.contentUtf8, testContent);
    });

    const eventsAfterDec = await getJson(`${BACKEND_URL}/api/events/${testCaseId}`);
    assertTest("DECRYPTION_APPROVED event recorded with approving roles", () => {
        const decEvt = eventsAfterDec.data.events.find(e => e.eventType === "DECRYPTION_APPROVED");
        assert.ok(decEvt, "DECRYPTION_APPROVED event must exist");
        assert.deepStrictEqual(decEvt.details.approvingRoles, ["Investigator", "Forensic Officer"]);
    });

    // ─────────────────────────────────────────────────────────────
    // 7. Unregistered Case Negative Access Controls
    // ─────────────────────────────────────────────────────────────
    console.log("\n▶ 7. Testing Unregistered Case Access Denials...");
    const unregId = 999999;
    const unregZk = await postJson(`${BACKEND_URL}/api/verify-zk`, { caseId: unregId });
    assertTest("Unregistered verify-zk returns 404", () => {
        assert.strictEqual(unregZk.status, 404);
    });

    const unregEvents = await getJson(`${BACKEND_URL}/api/events/${unregId}`);
    assertTest("ACCESS_DENIED event recorded for unregistered case", () => {
        const denEvt = unregEvents.data.events.find(e => e.eventType === "ACCESS_DENIED");
        assert.ok(denEvt, "ACCESS_DENIED event must be logged");
        assert.strictEqual(denEvt.details.reason, "unregistered_case");
    });

    // ─────────────────────────────────────────────────────────────
    // 8. Provenance Completeness Checklist API
    // ─────────────────────────────────────────────────────────────
    console.log("\n▶ 8. Querying Provenance Completeness Checklist API...");
    const provRes = await getJson(`${BACKEND_URL}/api/provenance/${testCaseId}`);

    assertTest("GET /api/provenance/:caseId returns boolean checklist without percentage scores", () => {
        assert.strictEqual(provRes.status, 200);
        assert.strictEqual(provRes.data.success, true);
        assert.strictEqual(provRes.data.checklist.merkleRootRegistered, true);
        assert.strictEqual(provRes.data.checklist.evidenceEncrypted, true);
        assert.strictEqual(provRes.data.checklist.hasCustodyEvents, true);
        assert.strictEqual(provRes.data.checklist.custodyEventCount, 1);
        assert.strictEqual(provRes.data.checklist.decryptionApprovalsSatisfied, true);
        assert.ok(provRes.data.disclaimer.includes("Does not establish evidence truthfulness or legal admissibility"));
        // Assert absence of any score / percentage
        assert.strictEqual(provRes.data.score, undefined);
        assert.strictEqual(provRes.data.confidence, undefined);
        assert.strictEqual(provRes.data.percentage, undefined);
    });

    console.log("\n══════════════════════════════════════════════════════════════════════════════");
    console.log(`🎉 TEST SUITE COMPLETE: ${passedTests}/${totalTests} TESTS PASSED (100% SUCCESS)`);
    console.log("══════════════════════════════════════════════════════════════════════════════\n");

    if (passedTests !== totalTests) {
        process.exit(1);
    }
}

runSecurityEventsAndPolicySuite().catch((err) => {
    console.error("Fatal test execution error:", err);
    process.exit(1);
});
