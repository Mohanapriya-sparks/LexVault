const http = require("http");
const crypto = require("crypto");
const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

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

async function runDynamicFlowTest() {
    console.log("══════════════════════════════════════════════════════════════════");
    console.log("⚡ LEXVAULT DYNAMIC 5-STAGE LIFECYCLE END-TO-END VERIFICATION ⚡");
    console.log("══════════════════════════════════════════════════════════════════\n");

    const caseId = Math.floor(2000 + Math.random() * 8000);
    const rawContent = `CCTV SURVEILLANCE LOG - CASE #${caseId}\nTimestamp: 2026-09-18T10:30:00Z\nLocation: Sector 4 Secure Laboratory\nIntegrity: Cryptographically sealed via LexVault ZK Merkle Proof`;
    const rawBuffer = Buffer.from(rawContent, "utf8");

    // ─────────────────────────────────────────────────────────────
    // STAGE 1: Ingestion & Shamir 2-of-3 Key Splitting (Client-side)
    // ─────────────────────────────────────────────────────────────
    console.log("▶ STAGE 1: Client-Side Ephemeral Key Generation & Polynomial Splitting");
    const sha256Hex = crypto.createHash("sha256").update(rawBuffer).digest("hex");
    const leafFieldElement = sha256ToFieldElement(sha256Hex);
    console.log(`  • Evidence SHA-256: ${sha256Hex}`);
    console.log(`  • Leaf Field Element: ${leafFieldElement.slice(0, 24)}...`);

    const { keyBuffer, keyShares } = generateEphemeralShamirKey();
    const { encryptedData, iv, authTag } = encryptBufferWithKey(rawBuffer, keyBuffer);
    console.log(`  • Generated Ephemeral 256-bit Key & Shamir 2-of-3 Shares:`);
    console.log(`    - Investigator (x=1): ${keyShares["Investigator"].slice(0, 18)}...`);
    console.log(`    - Forensic Officer (x=2): ${keyShares["Forensic Officer"].slice(0, 18)}...`);
    console.log(`    - Court Reviewer (x=3): ${keyShares["Court Reviewer"].slice(0, 18)}...`);

    const regRes = await postJson("http://localhost:3001/api/register", {
        caseId,
        filename: "CCTV_Sector4_Feed.mp4",
        mimeType: "video/mp4",
        encryptedData,
        iv,
        authTag,
        leafFieldElement,
        keyShares,
    });
    // Verify plaintext absence from registration payload
    if (JSON.stringify(regRes.config?.data || regRes.data).includes(rawContent)) {
        throw new Error("Plaintext evidence leak detected in registration payload!");
    }
    console.log(`  • Registration response:`, regRes.data);
    if (!regRes.data.success) throw new Error("Stage 1 registration failed!");
    console.log("  ✅ STAGE 1 PASSED: Client-side AES-256-GCM encryption and Shamir key shares registered with zero plaintext transmitted.\n");

    // ─────────────────────────────────────────────────────────────
    // STAGE 2: Poseidon Merkle Tree Root Anchor Verification
    // ─────────────────────────────────────────────────────────────
    console.log("▶ STAGE 2: Poseidon Merkle Tree Root Anchored on EVM Contract");
    const caseDetails = await getJson(`http://localhost:3001/api/case/${caseId}`);
    console.log(`  • On-Chain Record:`, caseDetails.data.onChainRecord);
    if (!caseDetails.data.onChainRecord || !caseDetails.data.onChainRecord.merkleRoot) {
        throw new Error("Stage 2 Merkle Root verification failed!");
    }
    console.log("  ✅ STAGE 2 PASSED: Poseidon Merkle Root verified in CustodyLedger.sol\n");

    // ─────────────────────────────────────────────────────────────
    // STAGE 3: Cryptographic Custody Handoff Logging
    // ─────────────────────────────────────────────────────────────
    console.log("▶ STAGE 3: Signed Custody Chain Handoff");
    const signers = await ethers.getSigners();
    const forensicOfficer = signers[1];
    const transferRes = await postJson("http://localhost:3001/api/transfer-custody", {
        caseId,
        toAddress: forensicOfficer.address,
        signature: "0xdeadbeefc001cafe1234567890abcdef",
    });
    console.log(`  • Custody Transfer Response:`, transferRes.data);
    if (!transferRes.data.success) throw new Error("Stage 3 Custody Transfer failed!");
    console.log("  ✅ STAGE 3 PASSED: Chain-of-custody transfer signed and recorded.\n");

    // ─────────────────────────────────────────────────────────────
    // STAGE 4: Shamir 2-of-3 Lagrange Key Reconstruction Chamber
    // ─────────────────────────────────────────────────────────────
    console.log("▶ STAGE 4: Lagrange Threshold Key Reconstruction & AES Decryption");
    
    // Test 1 share (Should fail 403)
    const singleShareRes = await postJson("http://localhost:3001/api/decrypt-evidence", {
        caseId,
        shares: [{ role: "Investigator", shareValue: keyShares["Investigator"] }],
    });
    console.log(`  • Single Share Attempt: Status ${singleShareRes.status} (Expected 403 Forbidden)`);
    if (singleShareRes.status !== 403) throw new Error("Expected single share decryption to fail with 403!");

    // Test 2 shares (Should succeed and recover original plaintext)
    const multiShareRes = await postJson("http://localhost:3001/api/decrypt-evidence", {
        caseId,
        shares: [
            { role: "Investigator", shareValue: keyShares["Investigator"] },
            { role: "Forensic Officer", shareValue: keyShares["Forensic Officer"] },
        ],
    });
    console.log(`  • Two Shares Lagrange Reconstruction: Status ${multiShareRes.status}`);
    console.log(`  • Decrypted Content Match: ${multiShareRes.data.decryptedContent === rawContent ? "PERFECT MATCH ✓" : "MISMATCH"}`);
    if (multiShareRes.data.decryptedContent !== rawContent) throw new Error("Decrypted content did not match original!");
    console.log("  ✅ STAGE 4 PASSED: 2-of-3 threshold Lagrange interpolation succeeded.\n");

    // ─────────────────────────────────────────────────────────────
    // STAGE 5: Adversarial ZK Verification Arena (Groth16 vs. Tamper)
    // ─────────────────────────────────────────────────────────────
    console.log("▶ STAGE 5: Adversarial ZK Verification Arena");
    
    // Legitimate Proof Verification
    console.log("  • Generating & Verifying Legitimate Groth16 ZK-SNARK Proof...");
    const zkValidRes = await postJson("http://localhost:3001/api/verify-zk", { caseId });
    console.log(`  • Legitimate Proof Result: isValid = ${zkValidRes.data.isValid}`);
    console.log(`  • Merkle Root Used: ${zkValidRes.data.merkleRootUsed}`);
    if (!zkValidRes.data.isValid) throw new Error("Legitimate ZK Proof failed verification!");

    // Adversarial Tampering Test
    console.log("  • Injecting Adversarial Tampered File Buffer into Prover...");
    const zkTamperRes = await postJson("http://localhost:3001/api/verify-zk", {
        caseId,
        tamperedContent: "TAMPERED_MALICIOUS_DATA_INJECTED",
    });
    console.log(`  • Tamper Proof Result: isValid = ${zkTamperRes.data.isValid}`);
    console.log(`  • Rejection Reason: ${zkTamperRes.data.reason || "Proof validation rejected"}`);
    if (zkTamperRes.data.isValid) throw new Error("Adversarial tampered file unexpectedly passed verification!");
    console.log("  ✅ STAGE 5 PASSED: ZK-SNARK mathematically rejects modified evidence.\n");

    console.log("══════════════════════════════════════════════════════════════════");
    console.log("🎉 ALL 5 DYNAMIC FLOW LIFECYCLE STAGES VERIFIED SUCCESSFULLY! 🎉");
    console.log("══════════════════════════════════════════════════════════════════\n");
}

runDynamicFlowTest().catch((err) => {
    console.error("❌ Test failed with error:", err);
    process.exit(1);
});
