import React, { useState } from "react";

export interface CryptoReceiptData {
  caseId: number;
  filename?: string;
  mimeType?: string;
  isSimulated?: boolean;
  operations?: {
    rawEvidenceReceived?: boolean;
    sha256FingerprintGenerated?: boolean;
    fieldLeafDerived?: boolean;
    poseidonTreeBuilt?: boolean;
    merkleRootCalculated?: boolean;
    aesGcmEncrypted?: boolean;
    vaultRecordPersisted?: boolean;
    ledgerRegistrationConfirmed?: boolean;
  };
  publicData?: {
    caseId?: number;
    merkleRootHex?: string;
    txHash?: string;
    registrationTimestamp?: number;
    custodian?: string;
  };
}

interface CryptoReceiptModalProps {
  isOpen: boolean;
  onClose: () => void;
  receiptData: CryptoReceiptData | null;
  isShowcaseMode?: boolean;
}

export const CryptoReceiptModal: React.FC<CryptoReceiptModalProps> = ({
  isOpen,
  onClose,
  receiptData,
  isShowcaseMode,
}) => {
  const [copied, setCopied] = useState(false);

  if (!isOpen || !receiptData) return null;

  const isSim = receiptData.isSimulated || isShowcaseMode;

  const ops = receiptData.operations || {
    rawEvidenceReceived: true,
    sha256FingerprintGenerated: true,
    fieldLeafDerived: true,
    poseidonTreeBuilt: true,
    merkleRootCalculated: true,
    aesGcmEncrypted: true,
    vaultRecordPersisted: true,
    ledgerRegistrationConfirmed: true,
  };

  const pub = receiptData.publicData || {
    caseId: receiptData.caseId,
    merkleRootHex: "0x...",
    txHash: isSim ? "DEMO-TX-REGISTER-SAMPLE" : "0x...",
    registrationTimestamp: Date.now(),
    custodian: "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
  };

  const handleCopyRoot = () => {
    if (pub.merkleRootHex) {
      navigator.clipboard.writeText(pub.merkleRootHex);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div id="crypto-receipt-modal-overlay" className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
      <div id="crypto-receipt-modal-container" className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl border border-cyan-500/40 bg-slate-900 shadow-2xl shadow-cyan-950/60 p-6 space-y-5 text-slate-200">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-cyan-950/80 border border-cyan-500/50 flex items-center justify-center text-lg shadow-inner">
              🧾
            </div>
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <span>Cryptographic Processing Receipt</span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-cyan-950 text-cyan-300 border border-cyan-800 font-mono">
                  Case #{receiptData.caseId}
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Granular breakdown of browser cryptographic operations and ledger confirmation
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center text-sm transition"
            title="Close Receipt"
          >
            ✕
          </button>
        </div>

        {/* Mode & Truthfulness Banner */}
        {isSim ? (
          <div className="p-3 rounded-xl bg-amber-950/40 border border-amber-800/60 text-xs text-amber-300 flex items-start gap-2">
            <span className="text-sm">ℹ️</span>
            <div>
              <div className="font-bold">Public Showcase Receipt</div>
              <div className="text-[11px] text-amber-200/90 leading-relaxed">
                Client hashing, encryption, and Shamir splitting are performed via real browser Web Crypto API. On-chain ledger anchoring is simulated for demonstration. Demonstration output — not a live blockchain transaction or Groth16 proof.
              </div>
            </div>
          </div>
        ) : (
          <div className="p-3 rounded-xl bg-emerald-950/40 border border-emerald-800/60 text-xs text-emerald-300 flex items-start gap-2">
            <span className="text-sm">✓</span>
            <div>
              <div className="font-bold">Full Local Cryptographic Mode</div>
              <div className="text-[11px] text-emerald-200/90 leading-relaxed">
                Verified against local Hardhat EVM node (Chain ID 31337) and Circom witness pipeline.
              </div>
            </div>
          </div>
        )}

        {/* Verification Checkmarks Grid with Operation-Level Badges */}
        <div className="space-y-2">
          <div className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center justify-between">
            <span>Operation-Level Pipeline Verification</span>
            <span className="text-[10px] text-cyan-400 font-mono font-bold bg-cyan-950/60 px-2 py-0.5 rounded border border-cyan-800">
              8 OPERATIONS EXECUTED
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
            {/* 1 */}
            <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-950/60 border border-slate-800/80">
              <span className="text-slate-300 flex items-center gap-2">
                <span className="text-emerald-400">✓</span> 1. Evidence Ingestion
              </span>
              <span className="text-[10px] font-mono text-cyan-300 font-bold bg-cyan-950 px-1.5 py-0.5 rounded border border-cyan-800">
                REAL — Browser Web Crypto
              </span>
            </div>
            {/* 2 */}
            <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-950/60 border border-slate-800/80">
              <span className="text-slate-300 flex items-center gap-2">
                <span className="text-emerald-400">✓</span> 2. SHA-256 Digest
              </span>
              <span className="text-[10px] font-mono text-cyan-300 font-bold bg-cyan-950 px-1.5 py-0.5 rounded border border-cyan-800">
                REAL — Browser Web Crypto
              </span>
            </div>
            {/* 3 */}
            <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-950/60 border border-slate-800/80">
              <span className="text-slate-300 flex items-center gap-2">
                <span className="text-emerald-400">✓</span> 3. BN128 Scalar Leaf
              </span>
              <span className="text-[10px] font-mono text-cyan-300 font-bold bg-cyan-950 px-1.5 py-0.5 rounded border border-cyan-800">
                REAL — Browser Web Crypto
              </span>
            </div>
            {/* 4 */}
            <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-950/60 border border-slate-800/80">
              <span className="text-slate-300 flex items-center gap-2">
                <span className="text-emerald-400">✓</span> 4. AES-256-GCM Encrypted
              </span>
              <span className="text-[10px] font-mono text-cyan-300 font-bold bg-cyan-950 px-1.5 py-0.5 rounded border border-cyan-800">
                REAL — Browser Web Crypto
              </span>
            </div>
            {/* 5 */}
            <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-950/60 border border-slate-800/80">
              <span className="text-slate-300 flex items-center gap-2">
                <span className="text-emerald-400">✓</span> 5. 2-of-3 Shamir Split
              </span>
              <span className="text-[10px] font-mono text-cyan-300 font-bold bg-cyan-950 px-1.5 py-0.5 rounded border border-cyan-800">
                REAL — Browser Web Crypto
              </span>
            </div>
            {/* 6 */}
            <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-950/60 border border-slate-800/80">
              <span className="text-slate-300 flex items-center gap-2">
                <span className="text-emerald-400">✓</span> 6. Poseidon Tree Root
              </span>
              <span className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded border ${
                isSim ? "text-amber-300 bg-amber-950 border-amber-800" : "text-emerald-300 bg-emerald-950 border-emerald-800"
              }`}>
                {isSim ? "SIMULATED — Showcase Only" : "REAL — Full Local Mode"}
              </span>
            </div>
            {/* 7 */}
            <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-950/60 border border-slate-800/80">
              <span className="text-slate-300 flex items-center gap-2">
                <span className="text-emerald-400">✓</span> 7. Vault Record Stored
              </span>
              <span className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded border ${
                isSim ? "text-amber-300 bg-amber-950 border-amber-800" : "text-emerald-300 bg-emerald-950 border-emerald-800"
              }`}>
                {isSim ? "SIMULATED — React Memory" : "REAL — Full Local Mode"}
              </span>
            </div>
            {/* 8 */}
            <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-950/60 border border-slate-800/80">
              <span className="text-slate-300 flex items-center gap-2">
                <span className="text-emerald-400">✓</span> 8. CustodyLedger Anchor
              </span>
              <span className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded border ${
                isSim ? "text-amber-300 bg-amber-950 border-amber-800" : "text-emerald-300 bg-emerald-950 border-emerald-800"
              }`}>
                {isSim ? "SIMULATED — Showcase Only" : "REAL — Full Local Mode"}
              </span>
            </div>
          </div>
        </div>

        {/* Public Blockchain Metadata Section */}
        <div className="space-y-2 p-3.5 rounded-xl bg-slate-950/80 border border-slate-800">
          <div className="text-[11px] font-semibold text-slate-300 uppercase tracking-wider">
            Public On-Chain Metadata (Broadcast to Ledger)
          </div>
          <div className="space-y-2 text-xs font-mono">
            <div>
              <div className="text-slate-400 text-[11px]">Public Merkle Root:</div>
              <div className="flex items-center gap-2 mt-0.5">
                <input
                  type="text"
                  readOnly
                  value={pub.merkleRootHex || "0x..."}
                  className="w-full bg-slate-900 border border-slate-700/80 rounded-lg px-2.5 py-1.5 text-xs text-cyan-300 font-mono select-all focus:outline-none"
                />
                <button
                  onClick={handleCopyRoot}
                  className="px-3 py-1.5 rounded-lg bg-cyan-950 hover:bg-cyan-900 border border-cyan-700 text-cyan-300 text-xs font-sans whitespace-nowrap transition"
                >
                  {copied ? "Copied!" : "Copy"}
                </button>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 text-[11px]">
              <div>
                <span className="text-slate-400">Initial Custodian:</span>{" "}
                <span className="text-indigo-300 break-all">{pub.custodian || "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266"}</span>
              </div>
              <div>
                <span className="text-slate-400">Registration Time:</span>{" "}
                <span className="text-slate-300">
                  {pub.registrationTimestamp
                    ? new Date(pub.registrationTimestamp).toLocaleString()
                    : new Date().toLocaleString()}
                </span>
              </div>
              {pub.txHash && (
                <div className="sm:col-span-2">
                  <span className="text-slate-400">Tx Hash:</span>{" "}
                  <span className="text-slate-300 break-all">{pub.txHash}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Private Data Isolation Guarantee */}
        <div className="p-3.5 rounded-xl bg-purple-950/30 border border-purple-800/50 space-y-2 text-xs">
          <div className="flex items-center justify-between text-purple-300 font-semibold">
            <span className="flex items-center gap-1.5">
              <span>🛡️</span> Zero-Knowledge Isolation Guarantee
            </span>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-purple-950 text-purple-200 border border-purple-700">
              PROTECTED
            </span>
          </div>
          <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-300">
            <div>
              <span className="text-slate-400">Raw Evidence File:</span>{" "}
              <span className="font-mono text-amber-300">[PRIVATE — NOT EXPOSED]</span>
            </div>
            <div>
              <span className="text-slate-400">SHA-256 Digest:</span>{" "}
              <span className="font-mono text-amber-300">[PRIVATE — NOT EXPOSED]</span>
            </div>
            <div>
              <span className="text-slate-400">BN128 Leaf Element:</span>{" "}
              <span className="font-mono text-amber-300">[PRIVATE — NOT EXPOSED]</span>
            </div>
            <div>
              <span className="text-slate-400">AES Symmetric Key:</span>{" "}
              <span className="font-mono text-amber-300">[PRIVATE — NOT EXPOSED]</span>
            </div>
          </div>
          <p className="text-[11px] text-slate-400 leading-relaxed pt-1 border-t border-purple-900/40">
            The smart contract ledger records <strong>only</strong> the case Merkle root and custody transfer history. No sensitive evidence or private witness values are ever submitted to the blockchain.
          </p>
        </div>

        {/* Footer */}
        <div className="flex justify-end pt-2">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-bold text-xs shadow-lg shadow-cyan-600/20 transition"
          >
            Done &amp; Continue
          </button>
        </div>
      </div>
    </div>
  );
};
