# Security Policy

## 1. Supported Versions

| Version | Supported | Description |
| :--- | :---: | :--- |
| `1.0.x` | :white_check_mark: | Presentation-grade, security-conscious hackathon prototype |

---

## 2. Reporting a Vulnerability

We take cryptographic and smart-contract security seriously. If you discover a security vulnerability or cryptographic flaw in LexVault:

1. **Do not open a public GitHub issue.**
2. Please reach out via confidential GitHub Security Advisory or email repository maintainers.
3. Include details of the vulnerability, reproduction steps, and affected components (e.g., Circom circuit, smart contracts, Shamir reconstruction).
4. We will acknowledge receipt within 48 hours and coordinate remediations.

---

## 3. Cryptographic Security & ZKP Limitations

> [!WARNING]
> **ZKP Circuit Verification Invariant**
> *The Groth16 circuit proves knowledge of a leaf and Merkle path matching the registered root. By itself, it does not prove possession of the current raw evidence file or that the file was truthful when registered. Tamper detection depends on the application correctly recomputing the fingerprint from the reviewed file and comparing it through the verification workflow.*

---

## 4. Shamir Secret Sharing Security Limitation

> [!WARNING]
> **Prototype Key Distribution Disclosure**
> *The prototype demonstrates 2-of-3 approval and Shamir-based key reconstruction. If all shares are accessible to the same backend process or storage environment, compromise of that environment could permit key reconstruction. A production deployment should distribute shares among independent custodians, devices or approval services.*

---

## 5. Metadata Transmission Disclosure

> The registration payload includes the original filename and MIME type as unencrypted metadata for investigator reference. If filename confidentiality is required, a production deployment should transmit generic categorical labels (e.g. `evidence_item_01.dat`) or client-side encrypted metadata envelopes.

---

## 6. Prototype Verification & Scope Disclaimer

LexVault passed all implemented build, smart-contract, circuit, lifecycle, isolation, security-policy and presentation-preflight checks. These results validate the hackathon prototype’s implemented behaviour; they do not constitute a professional security audit or guarantee production readiness.
