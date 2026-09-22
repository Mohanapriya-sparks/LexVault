import React from "react";

export interface FeatureItem {
  id: number;
  title: string;
  location: string;
  stageTarget: 1 | 2 | 3 | 4 | 5 | "registry";
  targetElementId: string;
  visibility: "Private (Off-Chain)" | "Public (On-Chain)" | "Cryptographic Proof";
  techStack: string;
  purpose: string;
}

export const LEXVAULT_FEATURES: FeatureItem[] = [
  {
    id: 1,
    title: "Client-Side AES-256-GCM Encryption",
    location: "Stage 1 — Evidence Ingestion",
    stageTarget: 1,
    targetElementId: "register-evidence",
    visibility: "Private (Off-Chain)",
    techStack: "Web Crypto API / AES-GCM (256-bit)",
    purpose: "Encrypts raw evidence files in-memory before transmission. Vault only stores encrypted ciphertext.",
  },
  {
    id: 2,
    title: "SHA-256 to BN128 Field Mapping",
    location: "Stage 1 — Crypto Receipt",
    stageTarget: 1,
    targetElementId: "crypto-receipt",
    visibility: "Private (Off-Chain)",
    techStack: "SHA-256 & BN128 Fr Prime Reduction",
    purpose: "Transforms the 256-bit file digest into a scalar field element compatible with Circom circuits.",
  },
  {
    id: 3,
    title: "Binary Poseidon Merkle Tree Anchor",
    location: "Stage 2 — Cryptographic Audit",
    stageTarget: 2,
    targetElementId: "merkle-anchor",
    visibility: "Public (On-Chain)",
    techStack: "Circomlib Poseidon (Depth 3)",
    purpose: "Computes a collision-resistant case root from private leaves. Only the root is submitted on-chain.",
  },
  {
    id: 4,
    title: "Immutable Custody Ledger",
    location: "Stage 3 — Custody Handoff",
    stageTarget: 3,
    targetElementId: "custody-transfer",
    visibility: "Public (On-Chain)",
    techStack: "Solidity CustodyLedger.sol / Hardhat",
    purpose: "Records every authorised transfer with sender, recipient, timestamp, and signature validation.",
  },
  {
    id: 5,
    title: "Zero-Knowledge Groth16 Membership Proof",
    location: "Stage 5 — Zero-Knowledge Verification",
    stageTarget: 5,
    targetElementId: "zk-verification",
    visibility: "Cryptographic Proof",
    techStack: "SnarkJS / Circom / Verifier.sol",
    purpose: "Proves that a private evidence leaf belongs to the case Merkle root via view-only EVM eth_call.",
  },
  {
    id: 6,
    title: "Off-Chain 2-of-3 Shamir Threshold Decryption",
    location: "Stage 4 — Shamir Access Chamber",
    stageTarget: 4,
    targetElementId: "threshold-decryption",
    visibility: "Private (Off-Chain)",
    techStack: "Lagrange Polynomial Interpolation",
    purpose: "Requires 2 authorised role signatures to reconstruct the AES decryption key. Blocks single-party exfiltration.",
  },
  {
    id: 7,
    title: "Read-Only Provenance & Audit Explorer",
    location: "Audit Explorer View",
    stageTarget: "registry",
    targetElementId: "audit-explorer",
    visibility: "Public (On-Chain)",
    techStack: "Ethers.js Contract Events / Security Log",
    purpose: "Provides live multi-case inspection, custody timeline tracking, and zero-knowledge privacy verification.",
  },
];

interface FeatureMapModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigateToFeature: (stageTarget: 1 | 2 | 3 | 4 | 5 | "registry", targetElementId: string) => void;
}

export const FeatureMapModal: React.FC<FeatureMapModalProps> = ({
  isOpen,
  onClose,
  onNavigateToFeature,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-2xl border border-indigo-500/40 bg-slate-900 shadow-2xl shadow-indigo-950/60 p-6 space-y-5 text-slate-200">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-indigo-950/80 border border-indigo-500/50 flex items-center justify-center text-lg shadow-inner">
              🗺️
            </div>
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <span>LexVault Security Architecture &amp; Feature Map</span>
              </h2>
              <p className="text-xs text-slate-400">
                Complete mapping of cryptographic primitives, on-chain contracts, and privacy boundaries
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center text-sm transition"
            title="Close Feature Map"
          >
            ✕
          </button>
        </div>

        {/* Features Table */}
        <div className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {LEXVAULT_FEATURES.map((feat) => (
              <div
                key={feat.id}
                className="p-4 rounded-xl bg-slate-950/70 border border-slate-800/90 hover:border-indigo-500/40 transition-all flex flex-col justify-between space-y-2.5"
              >
                <div className="space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold text-indigo-300 flex items-center gap-1.5">
                      <span className="w-4 h-4 rounded-full bg-indigo-950 border border-indigo-700 text-[10px] flex items-center justify-center text-indigo-200">
                        {feat.id}
                      </span>
                      {feat.title}
                    </span>
                    <span
                      className={`text-[9px] px-2 py-0.5 rounded-full font-mono font-semibold border ${
                        feat.visibility.includes("Public")
                          ? "bg-cyan-950 text-cyan-300 border-cyan-800"
                          : feat.visibility.includes("Proof")
                          ? "bg-indigo-950 text-indigo-300 border-indigo-800"
                          : "bg-purple-950 text-purple-300 border-purple-800"
                      }`}
                    >
                      {feat.visibility}
                    </span>
                  </div>
                  <div className="text-[11px] font-mono text-slate-400">
                    Tech: <span className="text-slate-300">{feat.techStack}</span>
                  </div>
                  <p className="text-[11px] text-slate-300/90 leading-relaxed">{feat.purpose}</p>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-slate-800/60 text-xs">
                  <span className="text-[10px] text-slate-500 font-mono">{feat.location}</span>
                  <button
                    onClick={() => {
                      onNavigateToFeature(feat.stageTarget, feat.targetElementId);
                      onClose();
                    }}
                    className="px-3 py-1 rounded-lg bg-indigo-950 hover:bg-indigo-900 border border-indigo-700 text-indigo-200 text-xs font-semibold transition flex items-center gap-1"
                  >
                    <span>Jump to Feature</span>
                    <span>→</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end pt-2">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-lg shadow-indigo-600/20 transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
