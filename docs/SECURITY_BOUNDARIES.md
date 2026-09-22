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
3. **On-Chain Custody Auditability:** Proves the sequential history of authorized custodian handoffs recorded in the `CustodyLedger.sol` smart contract on Ethereum.
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

- **ZK Verification Execution:** Verification is evaluated via a read-only EVM `eth_call` against `Verifier.sol`.
- **Zero State Modification:** `eth_call` does not submit a transaction, consumes no gas fees, and alters no storage variables.
- **Privacy Preservation:** Public nodes observe only the query and public Merkle root; raw evidence and private witness signals remain on the client/prover environment.

---

## 4. Shamir Secret Sharing Limitation

> [!WARNING]
> **Prototype Key Distribution Disclosure**
> The prototype demonstrates 2-of-3 approval and Shamir-based key reconstruction. If all shares are accessible to the same backend process or storage environment, compromise of that environment could permit key reconstruction. A production deployment should distribute shares among independent custodians, devices or approval services.

---

## 5. Prototype Verification Qualification

> *LexVault passed all implemented build, smart-contract, circuit, lifecycle, isolation, security-policy and presentation-preflight checks. These results validate the hackathon prototype’s implemented behaviour; they do not constitute a professional security audit or guarantee production readiness.*
