const http = require("http");
const crypto = require("crypto");
const { ethers } = require("hardhat");

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

async function runCaseSwitchingTest() {
    console.log("══════════════════════════════════════════════════════════════════════════");
    console.log("🔒 LEXVAULT MULTI-CASE ISOLATION & INTERACTIVE CASE-SWITCHING TEST 🔒");
    console.log("══════════════════════════════════════════════════════════════════════════\n");

    const baseId = Math.floor(5000 + Math.random() * 4000);
    const caseA = baseId;
    const caseB = baseId + 1;
    const caseUnregistered = baseId + 999;

    console.log(`Test Parameters:`);
    console.log(`  • Case A ID: #${caseA}`);
    console.log(`  • Case B ID: #${caseB}`);
    console.log(`  • Unregistered Case C ID: #${caseUnregistered}\n`);

    // ─────────────────────────────────────────────────────────────
    // 1. Register Case A
    // ─────────────────────────────────────────────────────────────
    console.log(`▶ 1. Registering Case A (#${caseA}) with DNA & Ballistics Report...`);
    const contentA = `CONFIDENTIAL FORENSIC REPORT - CASE #${caseA}\nDNA Match Confirmed 99.98%\nBallistics: 9mm Parabellum match.`;
    const bufferA = Buffer.from(contentA, "utf8");
    const sha256A = crypto.createHash("sha256").update(bufferA).digest("hex");
    const leafA = sha256ToFieldElement(sha256A);
    const shamirA = generateEphemeralShamirKey();
    const encA = encryptBufferWithKey(bufferA, shamirA.keyBuffer);

    const regResA = await postJson("http://localhost:3001/api/register", {
        caseId: caseA,
        filename: `Forensic_DNA_Report_C${caseA}.pdf`,
        mimeType: "application/pdf",
        encryptedData: encA.encryptedData,
        iv: encA.iv,
        authTag: encA.authTag,
        leafFieldElement: leafA,
        keyShares: shamirA.keyShares,
    });
    if (!regResA.data.success) throw new Error(`Registration of Case A failed: ${JSON.stringify(regResA.data)}`);
    console.log(`  ✅ Case A registered. Merkle Root A: ${regResA.data.merkleRootHex}\n`);

    // ─────────────────────────────────────────────────────────────
    // 2. Register Case B
    // ─────────────────────────────────────────────────────────────
    console.log(`▶ 2. Registering Case B (#${caseB}) with CCTV Video Feed...`);
    const contentB = `CCTV SURVEILLANCE LOG - CASE #${caseB}\nNorth Corridor Camera Feed\nSealed at 2026-09-18T13:00:00Z.`;
    const bufferB = Buffer.from(contentB, "utf8");
    const sha256B = crypto.createHash("sha256").update(bufferB).digest("hex");
    const leafB = sha256ToFieldElement(sha256B);
    const shamirB = generateEphemeralShamirKey();
    const encB = encryptBufferWithKey(bufferB, shamirB.keyBuffer);

    const regResB = await postJson("http://localhost:3001/api/register", {
        caseId: caseB,
        filename: `CCTV_NorthCorridor_C${caseB}.mp4`,
        mimeType: "video/mp4",
        encryptedData: encB.encryptedData,
        iv: encB.iv,
        authTag: encB.authTag,
        leafFieldElement: leafB,
        keyShares: shamirB.keyShares,
    });
    if (!regResB.data.success) throw new Error(`Registration of Case B failed: ${JSON.stringify(regResB.data)}`);
    console.log(`  ✅ Case B registered. Merkle Root B: ${regResB.data.merkleRootHex}\n`);

    if (regResA.data.merkleRootHex === regResB.data.merkleRootHex) {
        throw new Error("Critical Error: Case A and Case B have colliding Merkle Roots!");
    }

    // ─────────────────────────────────────────────────────────────
    // 3. Record Distinct Custody Events for Case A & Case B
    // ─────────────────────────────────────────────────────────────
    console.log(`▶ 3. Recording Independent Custody Handoffs...`);
    const signers = await ethers.getSigners();
    const custodianA = signers[1].address;
    const custodianB = signers[2].address;

    await postJson("http://localhost:3001/api/transfer-custody", {
        caseId: caseA,
        toAddress: custodianA,
        signature: `0x_sig_case_${caseA}_to_custodian_1`,
    });
    console.log(`  • Case A custody handed off to Custodian 1 (${custodianA.slice(0, 10)}...)`);

    await postJson("http://localhost:3001/api/transfer-custody", {
        caseId: caseB,
        toAddress: custodianB,
        signature: `0x_sig_case_${caseB}_to_custodian_2`,
    });
    console.log(`  • Case B custody handed off to Custodian 2 (${custodianB.slice(0, 10)}...)`);
    console.log(`  ✅ Custody events recorded independently on-chain.\n`);

    // ─────────────────────────────────────────────────────────────
    // 4. Test Switching back to Case A & Verifying Complete Isolation
    // ─────────────────────────────────────────────────────────────
    console.log(`▶ 4. [SWITCH -> CASE A (#${caseA})] Verifying State Isolation for Case A...`);
    const detailsA = await getJson(`http://localhost:3001/api/case/${caseA}`);
    if (detailsA.data.evidenceLabel !== `Evidence Item #${caseA}`) {
        throw new Error(`Case A evidence label mismatch! Got: ${detailsA.data.evidenceLabel}`);
    }
    if (detailsA.data.onChainRecord.merkleRoot !== regResA.data.merkleRootHex) {
        throw new Error(`Case A Merkle root mismatch!`);
    }
    if (detailsA.data.custodyHistory[0].to !== custodianA) {
        throw new Error(`Case A custody history contains wrong custodian!`);
    }
    console.log(`  • Case A Metadata: Correct (${detailsA.data.evidenceLabel})`);
    console.log(`  • Case A Merkle Root: Correct on-chain match`);
    console.log(`  • Case A Custody History: Correct (${detailsA.data.custodyHistory.length} event)`);

    // Decrypt Case A
    const decA = await postJson("http://localhost:3001/api/decrypt-evidence", {
        caseId: caseA,
        role: "Court Reviewer",
        approvals: ["Investigator", "Court Reviewer"],
    });
    const decContentA = Buffer.from(decA.data.contentBase64, "base64").toString("utf8");
    if (decContentA !== contentA) {
        throw new Error(`Case A decrypted content leak/mismatch!`);
    }
    console.log(`  • Case A Decryption: Exact Match with Case A Plaintext (No Case B leakage)`);

    // ZK Verification Scenario A (Intact) for Case A
    const zkValidA = await postJson("http://localhost:3001/api/verify-zk", { caseId: caseA });
    if (!zkValidA.data.isValid || zkValidA.data.merkleRootUsed !== regResA.data.merkleRoot) {
        throw new Error(`Case A intact ZK verification failed!`);
    }
    console.log(`  • Case A Scenario A (Intact): ✅ VALID (matches Case A on-chain root)`);

    // ZK Verification Scenario B (Tampered) for Case A
    const zkTamperA = await postJson("http://localhost:3001/api/verify-zk", {
        caseId: caseA,
        tamperedContent: contentA + " [TAMPERED]",
    });
    if (zkTamperA.data.isValid) {
        throw new Error(`Case A tampered verification unexpectedly passed!`);
    }
    console.log(`  • Case A Scenario B (Tampered): ❌ REJECTED (Circuit constraint caught modification)\n`);

    // ─────────────────────────────────────────────────────────────
    // 5. Test Switching to Case B & Verifying Complete Isolation
    // ─────────────────────────────────────────────────────────────
    console.log(`▶ 5. [SWITCH -> CASE B (#${caseB})] Verifying State Isolation for Case B...`);
    const detailsB = await getJson(`http://localhost:3001/api/case/${caseB}`);
    if (detailsB.data.evidenceLabel !== `Evidence Item #${caseB}`) {
        throw new Error(`Case B evidence label mismatch! Got: ${detailsB.data.evidenceLabel}`);
    }
    if (detailsB.data.onChainRecord.merkleRoot !== regResB.data.merkleRootHex) {
        throw new Error(`Case B Merkle root mismatch!`);
    }
    if (detailsB.data.custodyHistory[0].to !== custodianB) {
        throw new Error(`Case B custody history contains wrong custodian!`);
    }
    console.log(`  • Case B Metadata: Correct (${detailsB.data.evidenceLabel})`);
    console.log(`  • Case B Merkle Root: Correct on-chain match`);
    console.log(`  • Case B Custody History: Correct (${detailsB.data.custodyHistory.length} event)`);

    // Decrypt Case B
    const decB = await postJson("http://localhost:3001/api/decrypt-evidence", {
        caseId: caseB,
        role: "Court Reviewer",
        approvals: ["Forensic Officer", "Court Reviewer"],
    });
    const decContentB = Buffer.from(decB.data.contentBase64, "base64").toString("utf8");
    if (decContentB !== contentB) {
        throw new Error(`Case B decrypted content leak/mismatch!`);
    }
    console.log(`  • Case B Decryption: Exact Match with Case B Plaintext (No Case A leakage)`);

    // ZK Verification Scenario A (Intact) for Case B
    const zkValidB = await postJson("http://localhost:3001/api/verify-zk", { caseId: caseB });
    if (!zkValidB.data.isValid || zkValidB.data.merkleRootUsed !== regResB.data.merkleRoot) {
        throw new Error(`Case B intact ZK verification failed!`);
    }
    console.log(`  • Case B Scenario A (Intact): ✅ VALID (matches Case B on-chain root)`);

    // ZK Verification Scenario B (Tampered) for Case B
    const zkTamperB = await postJson("http://localhost:3001/api/verify-zk", {
        caseId: caseB,
        tamperedContent: contentB + " [TAMPERED]",
    });
    if (zkTamperB.data.isValid) {
        throw new Error(`Case B tampered verification unexpectedly passed!`);
    }
    console.log(`  • Case B Scenario B (Tampered): ❌ REJECTED (Circuit constraint caught modification)\n`);

    // ─────────────────────────────────────────────────────────────
    // 6. Test Unregistered Case Gating (Case C #5999)
    // ─────────────────────────────────────────────────────────────
    console.log(`▶ 6. [SWITCH -> UNREGISTERED CASE C (#${caseUnregistered})] Verifying Strict Guard Gates...`);
    const detailsC = await getJson(`http://localhost:3001/api/case/${caseUnregistered}`);
    console.log(`  • Case C Lookup: isRegistered = ${detailsC.data.isRegistered}, onChainRecord = ${detailsC.data.onChainRecord}`);
    if (detailsC.data.isRegistered !== false || detailsC.data.onChainRecord !== null) {
        throw new Error(`Unregistered Case C unexpectedly returned on-chain record!`);
    }

    // Custody Transfer against unregistered case
    const transC = await postJson("http://localhost:3001/api/transfer-custody", {
        caseId: caseUnregistered,
        toAddress: custodianA,
        signature: "0x1234",
    });
    console.log(`  • Case C Custody Transfer: Status ${transC.status} (Expected 404 Not Found)`);
    if (transC.status !== 404) throw new Error("Expected custody transfer on unregistered case to return 404!");

    // Decryption against unregistered case
    const decC = await postJson("http://localhost:3001/api/decrypt-evidence", {
        caseId: caseUnregistered,
        role: "Court Reviewer",
        approvals: ["Investigator", "Court Reviewer"],
    });
    console.log(`  • Case C Decryption: Status ${decC.status} (Expected 404 Not Found)`);
    if (decC.status !== 404) throw new Error("Expected decryption on unregistered case to return 404!");

    // ZK Verification against unregistered case
    const zkC = await postJson("http://localhost:3001/api/verify-zk", { caseId: caseUnregistered });
    console.log(`  • Case C ZK Verification: Status ${zkC.status} (Expected 404 Not Found, isRegistered = false)`);
    if (zkC.status !== 404 || zkC.data.isRegistered !== false) {
        throw new Error("Expected ZK verification on unregistered case to return 404 with isRegistered=false!");
    }
    console.log(`  ✅ Strict guard gates blocked all actions on unregistered Case #${caseUnregistered}.\n`);

    console.log("══════════════════════════════════════════════════════════════════════════");
    console.log("🎉 ALL CASE-SWITCHING, STATE ISOLATION & GUARD TESTS PASSED (100%)! 🎉");
    console.log("══════════════════════════════════════════════════════════════════════════\n");
}

runCaseSwitchingTest().catch((err) => {
    console.error("❌ Test failed with error:", err);
    process.exit(1);
});
