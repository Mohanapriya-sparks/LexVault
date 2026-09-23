# LexVault — Cryptographic Security Boundaries & Trust Disclosures

This document clearly establishes what LexVault proves, what it does not prove, and the architectural assumptions underpinning its presentation-grade, security-conscious hackathon prototype.

---

## 1. What LexVault Cryptographically Proves

1. **Post-Registration Integrity:** Proves that an evidence item presented for verification has the exact SHA-256 digest and scalar field element mapped during registration. Even a 1-byte alteration causes circuit constraint failure.
2. **Case Merkle Tree Membership:** Proves via a Groth16 zero-knowledge proof that the evidence leaf exists within the case's Poseidon Merkle tree without revealing:
   - The raw evidence content.
   - The leaf preimage.
   - The private Merkle authentication path.
   - The original commitment.
3. **On-Chain Custody Auditability:** Proves the sequential history of authorized custodian handoffs recorded in the `CustodyLedger.sol` smart contract on the local Hardhat EVM ledger (chain ID 31337).
4. **2-of-3 Quorum Access Authorization:** Enforces that AES-256-GCM symmetric decryption key reconstruction requires at least 2 distinct authorized polynomial shares.

---

## 2. What LexVault Does NOT Prove (Honest Disclosures)

1. **Pre-Registration Authenticity:** LexVault does not prove that a photograph, video, or audio recording was authentic or un-manipulated *before* it was registered. It cannot detect if a source file is a generative AI deepfake.
2. **Investigative Legality:** LexVault does not attest to the legality of law-enforcement procedures or search warrants under which evidence was gathered.
3. **Automated Courtroom Admissibility:** Admissibility is a jurisdiction-specific legal ruling governed by applicable rules of evidence. LexVault provides cryptographic audit support; it does not replace legal certification.
4. **Endpoint Security:** LexVault does not protect against malware or keyloggers compromising the custodian's local device prior to or during evidence viewing.
5. **Production Readiness:** LexVault is a hackathon prototype and has not undergone third-party commercial security audits.

---

## 3. Blockchain Execution Semantics

- **Ledger Environment:** The full MVP uses a local Hardhat EVM ledger with chain ID 31337. Its state can be reset or redeployed.
- **ZK Verification Execution:** Verification is evaluated via a read-only EVM `eth_call` against `Verifier.sol`.
- **Zero State Modification:** Read-only EVM `eth_call`: no transaction is submitted, no blockchain state changes, and no gas fee is paid.
- **Privacy Preservation:** Public nodes observe only the query and public Merkle root; raw evidence and private witness signals remain on the client/prover environment.

---

## 4. ZKP Circuit Verification Limitation

> [!WARNING]
> **ZKP Circuit Verification Invariant**
> *The Groth16 circuit proves knowledge of a leaf and Merkle path matching the registered root. By itself, it does not prove possession of the current raw evidence file or that the file was truthful when registered. Tamper detection depends on the application correctly recomputing the fingerprint from the reviewed file and comparing it through the verification workflow.*

---

## 5. Backend Compromise & Trusted Environment Boundary

> [!IMPORTANT]
> **Backend & Storage Compromise Disclosure**
> *A compromised prototype backend or its storage could expose: ciphertext, IV, AES-GCM authentication tag, evidence leaf / original commitment, Merkle witness material available to the prover, colocated Shamir shares, and metadata such as filename and MIME type.*
> 
> *Zero-Knowledge proofs protect private witness values from public proof verification; they do not protect them from compromise of the trusted prover or backend host environment.*

---

## 6. Shamir Secret Sharing Limitation

> [!WARNING]
> **Prototype Key Distribution Disclosure**
> *The prototype demonstrates 2-of-3 approval and Shamir-based key reconstruction. If all shares are accessible to the same backend process or storage environment, compromise of that environment could permit key reconstruction. A production deployment should distribute shares among independent custodians, devices or approval services.*

---

## 7. Unsalted Leaf Commitments, Padding Leaves, and Scalar Field Capacity

- **Unsalted Leaf Mapping:** The prototype maps SHA-256 digests into the BN128 scalar field as $L = \text{SHA-256}(\text{data}) \pmod r$ without a per-item secret salt. If candidate evidence files have low entropy or are drawn from a small known set, an adversary observing the leaf value could test candidate files. Future production iterations should employ a salted commitment scheme such as $\text{Poseidon}(\text{domain\_sep}, \text{hash}, \text{salt})$.
- **Deterministic Padding Leaves:** Case Merkle trees pad unused leaf slots with deterministic zeros (`0`). Future designs should use domain-separated dummy leaves or sparse Merkle tree architectures.
- **BN128 Scalar Field Capacity:** The BN128 scalar field prime $r = 21888242871839275222246405745257275088548364400416034343698204186575808495617 \approx 2^{253.7}$ defines the scalar field capacity (~253.7 bits). Collision resistance of the SHA-256 evidence digest before modulo reduction remains bounded by SHA-256 (128 bits against collision attacks), and the reduction modulo $r$ maps 256-bit digests into the scalar field with negligible bias.

---

## 8. Metadata Transmission Disclosure

> The registration payload includes the original filename and MIME type as unencrypted metadata for investigator reference. If filename confidentiality is required, a production deployment should transmit generic categorical labels (e.g. `evidence_item_01.dat`) or client-side encrypted metadata envelopes.

---

## 9. Cryptographic Setup Material Disclosure

> `circuits/build/pot12_final.ptau` is a **Phase 1 Powers-of-Tau artifact** (universal SRS), and `circuits/build/evidence_verifier_final.zkey` is **circuit-specific Phase 2 material**. The included trusted setup was generated locally for prototype demonstration and is not a formal multi-party production ceremony.

---

## 10. Prototype Verification Qualification

> *LexVault passed all implemented build, smart-contract, circuit, lifecycle, isolation, security-policy and presentation-preflight checks. These results validate the hackathon prototype’s implemented behaviour; they do not constitute a professional security audit or guarantee production readiness. The protection holds while local Hardhat ledger state is preserved; the MVP chain can be reset or redeployed.*
