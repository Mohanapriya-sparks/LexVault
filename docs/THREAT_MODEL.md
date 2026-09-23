# LexVault — Threat Model & Security Analysis

This document details the trust assumptions, attacker capabilities, security boundaries, and mitigations evaluated for the LexVault presentation-grade, security-conscious hackathon prototype.

---

## 1. System Assets & Security Goals

| Asset | Confidentiality | Integrity | Availability |
| :--- | :--- | :--- | :--- |
| **Raw Evidence Payload** | High (Client-encrypted with AES-256-GCM) | High (Guaranteed via SHA-256 + Merkle root) | Medium (Off-chain storage) |
| **AES Decryption Key** | High (Split into 2-of-3 Shamir shares) | High (Protected by field arithmetic) | High (Reconstructed via any 2 shares) |
| **Case Merkle Root** | Public (Published on EVM ledger) | High (Enforced by ledger contract) | High (Local / network RPC availability) |
| **Chain of Custody Logs** | Public (Indexed on smart contract events) | High (Append-only blockchain log) | High (EVM event queryable) |
| **Witness Values & Merkle Paths** | High (Private to prover during proof) | High (Circuit constraints) | Local Prover |

---

## 2. Attacker Profiles & Threat Scenarios

### Threat 1: Post-Registration Evidence Tampering
- **Attacker Goal:** Modify 1 byte of registered evidence (e.g., altering a digital contract or video frame) without detection.
- **Analysis:**
  - Modifying 1 byte changes the SHA-256 digest $H(E') \neq H(E)$.
  - The reduced scalar leaf $\text{leaf}' \neq \text{originalCommitment}$.
  - The Circom circuit evaluates the constraint `leaf === originalCommitment`.
- **Result:** Prover witness generation fails immediately with a circuit assertion error. Proof cannot be constructed.

### Threat 2: Merkle Root Forgery
- **Attacker Goal:** Submit a forged proof using an arbitrary Merkle root.
- **Analysis:**
  - `CustodyLedger.sol` strictly binds verification to its immutable on-chain record:
    ```solidity
    bytes32 root = caseMerkleRoots[caseId];
    require(root != bytes32(0), "Case not registered");
    uint[1] memory publicInputs = [uint256(root)];
    return verifier.verifyProof(a, b, c, publicInputs);
    ```
- **Result:** The Solidity Verifier pairs proof points $(A, B, C)$ exclusively with the on-chain stored `caseMerkleRoots[caseId]`. The attack fails.

### Threat 3: Unauthorized Evidence Decryption (Collusion < 2)
- **Attacker Goal:** An untrusted party attempts to reconstruct the decryption key with fewer than 2 shares.
- **Analysis:**
  - By polynomial properties of degree $k-1 = 1$, 1 share $s_1 = f(1)$ provides zero information regarding $K = f(0)$. All $r$ possible keys remain equally likely in $\mathbb{F}_r$.
- **Result:** Decryption is cryptographically impossible with $< 2$ distinct shares.

### Threat 4: Backend Compromise & Share Colocation (MVP Scope Disclosure)
- **Mandatory Disclosure:**
  > *“A compromised prototype backend or its storage could expose: ciphertext, IV, AES-GCM authentication tag, evidence leaf / original commitment, Merkle witness material available to the prover, colocated Shamir shares, and metadata such as filename and MIME type. Zero-Knowledge proofs protect private witness values from public proof verification; they do not protect them from compromise of the trusted prover or backend host environment. A production deployment should distribute shares among independent custodians, devices or approval services.”*

### Threat 5: Low-Entropy Evidence Candidates & Unsalted Leaf Commitments
- **Attacker Goal:** Precompute candidate file hashes to identify which file corresponds to an evidence leaf.
- **Analysis:**
  - The prototype maps $L = \text{SHA-256}(\text{data}) \pmod r$ without a per-item salt. If candidate files have low entropy or are known, an attacker observing $L$ could test candidates.
- **Mitigation / Future Work:** Future iterations should employ a salted commitment scheme such as $\text{Poseidon}(\text{domain\_sep}, \text{hash}, \text{salt})$.

---

## 3. Honest Security Disclosures & Boundaries

1. **ZKP Circuit Verification Invariant:**
   > *“The Groth16 circuit proves knowledge of a leaf and Merkle path matching the registered root. By itself, it does not prove possession of the current raw evidence file or that the file was truthful when registered. Tamper detection depends on the application correctly recomputing the fingerprint from the reviewed file and comparing it through the verification workflow.”*

2. **Metadata Transmission Disclosure:**
   > The registration payload includes the original filename and MIME type as unencrypted metadata for investigator reference. If filename confidentiality is required, a production deployment should transmit generic categorical labels (e.g. `evidence_item_01.dat`) or client-side encrypted metadata envelopes.

3. **Cryptographic Setup Disclosure:**
   > `circuits/build/pot12_final.ptau` is a **Phase 1 Powers-of-Tau artifact** (universal SRS), and `circuits/build/evidence_verifier_final.zkey` is **circuit-specific Phase 2 material**. The included trusted setup was generated locally for prototype demonstration and is not a formal multi-party production ceremony.

4. **Read-Only EVM Verification & Ledger Semantics:**
   > Read-only EVM `eth_call`: no transaction is submitted, no blockchain state changes, and no gas fee is paid. The full MVP uses a local Hardhat EVM ledger with chain ID 31337. Its state can be reset or redeployed.

5. **Prototype Verification Qualification:**
   > *LexVault passed all implemented build, smart-contract, circuit, lifecycle, isolation, security-policy and presentation-preflight checks. These results validate the hackathon prototype’s implemented behaviour; they do not constitute a professional security audit or guarantee production readiness. The protection holds while local Hardhat ledger state is preserved; the MVP chain can be reset or redeployed.*
