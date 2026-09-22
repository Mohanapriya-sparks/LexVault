# Changelog

All notable changes to the LexVault project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [1.0.0] - 2026-09-22

### Added
- **Zero-Knowledge Circuit:** Circom 2.0 `evidence_verifier.circom` with Poseidon Merkle tree membership and commitment validation.
- **Smart Contracts:** `CustodyLedger.sol` for on-chain case anchoring and sequential custody logging; `Groth16Verifier.sol` pairing verifier.
- **Client-Side Cryptography:** Web Crypto API SHA-256 fingerprinting, BN128 scalar field reduction, and AES-256-GCM client encryption.
- **Threshold Access Control:** 2-of-3 Shamir secret sharing scheme with Lagrange interpolation over $\mathbb{F}_r$.
- **Adversarial Tamper Simulation:** Real-time 1-byte file tampering detection triggering immediate circuit assertion rejection.
- **Audit Explorer:** Privacy-preserving on-chain case explorer with zero raw hash or private MIME leakage.
- **Interactive Educational Tools:** 7-capability Feature Map modal, Searchable Plain-Language Glossary modal, and 8-step Guided Demo Tour.
- **Static Showcase Mode:** Standalone browser demonstration mode (`VITE_SHOWCASE_MODE=true`) for GitHub Pages deployment.
- **Comprehensive Test Suite:** 100% passing tests across Hardhat contracts, Circom circuit invariants, 5-stage lifecycle flow, multi-case isolation, and deterministic security policies.
