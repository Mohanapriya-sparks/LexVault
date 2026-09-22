import path from "path";
import fs from "fs";
import * as snarkjs from "snarkjs";
import { getStoredEvidence } from "./storage";
import { buildEvidenceMerkleTree, sha256ToFieldElement } from "./merkle";
import crypto from "crypto";

const BUILD_DIR = path.resolve(__dirname, "../../circuits/build");
const WASM_PATH = path.join(BUILD_DIR, "evidence_verifier_js", "evidence_verifier.wasm");
const ZKEY_PATH = path.join(BUILD_DIR, "evidence_verifier_final.zkey");
const VKEY_PATH = path.join(BUILD_DIR, "verification_key.json");

export interface GenerateProofOptions {
    caseId: number;
    // Optional tampered file buffer to test failing proof generation / invalid evidence verification
    overrideFileBuffer?: Buffer;
}

export async function generateEvidenceProof(options: GenerateProofOptions) {
    const record = getStoredEvidence(options.caseId);
    if (!record) {
        throw new Error(`No registered evidence found for case #${options.caseId}`);
    }

    let leafToVerify = record.originalCommitment;

    if (options.overrideFileBuffer) {
        // Prover is attempting verification using a tampered or alternate file
        const sha256Hex = crypto.createHash("sha256").update(options.overrideFileBuffer).digest("hex");
        leafToVerify = sha256ToFieldElement(sha256Hex).toString();
    }

    // Build Merkle tree from registered leaf (salted per caseId)
    const treeResult = await buildEvidenceMerkleTree(record.originalCommitment, 3, options.caseId);
    const { merklePath, pathIndices } = treeResult.getProof(0);

    const circuitInput = {
        merkleRoot: treeResult.root,
        leaf: leafToVerify,
        originalCommitment: record.originalCommitment,
        merklePath: merklePath,
        pathIndices: pathIndices,
    };

    // Generate ZK proof using SnarkJS with real wall-clock timing measurement
    const startTime = performance.now();
    const { proof, publicSignals } = await snarkjs.groth16.fullProve(circuitInput, WASM_PATH, ZKEY_PATH);
    const generationTimeMs = Math.max(1, Math.round(performance.now() - startTime));

    // Format proof for Solidity call (`verifier.verifyProof(a, b, c, input)`)
    const solidityCallData = await snarkjs.groth16.exportSolidityCallData(proof, publicSignals);
    const parsedParams = JSON.parse(`[${solidityCallData}]`);

    return {
        proof,
        publicSignals,
        solidityParams: {
            a: parsedParams[0],
            b: parsedParams[1],
            c: parsedParams[2],
            input: parsedParams[3],
        },
        merkleRoot: treeResult.root,
        generationTimeMs,
    };
}

export async function verifyProofOffChain(publicSignals: any, proof: any): Promise<boolean> {
    const vKey = JSON.parse(fs.readFileSync(VKEY_PATH, "utf8"));
    return await snarkjs.groth16.verify(vKey, publicSignals, proof);
}
