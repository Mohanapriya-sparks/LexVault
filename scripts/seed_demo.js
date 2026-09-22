const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { buildPoseidon } = require("circomlibjs");

const SNARK_FIELD_PRIME = BigInt("21888242871839275222246405745257275088548364400416034343698204186575808495617");

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

async function main() {
    console.log("=== Seeding Demo Case #101 for LexVault ===");

    const deploymentPath = path.resolve(__dirname, "../deployment.json");
    if (!fs.existsSync(deploymentPath)) {
        throw new Error("deployment.json not found! Run npm run deploy first.");
    }
    const deployment = JSON.parse(fs.readFileSync(deploymentPath, "utf8"));

    const signers = await ethers.getSigners();
    const investigator = signers[0]; // 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266
    const forensicOfficer = signers[1]; // 0x70997970C51812dc3A010C7d01b50e0d17dc79C8
    const defenseLawyer = signers[2]; // 0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC
    const courtReviewer = signers[3]; // 0x90F79bf6EB2c4f80806636108e457008075fe460

    const CustodyLedgerArtifact = JSON.parse(
        fs.readFileSync(path.resolve(__dirname, "../artifacts/contracts/CustodyLedger.sol/CustodyLedger.json"), "utf8")
    );
    const ledger = new ethers.Contract(deployment.custodyLedgerAddress, CustodyLedgerArtifact.abi, investigator);
    const poseidon = await buildPoseidon();

    // Helper to register and seed any case
    async function seedCase(cId, filename, evidenceContent, handoffs = []) {
        const fileBuffer = Buffer.from(evidenceContent, "utf8");
        const sha256Hex = crypto.createHash("sha256").update(fileBuffer).digest("hex");
        const leafFieldElement = sha256ToFieldElement(sha256Hex);
        const { keyBuffer, keyShares } = generateEphemeralShamirKey();
        const { encryptedData, iv, authTag } = encryptBufferWithKey(fileBuffer, keyBuffer);

        const vaultDir = path.resolve(__dirname, "../vault");
        if (!fs.existsSync(vaultDir)) {
            fs.mkdirSync(vaultDir, { recursive: true });
        }
        const record = {
            caseId: cId,
            filename,
            encryptedData,
            iv,
            authTag,
            mimeType: "application/pdf",
            registeredAt: Date.now(),
            originalCommitment: leafFieldElement,
            keyShares,
        };
        fs.writeFileSync(path.join(vaultDir, `case_${cId}.json`), JSON.stringify(record, null, 2));

        const leaves = [leafFieldElement];
        for (let i = 1; i < 8; i++) {
            const dummySHA = crypto.createHash("sha256").update(`lexvault_case_${cId}_dummy_leaf_${i}`).digest("hex");
            leaves.push(sha256ToFieldElement(dummySHA));
        }
        let currentLayer = leaves.map((l) => poseidon.F.e(l));
        for (let level = 0; level < 3; level++) {
            const nextLayer = [];
            for (let i = 0; i < currentLayer.length; i += 2) {
                nextLayer.push(poseidon([currentLayer[i], currentLayer[i + 1]]));
            }
            currentLayer = nextLayer;
        }
        const merkleRoot = poseidon.F.toString(currentLayer[0]);
        const rootHex = "0x" + BigInt(merkleRoot).toString(16).padStart(64, "0");

        console.log(`Writing Poseidon Merkle root to chain for Case #${cId}...`);
        const regTx = await ledger.registerCase(cId, rootHex);
        await regTx.wait();
        console.log(`✅ On-chain registration complete for Case #${cId}! Root: ${rootHex}`);

        for (const handoff of handoffs) {
            const fromSigner = handoff.from;
            const toAddress = handoff.to.address;
            const sig = await fromSigner.signMessage(`Transfer Case #${cId} to ${toAddress}`);
            const tx = await ledger.connect(fromSigner).transferCustody(cId, toAddress, sig);
            await tx.wait();
            console.log(`  -> Custody transferred for Case #${cId}: ${fromSigner.address} -> ${toAddress}`);
        }
    }

    // Case #101: 2 handoffs: Investigator -> Forensic Officer -> Court Reviewer (0x90F7...E460)
    await seedCase(101, "Forensic_Ballistics_DNA_Report.pdf", "CONFIDENTIAL FORENSIC REPORT\nCase ID: #101\nSubject: Crime Scene DNA & Ballistics Sample\nChain of Custody: Verified via LexVault ZK-SNARK\nStatus: Unmodified", [
        { from: investigator, to: forensicOfficer },
        { from: forensicOfficer, to: courtReviewer }
    ]);

    // Case #102: Initial registration only (0 handoffs, custodian: Investigator)
    await seedCase(102, "Surveillance_CCTV_Sector7.mp4", "CONFIDENTIAL SURVEILLANCE FEED\nCase ID: #102\nSubject: Sector 7 Entryway CCTV Camera Footage\nIntegrity: Unbroken cryptographic seal", []);

    // Case #103: 1 handoff: Investigator -> Forensic Officer (0x7099...79C8)
    await seedCase(103, "Forensic_DNA_Sample_C103.txt", "CONFIDENTIAL EVIDENCE FILE CONTENT FOR CASE #103\nDNA Match: 99.98% Confidence\nBallistics: Caliber 9x19mm Parabellum match confirmed.", [
        { from: investigator, to: forensicOfficer }
    ]);

    // Case #107: 1 handoff: Investigator -> Defense Lawyer (0x3C44...93BC) (Cross-Case Isolation Demo Case)
    await seedCase(107, "Forensic_DNA_Report_C107.txt", "CONFIDENTIAL FORENSIC REPORT\nCase: #107\nSubject: Crime Scene DNA & Ballistics Sample\nChain of Custody: Verified via LexVault ZK-SNARK\nStatus: Unmodified", [
        { from: investigator, to: defenseLawyer }
    ]);

    console.log("\n🎉 Seed demo setup completed successfully!");
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
