# LexVault — Threat Model & Security Analysis

This document details the trust assumptions, attacker capabilities, security boundaries, and mitigations evaluated for the LexVault protocol.

---

## 1. System Assets & Security Goals

| Asset | Confidentiality | Integrity | Availability |
|---|---|---|---|
| **Raw Evidence Payload** | High (Client-encrypted with AES-256-GCM) | High (Guaranteed via SHA-256 + Merkle root) | Medium (Off-chain storage) |
| **AES Decryption Key** | High (Split into 2-of-3 Shamir shares) | High (Protected by field arithmetic) | High (Reconstructed via any 2 shares) |
| **Case Merkle Root** | Public (Published on Ethereum ledger) | High (Enforced by EVM consensus) | High (Ethereum network uptime) |
| **Chain of Custody Logs** | Public (Indexed on smart contract events) | High (Append-only blockchain log) | High (EVM event queryable) |
| **Witness Values & Merkle Paths** | High (Private to prover during proof) | High (Circuit constraints) | Local Prover |

---

## 2. Attacker Profiles & Threat Scenarios

### Threat 1: Post-Registration Evidence Tampering
- **Attacker Goal:** Modify 1 byte of registered evidence (e.g. altering a digital contract or video frame) without detection.
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
- **Attacker Goal:** An untrusted party (e.g. Intern clearance or a single compromised custodian) attempts to reconstruct the decryption key.
- **Analysis:**
  - By polynomial properties of degree $k-1 = 1$, 1 share $s_1 = f(1)$ provides zero information regarding $K = f(0)$. All $r$ possible keys are equally likely in $\mathbb{F}_r$.
  - Deterministic policy checks reject unauthorized role clearances with HTTP 403 before key operations.
- **Result:** Decryption is cryptographically impossible with $< 2$ distinct shares.

### Threat 4: Backend Compromise & Share Colocation (MVP Scope Disclosure)
- **Current Limitation:** In the prototype implementation, the 3 encrypted key shares are submitted to the vault backend during initial case registration for demonstration evaluation.
- **Threat:** If an attacker compromises the backend storage, they could theoretically read 2 stored shares and reconstruct the key.
- **Production Mitigation:** In production deployment, Shamir key shares must be distributed directly to independent custodian hardware wallets / key management services without centralized server aggregation.

---

## 3. Honest Security Disclosures

1. **Not a Proof of Real-World Truth:** LexVault guarantees mathematical integrity after digital registration. It cannot determine whether the raw video or document was authentic or manufactured (e.g. deepfake) prior to upload.
2. **Read-Only EVM Verification:** Proof verification occurs via `eth_call`. It modifies no state, spends no gas, and records no transaction receipt.
3. **Audit Status:** LexVault is an open-source hackathon prototype. It has not undergone an independent third-party cryptographic or smart contract audit.
