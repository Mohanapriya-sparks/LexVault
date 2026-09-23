const { expect } = require("chai");
const { ethers } = require("hardhat");
const path = require("path");
const fs = require("fs");
const snarkjs = require("snarkjs");
const { buildPoseidon } = require("circomlibjs");
const crypto = require("crypto");

const SNARK_FIELD_PRIME = BigInt("21888242871839275222246405745257275088548364400416034343698204186575808495617");

function sha256ToFieldElement(sha256Hex) {
    const bigIntVal = BigInt("0x" + sha256Hex.replace(/^0x/, ""));
    return (bigIntVal % SNARK_FIELD_PRIME).toString();
}

describe("CustodyLedger Smart Contract Tests", function () {
    this.timeout(60000);

    let verifier;
    let ledger;
    let owner;
    let investigator;
    let forensicOfficer;
    let courtReviewer;
    let poseidon;

    const buildDir = path.resolve(__dirname, "../../circuits/build");
    const wasmPath = path.join(buildDir, "evidence_verifier_js", "evidence_verifier.wasm");
    const zkeyPath = path.join(buildDir, "evidence_verifier_final.zkey");

    beforeEach(async function () {
        [owner, investigator, forensicOfficer, courtReviewer] = await ethers.getSigners();
        poseidon = await buildPoseidon();

        // Deploy SnarkJS Generated Groth16Verifier Contract
        const VerifierFactory = await ethers.getContractFactory("Groth16Verifier");
        verifier = await VerifierFactory.deploy();
        await verifier.waitForDeployment();

        // Deploy CustodyLedger
        const LedgerFactory = await ethers.getContractFactory("CustodyLedger");
        ledger = await LedgerFactory.deploy(await verifier.getAddress());
        await ledger.waitForDeployment();
    });

    async function generateTree(evidenceLeafStr, depth = 3, caseId = 101) {
        const totalLeaves = 1 << depth;
        const leaves = [evidenceLeafStr];
        for (let i = 1; i < totalLeaves; i++) {
            const dummySHA = crypto.createHash("sha256").update(`lexvault_case_${caseId}_dummy_leaf_${i}`).digest("hex");
            leaves.push(sha256ToFieldElement(dummySHA));
        }

        const tree = [leaves.map((l) => l.toString())];
        let currentLayer = leaves.map((l) => poseidon.F.e(l));

        for (let level = 0; level < depth; level++) {
            const nextLayer = [];
            for (let i = 0; i < currentLayer.length; i += 2) {
                const parent = poseidon([currentLayer[i], currentLayer[i + 1]]);
                nextLayer.push(parent);
            }
            currentLayer = nextLayer;
            tree.push(currentLayer.map((node) => poseidon.F.toString(node)));
        }

        const root = poseidon.F.toString(currentLayer[0]);

        const getProof = (leafIndex) => {
            const merklePath = [];
            const pathIndices = [];
            let idx = leafIndex;
            for (let level = 0; level < depth; level++) {
                const isRight = idx % 2 === 1;
                const siblingIdx = isRight ? idx - 1 : idx + 1;
                merklePath.push(tree[level][siblingIdx]);
                pathIndices.push(isRight ? 1 : 0);
                idx = Math.floor(idx / 2);
            }
            return { merklePath, pathIndices };
        };

        return { root, leaves, tree, getProof };
    }

    it("should register a case with stored merkleRoot and emit event", async function () {
        const caseId = 101;
        const merkleRootHex = "0x" + BigInt("1234567890987654321").toString(16).padStart(64, "0");

        const tx = await ledger.connect(investigator).registerCase(caseId, merkleRootHex);
        await expect(tx).to.emit(ledger, "CaseRegistered");

        const record = await ledger.cases(caseId);
        expect(record.merkleRoot).to.equal(merkleRootHex);
        expect(record.custodian).to.equal(investigator.address);
    });

    it("should allow initial custodian to transfer custody and log history", async function () {
        const caseId = 101;
        const merkleRootHex = "0x" + BigInt("1234567890987654321").toString(16).padStart(64, "0");
        await ledger.connect(investigator).registerCase(caseId, merkleRootHex);

        const sig = "0xabcdef1234567890";
        await ledger.connect(investigator).transferCustody(caseId, forensicOfficer.address, sig);

        const record = await ledger.cases(caseId);
        expect(record.custodian).to.equal(forensicOfficer.address);

        const history = await ledger.getCustodyHistory(caseId);
        expect(history.length).to.equal(1);
        expect(history[0].from).to.equal(investigator.address);
        expect(history[0].to).to.equal(forensicOfficer.address);
    });

    it("should reject custody transfer if caller is not current custodian", async function () {
        const caseId = 102;
        const merkleRootHex = "0x" + BigInt("1234567890987654321").toString(16).padStart(64, "0");
        await ledger.connect(investigator).registerCase(caseId, merkleRootHex);

        const sig = "0xabcdef1234567890";
        // Court Reviewer is NOT the custodian (Investigator is)
        await expect(
            ledger.connect(courtReviewer).transferCustody(caseId, forensicOfficer.address, sig)
        ).to.be.revertedWith("Only current custodian can transfer");
    });

    it("should reject custody transfer by former custodian after handoff", async function () {
        const caseId = 103;
        const merkleRootHex = "0x" + BigInt("1234567890987654321").toString(16).padStart(64, "0");
        await ledger.connect(investigator).registerCase(caseId, merkleRootHex);

        const sig1 = "0x11111111";
        // Transfer Investigator -> Forensic Officer
        await ledger.connect(investigator).transferCustody(caseId, forensicOfficer.address, sig1);

        const sig2 = "0x22222222";
        // Investigator is now the FORMER custodian and must be rejected
        await expect(
            ledger.connect(investigator).transferCustody(caseId, courtReviewer.address, sig2)
        ).to.be.revertedWith("Only current custodian can transfer");
    });

    it("should allow new custodian to perform subsequent custody transfer", async function () {
        const caseId = 104;
        const merkleRootHex = "0x" + BigInt("1234567890987654321").toString(16).padStart(64, "0");
        await ledger.connect(investigator).registerCase(caseId, merkleRootHex);

        const sig1 = "0x11111111";
        // 1st Transfer: Investigator -> Forensic Officer
        await ledger.connect(investigator).transferCustody(caseId, forensicOfficer.address, sig1);

        const sig2 = "0x22222222";
        // 2nd Transfer: Forensic Officer (current custodian) -> Court Reviewer
        await ledger.connect(forensicOfficer).transferCustody(caseId, courtReviewer.address, sig2);

        const record = await ledger.cases(caseId);
        expect(record.custodian).to.equal(courtReviewer.address);

        const history = await ledger.getCustodyHistory(caseId);
        expect(history.length).to.equal(2);
        expect(history[1].from).to.equal(forensicOfficer.address);
        expect(history[1].to).to.equal(courtReviewer.address);
    });

    it("should reject custody transfer to zero address", async function () {
        const caseId = 105;
        const merkleRootHex = "0x" + BigInt("1234567890987654321").toString(16).padStart(64, "0");
        await ledger.connect(investigator).registerCase(caseId, merkleRootHex);

        const sig = "0xabcdef";
        await expect(
            ledger.connect(investigator).transferCustody(caseId, ethers.ZeroAddress, sig)
        ).to.be.revertedWith("Invalid new custodian");
    });

    it("should reject custody transfer to current custodian (self-transfer)", async function () {
        const caseId = 106;
        const merkleRootHex = "0x" + BigInt("1234567890987654321").toString(16).padStart(64, "0");
        await ledger.connect(investigator).registerCase(caseId, merkleRootHex);

        const sig = "0xabcdef";
        await expect(
            ledger.connect(investigator).transferCustody(caseId, investigator.address, sig)
        ).to.be.revertedWith("Cannot transfer to current custodian");
    });

    it("should reject duplicate case registration based on merkleRoot existence", async function () {
        const caseId = 107;
        const merkleRootHex = "0x" + BigInt("1234567890987654321").toString(16).padStart(64, "0");
        await ledger.connect(investigator).registerCase(caseId, merkleRootHex);

        // Attempt second registration with same caseId
        await expect(
            ledger.connect(investigator).registerCase(caseId, merkleRootHex)
        ).to.be.revertedWith("Case already registered");
    });

    it("should reject case registration with zero Merkle root", async function () {
        const caseId = 108;
        await expect(
            ledger.connect(investigator).registerCase(caseId, ethers.ZeroHash)
        ).to.be.revertedWith("Invalid Merkle root");
    });

    it("should reject verification for non-existent case", async function () {
        const fakeCaseId = 999;
        const dummyA = [0, 0];
        const dummyB = [[0, 0], [0, 0]];
        const dummyC = [0, 0];

        await expect(
            ledger.verifyEvidence(fakeCaseId, dummyA, dummyB, dummyC)
        ).to.be.revertedWith("Case not registered");
    });

    it("should verify real Groth16 ZK proof on-chain with contract-enforced case binding", async function () {
        const caseId = 101;
        const fileContent = "Original Forensic Evidence PDF - Case #101";
        const sha256Hex = crypto.createHash("sha256").update(fileContent).digest("hex");
        const leaf = sha256ToFieldElement(sha256Hex);

        const { root, getProof } = await generateTree(leaf, 3, caseId);
        const { merklePath, pathIndices } = getProof(0);

        // Convert root to bytes32 format for smart contract registration
        const rootHex = "0x" + BigInt(root).toString(16).padStart(64, "0");

        // 1. Register case on-chain with ONLY the Merkle root
        await ledger.connect(investigator).registerCase(caseId, rootHex);

        // 2. Generate ZK proof off-chain
        const input = {
            merkleRoot: root,
            leaf: leaf,
            originalCommitment: leaf,
            merklePath: merklePath,
            pathIndices: pathIndices,
        };

        const { proof, publicSignals } = await snarkjs.groth16.fullProve(input, wasmPath, zkeyPath);
        const callDataStr = await snarkjs.groth16.exportSolidityCallData(proof, publicSignals);
        const [a, b, c] = JSON.parse(`[${callDataStr}]`);

        // 3. Call CustodyLedger.verifyEvidence(caseId, a, b, c)
        // Notice: NO merkleRoot passed by caller! Contract looks up stored root from cases[caseId]
        const isValid = await ledger.verifyEvidence(caseId, a, b, c);
        expect(isValid).to.equal(true);
    });
});
