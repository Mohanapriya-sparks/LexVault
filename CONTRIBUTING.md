# Contributing to LexVault

Thank you for your interest in contributing to LexVault! We welcome issues, pull requests, and security improvements.

---

## 1. Development Guidelines

1. **Fork and Branch:** Create a topic branch from `main` (e.g. `feat/zk-optimizations` or `fix/merkle-indexing`).
2. **Local Verification:** Before submitting a pull request, run all automated test suites:
   ```bash
   npm run test:contracts
   npm run test:circuit
   npm run build --prefix frontend
   ```
3. **Cryptographic Integrity:** Do not weaken zero-knowledge circuit assertions, Shamir threshold policies, or secret masking boundaries.
4. **No Secrets in Commits:** Ensure `.env`, private keys, and raw evidence files are strictly excluded.

---

## 2. Code Style

- **Frontend:** TypeScript + React with Tailwind CSS v4 / Vanilla CSS tokens.
- **Backend:** TypeScript + Node.js Express.
- **Smart Contracts:** Solidity `^0.8.24` formatted with standard Hardhat conventions.
- **Circuits:** Circom 2.0 with explicit template declarations and constraints.

---

## 3. Pull Request Process

1. Provide a concise summary of changes and rationale in your PR description.
2. Ensure GitHub Actions CI passes completely.
3. Request review from repository maintainers.
