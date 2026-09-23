# Security Policy

## 1. Supported Versions

| Version | Supported | Description |
| :--- | :---: | :--- |
| `1.0.x` | :white_check_mark: | Presentation-grade, security-conscious hackathon prototype |

---

## 2. Reporting a Vulnerability

We take cryptographic and smart-contract security seriously. If you discover a security vulnerability or cryptographic flaw in LexVault:

1. **Do not open a public GitHub issue.**
2. Please submit a report through **GitHub Private Vulnerability Reporting** (`Security` tab → `Report a vulnerability`).
3. Include details of the vulnerability, reproduction steps, and affected components (e.g., Circom circuit, smart contracts, Shamir reconstruction).
4. Repository maintainers provide best-effort review and acknowledgement of responsibly disclosed reports.

---

## 3. Cryptographic Security & ZKP Limitations

> [!WARNING]
> **ZKP Circuit Verification Invariant**
> *The Groth16 circuit proves knowledge of a leaf and Merkle path matching the registered root. By itself, it does not prove possession of the current raw evidence file or that the file was truthful when registered. Tamper detection depends on the application correctly recomputing the fingerprint from the reviewed file and comparing it through the verification workflow.*

---

## 4. Backend Compromise & Trusted Environment Boundary

> [!IMPORTANT]
> **Backend & Storage Compromise Disclosure**
> *A compromised prototype backend or its storage could expose: ciphertext, IV, AES-GCM authentication tag, evidence leaf / original commitment, Merkle witness material available to the prover, colocated Shamir shares, and metadata such as filename and MIME type.*
> 
> *Zero-Knowledge proofs protect private witness values from public proof verification; they do not protect them from compromise of the trusted prover or backend host environment.*

---

## 5. Shamir Secret Sharing Security Limitation

> [!WARNING]
> **Prototype Key Distribution Disclosure**
> *The prototype demonstrates 2-of-3 approval and Shamir-based key reconstruction. If all shares are accessible to the same backend process or storage environment, compromise of that environment could permit key reconstruction. A production deployment should distribute shares among independent custodians, devices or approval services.*

---

## 6. Unsalted Leaf Commitments & Entropy Considerations

- **Unsalted Leaf Mapping:** The prototype maps SHA-256 digests into the BN128 scalar field as $L = \text{SHA-256}(\text{data}) \pmod r$ without a per-item secret salt. If candidate evidence files have low entropy or are drawn from a small known set, an adversary observing the leaf value could test candidate files. Future production iterations should employ a salted commitment scheme such as $\text{Poseidon}(\text{domain\_sep}, \text{hash}, \text{salt})$.
- **Deterministic Padding Leaves:** Case Merkle trees pad unused leaf slots with deterministic zeros (`0`). Future designs should use domain-separated dummy leaves or sparse Merkle tree architectures.
- **AES Key Entropy:** The ephemeral AES symmetric key is derived from a scalar in $\mathbb{F}_r$ ($r \approx 2^{253.7}$), providing approximately 253.7 bits of effective entropy for AES-256.

---

## 7. Metadata Transmission Disclosure

> The registration payload includes the original filename and MIME type as unencrypted metadata for investigator reference. If filename confidentiality is required, a production deployment should transmit generic categorical labels (e.g. `evidence_item_01.dat`) or client-side encrypted metadata envelopes.

---

## 8. Prototype Verification & Scope Disclaimer

LexVault passed all implemented build, smart-contract, circuit, lifecycle, isolation, security-policy and presentation-preflight checks. These results validate the hackathon prototype’s implemented behaviour; they do not constitute a professional security audit or guarantee production readiness.
