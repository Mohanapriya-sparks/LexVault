import { buildPoseidon } from "circomlibjs";
import crypto from "crypto";

// BN128 Scalar Field Prime p
export const SNARK_FIELD_PRIME = BigInt(
    "21888242871839275222246405745257275088548364400416034343698204186575808495617"
);

/**
 * FIELD MAPPING CONVENTION FOR SHA-256 LEAF COMMITMENTS:
 * -----------------------------------------------------------------------------
 * SHA-256 produces a 256-bit hash output (e.g. 32-byte digest).
 * The BN128 scalar field prime `p` is ~254 bits long.
 * 
 * To convert a 256-bit SHA-256 digest into a valid field element `leaf`:
 * We treat the 32-byte digest hex as a 256-bit unsigned integer and apply modulo reduction:
 *     `leaf = BigInt("0x" + sha256Hex) % SNARK_FIELD_PRIME`
 * 
 * Why modulo reduction over field splitting?
 * 1. A single scalar field element representation preserves simplicity in Circom inputs.
 * 2. The collision resistance of SHA-256 truncated/modded by BN128 field (~254 bits) is
 *    2^127, matching the 128-bit security level of BN128 Groth16 zk-SNARKs.
 * 3. Off-circuit Web Crypto API (or Node crypto) SHA-256 hashing is directly compatible.
 */
export function sha256ToFieldElement(sha256Hex: string): bigint {
    const bigIntVal = BigInt("0x" + sha256Hex.replace(/^0x/, ""));
    return bigIntVal % SNARK_FIELD_PRIME;
}

export function hashFileSHA256(buffer: Buffer): { hex: string; fieldElement: string } {
    const sha256Hex = crypto.createHash("sha256").update(buffer).digest("hex");
    const fieldElement = sha256ToFieldElement(sha256Hex).toString();
    return { hex: sha256Hex, fieldElement };
}

export interface MerkleTreeResult {
    root: string;
    leaves: string[];
    tree: string[][];
    getProof: (leafIndex: number) => { merklePath: string[]; pathIndices: number[] };
}

/**
 * Builds a depth-N Poseidon Merkle Tree for evidence commitments.
 * @param evidenceLeaf Real evidence commitment scalar field element.
 * @param depth Tree depth (depth 3 = 8 leaves).
 * @param caseId Unique case identifier used to salt dummy leaves per case.
 */
export async function buildEvidenceMerkleTree(
    evidenceLeaf: string,
    depth: number = 3,
    caseId: number = 101
): Promise<MerkleTreeResult> {
    const poseidon = await buildPoseidon();
    const totalLeaves = 1 << depth; // 2^depth (8 leaves for depth 3)

    // Leaf 0 is the real evidence leaf.
    // Leaves 1..totalLeaves-1 are case-salted deterministic dummy commitments.
    const leaves: string[] = [evidenceLeaf];

    for (let i = 1; i < totalLeaves; i++) {
        const dummySHA = crypto
            .createHash("sha256")
            .update(`lexvault_case_${caseId}_dummy_leaf_${i}`)
            .digest("hex");
        const dummyLeaf = sha256ToFieldElement(dummySHA).toString();
        leaves.push(dummyLeaf);
    }

    // Build tree layer by layer using Poseidon(2)
    const tree: string[][] = [leaves.map((l) => l.toString())];

    let currentLayer = leaves.map((l) => poseidon.F.e(l));

    for (let level = 0; level < depth; level++) {
        const nextLayer: any[] = [];
        for (let i = 0; i < currentLayer.length; i += 2) {
            const left = currentLayer[i];
            const right = currentLayer[i + 1];
            const parent = poseidon([left, right]);
            nextLayer.push(parent);
        }
        currentLayer = nextLayer;
        tree.push(currentLayer.map((node) => poseidon.F.toString(node)));
    }

    const root = poseidon.F.toString(currentLayer[0]);

    const getProof = (leafIndex: number) => {
        const merklePath: string[] = [];
        const pathIndices: number[] = [];

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

    return {
        root,
        leaves,
        tree,
        getProof,
    };
}
