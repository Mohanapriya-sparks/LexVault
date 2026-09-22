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

## 3. Shamir Secret Sharing Security Limitation

> [!WARNING]
> **Prototype Key Distribution Disclosure**
> The prototype demonstrates 2-of-3 approval and Shamir-based key reconstruction. If all shares are accessible to the same backend process or storage environment, compromise of that environment could permit key reconstruction. A production deployment should distribute shares among independent custodians, devices or approval services.

---

## 4. Prototype Verification & Scope Disclaimer

LexVault passed all implemented build, smart-contract, circuit, lifecycle, isolation, security-policy and presentation-preflight checks. These results validate the hackathon prototype’s implemented behaviour; they do not constitute a professional security audit or guarantee production readiness.
