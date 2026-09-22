# LexVault — Guided Evaluator & Presentation Demo Guide

This guide provides a step-by-step walkthrough for evaluating LexVault during demonstrations, hackathon presentations, and code reviews.

---

## 1. Quick Verification Track (60 Seconds)

### Step 1: Ingest & Inspect Cryptographic Receipt
1. Open the UI at `http://localhost:3000` (or the live Showcase).
2. Select **Case #101** (or click a sample template: Ballistics Report / CCTV Feed).
3. Click **View Crypto Receipt** to inspect the 8 verified operations and the on-chain Merkle root.
4. Confirm private preimages, keys, and shares are masked as `[HIDDEN / LOCAL ONLY]`.

### Step 2: Test 2-of-3 Shamir Threshold Decryption (Stage 4)
1. In Stage 4, select the **🚫 Unauthorized (Intern)** role clearance.
2. Click **Reconstruct Key & Decrypt** $\rightarrow$ Notice immediate **403 Access Denied** policy rejection.
3. Switch clearance to **🏛️ Authorized (Court)** and select **Investigator** + **Forensic Officer** shares.
4. Click **Reconstruct Key & Decrypt** $\rightarrow$ Key is reconstructed via Lagrange interpolation and the confidential forensic report is revealed.

### Step 3: Zero-Knowledge Verification (Stage 5)
1. **Scenario A (Intact Evidence):** Click **Verify Original Evidence (Scenario A)**.
   - Prover runs Groth16 witness computation (measures live execution latency in ms).
   - Solidity Verifier evaluates proof via read-only EVM `eth_call`.
   - Result: `✅ Deployed Solidity Verifier Result: VALID`.
2. **Scenario B (1-Byte Adversarial Tamper Attack):** Click **Simulate 1-Byte Tampering (Scenario B)**.
   - Injects a 1-byte alteration into the evidence buffer.
   - Circom constraint `leaf === originalCommitment` fails immediately.
   - Result: `❌ Proof Generation & Verification REJECTED`.

---

## 2. Global Case Registry & Audit Explorer

1. Switch to the **Case Registry & Audit Explorer** tab.
2. Observe all registered cases, on-chain Merkle roots, and custody handoff counters.
3. Verify that zero private evidence filenames, MIME types, or encryption keys are displayed in the public audit log.

---

## 3. Built-In Educational Modals

- **Feature Map (`🗺️ Feature Map`):** Displays all 7 cryptographic capabilities, UI locations, and visibility scopes.
- **Glossary (`📖 Glossary`):** Searchable definitions and analogies for zero-knowledge proofs, Poseidon hash, Shamir secret sharing, and EVM `eth_call`.
- **Guided Demo Tour (`🧭 Guided Tour`):** Automated 8-step spotlight walkthrough navigating through key interface components.
