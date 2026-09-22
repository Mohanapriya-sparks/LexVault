const { expect } = require("chai");
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

describe("EvidenceVaultVerifier Circuit Tests", function () {
    this.timeout(60000);

    let poseidon;
    const buildDir = path.resolve(__dirname, "../build");
    const wasmPath = path.join(buildDir, "evidence_verifier_js", "evidence_verifier.wasm");
    const zkeyPath = path.join(buildDir, "evidence_verifier_final.zkey");
    const vkeyPath = path.join(buildDir, "verification_key.json");

    before(async function () {
        poseidon = await buildPoseidon();
        if (!fs.existsSync(wasmPath) || !fs.existsSync(zkeyPath)) {
            throw new Error("Circuit compilation artifacts missing! Run node circuits/scripts/compile_circuit.js first.");
        }
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

    it("should successfully generate and verify proof for valid evidence & Merkle path", async function () {
        const fileContent = "Confidential Forensic Evidence PDF Content - Case #101";
        const sha256 = crypto.createHash("sha256").update(fileContent).digest("hex");
        const leaf = sha256ToFieldElement(sha256);
        const originalCommitment = leaf;

        const { root, getProof } = await generateTree(leaf, 3, 101);
        const { merklePath, pathIndices } = getProof(0);

        const input = {
            merkleRoot: root,
            leaf: leaf,
            originalCommitment: originalCommitment,
            merklePath: merklePath,
            pathIndices: pathIndices,
        };

        const { proof, publicSignals } = await snarkjs.groth16.fullProve(input, wasmPath, zkeyPath);
        const vKey = JSON.parse(fs.readFileSync(vkeyPath, "utf8"));
        const isValid = await snarkjs.groth16.verify(vKey, publicSignals, proof);

        expect(isValid).to.equal(true);
        expect(publicSignals[0]).to.equal(root);
    });

    it("should fail proof generation if non-boolean pathIndices value (e.g. 2) is supplied", async function () {
        const fileContent = "Valid Evidence File - Case #101";
        const leaf = sha256ToFieldElement(crypto.createHash("sha256").update(fileContent).digest("hex"));

        const { root, getProof } = await generateTree(leaf, 3, 101);
        const { merklePath, pathIndices } = getProof(0);

        // Malicious non-boolean selector supplied
        const invalidPathIndices = [...pathIndices];
        invalidPathIndices[0] = 2;

        const input = {
            merkleRoot: root,
            leaf: leaf,
            originalCommitment: leaf,
            merklePath: merklePath,
            pathIndices: invalidPathIndices,
        };

        try {
            await snarkjs.groth16.fullProve(input, wasmPath, zkeyPath);
            expect.fail("Proof generation should have failed due to non-boolean pathIndices constraint pathIndices[i] * (pathIndices[i] - 1) === 0");
        } catch (err) {
            expect(err.message).to.include("Assert Failed");
        }
    });

    it("should fail proof generation if tampered leaf does not match originalCommitment", async function () {
        const originalFile = "Original Evidence File - Case #101";
        const tamperedFile = "Tampered Evidence File - Case #101";

        const originalLeaf = sha256ToFieldElement(crypto.createHash("sha256").update(originalFile).digest("hex"));
        const tamperedLeaf = sha256ToFieldElement(crypto.createHash("sha256").update(tamperedFile).digest("hex"));

        const { root, getProof } = await generateTree(originalLeaf, 3, 101);
        const { merklePath, pathIndices } = getProof(0);

        const input = {
            merkleRoot: root,
            leaf: tamperedLeaf, // Tampered leaf provided by prover
            originalCommitment: originalLeaf, // Registered commitment
            merklePath: merklePath,
            pathIndices: pathIndices,
        };

        try {
            await snarkjs.groth16.fullProve(input, wasmPath, zkeyPath);
            expect.fail("Proof generation should have failed due to leaf !== originalCommitment assertion");
        } catch (err) {
            expect(err.message).to.include("Assert Failed");
        }
    });

    it("should fail proof verification if merkleRoot is corrupted", async function () {
        const fileContent = "Valid Evidence File - Case #101";
        const leaf = sha256ToFieldElement(crypto.createHash("sha256").update(fileContent).digest("hex"));

        const { root, getProof } = await generateTree(leaf, 3, 101);
        const { merklePath, pathIndices } = getProof(0);

        const input = {
            merkleRoot: root,
            leaf: leaf,
            originalCommitment: leaf,
            merklePath: merklePath,
            pathIndices: pathIndices,
        };

        const { proof, publicSignals } = await snarkjs.groth16.fullProve(input, wasmPath, zkeyPath);
        const vKey = JSON.parse(fs.readFileSync(vkeyPath, "utf8"));

        // Corrupt public root signal
        const fakeRoot = "1234567890987654321";
        const isValid = await snarkjs.groth16.verify(vKey, [fakeRoot], proof);
        expect(isValid).to.equal(false);
    });
});
