const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const SNARK_FIELD_PRIME = BigInt("21888242871839275222246405745257275088548364400416034343698204186575808495617");
const VAULT_DIR = path.resolve(__dirname, "../vault");

function sha256ToFieldElement(sha256Hex) {
    const bigIntVal = BigInt("0x" + sha256Hex.replace(/^0x/, ""));
    return (bigIntVal % SNARK_FIELD_PRIME).toString();
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

function seedCase(caseId, filename, textContent) {
    const buffer = Buffer.from(textContent, "utf8");
    const sha256Hex = crypto.createHash("sha256").update(buffer).digest("hex");
    const leafFieldElement = sha256ToFieldElement(sha256Hex);
    const shamir = generateEphemeralShamirKey();
    const enc = encryptBufferWithKey(buffer, shamir.keyBuffer);

    const record = {
        caseId: parseInt(caseId),
        filename: filename,
        encryptedData: enc.encryptedData,
        iv: enc.iv,
        authTag: enc.authTag,
        mimeType: "text/plain",
        registeredAt: Date.now(),
        originalCommitment: leafFieldElement,
        keyShares: shamir.keyShares,
    };

    const filePath = path.join(VAULT_DIR, `case_${caseId}.json`);
    fs.writeFileSync(filePath, JSON.stringify(record, null, 2));
    console.log(`✅ Seeded Case #${caseId} -> filename: ${filename}, file: ${filePath}`);
}

// Clean and re-seed all test cases with unique, case-specific content
const files = fs.readdirSync(VAULT_DIR).filter(f => f.startsWith("case_") && f.endsWith(".json"));
for (const f of files) {
    const match = f.match(/^case_(\d+)\.json$/);
    if (match) {
        const cId = parseInt(match[1]);
        const filename = `Forensic_DNA_Report_C${cId}.txt`;
        const content = `CONFIDENTIAL FORENSIC REPORT\nCase: #${cId}\nSubject: Crime Scene DNA & Ballistics Sample for Case #${cId}\nStatus: Cryptographically sealed via LexVault ZK protocol.`;
        seedCase(cId, filename, content);
    }
}

console.log("\n🎉 All vault records successfully synced to match their exact Case IDs!");
