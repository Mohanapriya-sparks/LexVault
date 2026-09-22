pragma circom 2.1.6;

include "circomlib/circuits/poseidon.circom";
include "circomlib/circuits/switcher.circom";

/**
 * EvidenceVaultVerifier Circuit
 * 
 * Proves that:
 * 1. The private evidence `leaf` matches the `originalCommitment` established at registration.
 * 2. The private evidence `leaf` is included in the Merkle tree with public `merkleRoot`.
 * 
 * Public input:
 *  - merkleRoot: Case Merkle root registered on-chain
 * 
 * Private inputs:
 *  - leaf: SHA-256 evidence leaf mapped to BN128 scalar field
 *  - originalCommitment: Commitment recorded at registration
 *  - merklePath[DEPTH]: Sibling hashes from leaf to root
 *  - pathIndices[DEPTH]: Left/Right flags (0 = current is left, 1 = current is right)
 */
template EvidenceVaultVerifier(DEPTH) {
    // ------------------------------------------------------------------------
    // Public Input
    // ------------------------------------------------------------------------
    signal input merkleRoot;

    // ------------------------------------------------------------------------
    // Private Inputs
    // ------------------------------------------------------------------------
    signal input leaf;
    signal input originalCommitment;
    signal input merklePath[DEPTH];
    signal input pathIndices[DEPTH];

    // 1. Assert leaf matches original commitment established at registration
    leaf === originalCommitment;

    // 2. Merkle inclusion proof using Poseidon internal hashing
    component poseidon[DEPTH];
    component switcher[DEPTH];

    signal currentHash[DEPTH + 1];
    currentHash[0] <== leaf;

    for (var i = 0; i < DEPTH; i++) {
        // Enforce pathIndices[i] ∈ {0,1} — required because Switcher does
        // not itself constrain sel to be boolean. Without this, a
        // malicious prover could supply a non-boolean selector and break
        // the left/right inclusion guarantee.
        pathIndices[i] * (pathIndices[i] - 1) === 0;

        switcher[i] = Switcher();
        switcher[i].L <== currentHash[i];
        switcher[i].R <== merklePath[i];
        switcher[i].sel <== pathIndices[i];

        poseidon[i] = Poseidon(2);
        poseidon[i].inputs[0] <== switcher[i].outL;
        poseidon[i].inputs[1] <== switcher[i].outR;

        currentHash[i + 1] <== poseidon[i].out;
    }

    // 3. Assert computed root equals public merkleRoot
    currentHash[DEPTH] === merkleRoot;
}

// Fixed-depth 3 binary tree (8 leaves: 1 real evidence leaf + 7 deterministic dummy leaves)
component main {public [merkleRoot]} = EvidenceVaultVerifier(3);
