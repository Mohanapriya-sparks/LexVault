# LexVault — Cryptographic Security Boundaries & Trust Disclosures

This document clearly establishes what LexVault proves, what it does not prove, and the architectural assumptions underpinning its verification guarantees.

---

## 1. What LexVault Cryptographically Proves

1. **Post-Registration Integrity:** Proves that an evidence item presented for verification has the exact SHA-256 digest and scalar field element mapped during registration. Even a 1-bit alteration causes circuit constraint failure.
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
3. **Automated Courtroom Admissibility:** Admissibility is a jurisdiction-specific legal ruling governed by applicable rules of evidence (e.g. Federal Rules of Evidence 901/902 in the US, Section 65B of the Indian Evidence Act / BSA). LexVault provides cryptographic audit support; it does not replace legal certification.
4. **Endpoint Security:** LexVault does not protect against malware or keyloggers compromising the custodian's local device prior to or during evidence viewing.

---

## 3. Blockchain Execution Semantics

- **ZK Verification Execution:** Verification is evaluated via a read-only EVM `eth_call` against `Groth16Verifier.sol`.
- **Zero State Modification:** `eth_call` does not submit a transaction, consumes no gas fees, and alters no storage variables.
- **Privacy Preservation:** Public nodes observe only the query and public Merkle root; private witness signals remain on the client/prover environment.
