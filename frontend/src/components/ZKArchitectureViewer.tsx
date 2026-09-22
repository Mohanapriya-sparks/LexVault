import React, { useState } from "react";

interface ZKArchitectureViewerProps {
  generationTimeMs?: number | null;
  isValid?: boolean;
  onChainVerified?: boolean;
  merkleRootUsed?: string;
  isTamperTest?: boolean;
}

export const ZKArchitectureViewer: React.FC<ZKArchitectureViewerProps> = ({
  generationTimeMs,
  isValid,
  onChainVerified,
  merkleRootUsed,
  isTamperTest,
}) => {
  const [showCircuitDetails, setShowCircuitDetails] = useState(false);

  const displayTiming =
    generationTimeMs !== undefined && generationTimeMs !== null && generationTimeMs > 0
      ? `${generationTimeMs} ms`
      : "Timing unavailable for this run.";

  return (
    <div className="glass-panel rounded-2xl p-5 space-y-4 border border-indigo-500/30 bg-slate-950/80 shadow-xl shadow-indigo-950/20">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-800">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-indigo-950 border border-indigo-500/40 flex items-center justify-center text-sm shadow-inner">
            📐
          </div>
          <div>
            <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
              <span>Circom &amp; Groth16 ZK-SNARK Architecture</span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-950 text-indigo-300 border border-indigo-800 font-mono normal-case">
                BN128 / SnarkJS / Verifier.sol
              </span>
            </h3>
            <p className="text-[11px] text-slate-400">
              Zero-Knowledge membership and integrity proof without confidential data exposure
            </p>
          </div>
        </div>

        {/* Live Execution Timing (strictly dynamic) */}
        <div className="flex items-center gap-2 text-xs font-mono">
          <span className="text-slate-400 text-[11px]">Prover Wall Time:</span>
          <span className="px-2 py-0.5 rounded bg-slate-900 border border-indigo-500/30 text-cyan-300 font-bold">
            {displayTiming}
          </span>
        </div>
      </div>

      {/* 5-Step Cryptographic Flow */}
      <div className="space-y-1.5">
        <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
          Evidence Ingestion to Groth16 Verification Flow
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2 text-[11px]">
          <div className="p-2.5 rounded-xl bg-slate-900/90 border border-slate-800 flex flex-col justify-between space-y-1">
            <span className="text-[10px] font-mono text-slate-500">Step 1 (Pre-Circuit)</span>
            <span className="font-bold text-slate-200">Raw File</span>
            <span className="text-[10px] text-slate-400 leading-tight">Processed locally; never sent to circuit</span>
          </div>

          <div className="p-2.5 rounded-xl bg-slate-900/90 border border-slate-800 flex flex-col justify-between space-y-1">
            <span className="text-[10px] font-mono text-slate-500">Step 2 (Hashing)</span>
            <span className="font-bold text-slate-200">SHA-256 Digest</span>
            <span className="text-[10px] text-slate-400 leading-tight">256-bit cryptographic fingerprint</span>
          </div>

          <div className="p-2.5 rounded-xl bg-slate-900/90 border border-slate-800 flex flex-col justify-between space-y-1">
            <span className="text-[10px] font-mono text-slate-500">Step 3 (Field Map)</span>
            <span className="font-bold text-slate-200">BN128 Field Element</span>
            <span className="text-[10px] text-slate-400 leading-tight">Reduced modulo Fr prime</span>
          </div>

          <div className="p-2.5 rounded-xl bg-slate-900/90 border border-slate-800 flex flex-col justify-between space-y-1">
            <span className="text-[10px] font-mono text-slate-500">Step 4 (Commitment)</span>
            <span className="font-bold text-slate-200">Private Leaf</span>
            <span className="text-[10px] text-slate-400 leading-tight">Private Merkle leaf derived from SHA-256</span>
          </div>

          <div className="p-2.5 rounded-xl bg-slate-900/90 border border-slate-800 flex flex-col justify-between space-y-1">
            <span className="text-[10px] font-mono text-slate-500">Step 5 (Circom Witness)</span>
            <span className="font-bold text-slate-200">Merkle Path</span>
            <span className="text-[10px] text-slate-400 leading-tight">Private siblings &amp; path indices</span>
          </div>

          <div className="p-2.5 rounded-xl bg-indigo-950/40 border border-indigo-500/40 flex flex-col justify-between space-y-1">
            <span className="text-[10px] font-mono text-indigo-400 font-bold">Step 6 (SNARK Proof)</span>
            <span className="font-bold text-indigo-200">Groth16 Proof</span>
            <span className="text-[10px] text-indigo-300 leading-tight">Submitted with public merkleRoot</span>
          </div>
        </div>
      </div>

      {/* Two-Column Layout: Private Inputs vs Public Input */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
        {/* Private Inputs Column */}
        <div className="p-3.5 rounded-xl bg-purple-950/20 border border-purple-800/40 space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-purple-300 flex items-center gap-1.5">
              <span>🔒</span> Circom Circuit Private Inputs (4 Signals)
            </span>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-purple-950 text-purple-200 border border-purple-700">
              NEVER EXPOSED
            </span>
          </div>
          <ul className="space-y-1.5 text-xs">
            <li className="p-2 rounded-lg bg-slate-950/70 border border-purple-900/30 flex items-start justify-between">
              <div>
                <code className="text-purple-300 font-bold font-mono">signal input leaf;</code>
                <div className="text-[10px] text-slate-400">Private Merkle leaf derived from the SHA-256 field element</div>
              </div>
              <span className="text-[10px] font-mono text-slate-500">Private</span>
            </li>
            <li className="p-2 rounded-lg bg-slate-950/70 border border-purple-900/30 flex items-start justify-between">
              <div>
                <code className="text-purple-300 font-bold font-mono">signal input originalCommitment;</code>
                <div className="text-[10px] text-slate-400">Commitment registered at evidence ingestion</div>
              </div>
              <span className="text-[10px] font-mono text-slate-500">Private</span>
            </li>
            <li className="p-2 rounded-lg bg-slate-950/70 border border-purple-900/30 flex items-start justify-between">
              <div>
                <code className="text-purple-300 font-bold font-mono">signal input merklePath[3];</code>
                <div className="text-[10px] text-slate-400">Internal Poseidon sibling hashes from leaf to root</div>
              </div>
              <span className="text-[10px] font-mono text-slate-500">Private</span>
            </li>
            <li className="p-2 rounded-lg bg-slate-950/70 border border-purple-900/30 flex items-start justify-between">
              <div>
                <code className="text-purple-300 font-bold font-mono">signal input pathIndices[3];</code>
                <div className="text-[10px] text-slate-400">Left/Right binary selector bits in binary tree</div>
              </div>
              <span className="text-[10px] font-mono text-slate-500">Private</span>
            </li>
          </ul>
          <p className="text-[10px] text-slate-400 italic">
            * Note: The raw evidence file is processed before witness construction and is not passed directly into the Circom circuit.
          </p>
        </div>

        {/* Public Input & Verification Method Column */}
        <div className="p-3.5 rounded-xl bg-cyan-950/20 border border-cyan-800/40 space-y-2.5 flex flex-col justify-between">
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-cyan-300 flex items-center gap-1.5">
                <span>🌐</span> Public Circuit Input (1 Signal)
              </span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-cyan-950 text-cyan-200 border border-cyan-700">
                PUBLIC ON-CHAIN
              </span>
            </div>
            <div className="p-2 rounded-lg bg-slate-950/70 border border-cyan-900/30">
              <code className="text-cyan-300 font-bold font-mono text-xs">signal input merkleRoot;</code>
              <div className="text-[10px] text-slate-400 mt-0.5">
                The public Merkle root committed to <code className="text-cyan-200">CustodyLedger.sol</code> during Case Registration
              </div>
              {merkleRootUsed && (
                <div className="mt-1.5 text-[10px] font-mono text-slate-400 truncate bg-slate-900/90 p-1 rounded border border-slate-800">
                  <span className="text-slate-500">Active Root:</span> {merkleRootUsed}
                </div>
              )}
            </div>

            {/* EVM Execution Mode */}
            <div className="p-2.5 rounded-lg bg-slate-950/80 border border-slate-800 space-y-1 text-xs">
              <div className="text-[11px] font-semibold text-slate-300 flex items-center gap-1.5">
                <span>⚙️</span> Execution Method: EVM eth_call
              </div>
              <p className="text-[10px] text-slate-400 leading-relaxed">
                Verification invokes <code className="text-cyan-300">verifyEvidence()</code> on the deployed Solidity Verifier via a <strong>Read-only EVM eth_call: no transaction submitted, no blockchain state changed and no gas fee paid.</strong>
              </p>
            </div>
          </div>

          <div className="pt-2 border-t border-slate-800/60 flex items-center justify-between text-xs">
            <button
              onClick={() => setShowCircuitDetails(!showCircuitDetails)}
              className="text-[11px] text-indigo-300 hover:text-indigo-200 underline flex items-center gap-1 transition"
            >
              <span>{showCircuitDetails ? "Hide" : "Show"} Circuit Constraints</span>
              <span>{showCircuitDetails ? "▲" : "▼"}</span>
            </button>

            <span className="text-[10px] font-mono text-slate-400">
              Status:{" "}
              {isValid === true ? (
                <span className="text-emerald-400 font-bold">SOL_VERIFIED_VALID</span>
              ) : isValid === false ? (
                <span className="text-rose-400 font-bold">CIRCUIT_REJECTED</span>
              ) : (
                <span className="text-slate-500">IDLE</span>
              )}
            </span>
          </div>
        </div>
      </div>

      {/* Expandable Technical Details */}
      {showCircuitDetails && (
        <div className="p-3.5 rounded-xl bg-slate-950/90 border border-slate-800 space-y-2 text-xs font-mono text-slate-300 animate-in fade-in duration-200">
          <div className="text-[11px] font-sans font-bold text-slate-200 flex items-center justify-between">
            <span>Circom Constraint Summary (evidence_verifier.circom)</span>
            <span className="text-[10px] text-slate-500">Depth 3 Binary Tree (8 Leaves)</span>
          </div>
          <pre className="p-2.5 rounded-lg bg-slate-900 border border-slate-800/80 text-[11px] text-indigo-300 overflow-x-auto leading-relaxed">
{`// 1. Evidence integrity assertion
leaf === originalCommitment;

// 2. Binary Poseidon Merkle inclusion path
for (var i = 0; i < DEPTH; i++) {
    pathIndices[i] * (pathIndices[i] - 1) === 0; // Boolean selector constraint
    switcher[i].sel <== pathIndices[i];
    poseidon[i].inputs[0] <== switcher[i].outL;
    poseidon[i].inputs[1] <== switcher[i].outR;
    currentHash[i + 1] <== poseidon[i].out;
}

// 3. Merkle root equivalence
currentHash[DEPTH] === merkleRoot;`}
          </pre>
          <div className="text-[10px] text-slate-400 font-sans leading-relaxed">
            * Poseidon is used for internal binary Merkle tree node hashing. The leaf is derived from the SHA-256 digest reduced into the BN128 scalar field.
          </div>
        </div>
      )}
    </div>
  );
};
