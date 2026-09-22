import React, { useState } from "react";

export const SecurityBoundariesBox: React.FC = () => {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className="glass-panel rounded-2xl p-5 space-y-3.5 border border-slate-800/90 bg-slate-950/70 shadow-lg shadow-slate-950/40">
      {/* Prominent Core Explanation */}
      <div className="p-4 rounded-xl bg-gradient-to-r from-cyan-950/40 via-indigo-950/30 to-purple-950/40 border border-cyan-500/30 space-y-2">
        <div className="flex items-center gap-2">
          <span className="text-base">🛡️</span>
          <span className="text-xs font-bold text-cyan-300 uppercase tracking-wider">
            LexVault Core Mission &amp; Purpose
          </span>
        </div>
        <p className="text-xs text-slate-200 font-medium leading-relaxed">
          LexVault fingerprints and encrypts digital evidence, records its case commitment and custody history on a tamper-evident ledger, and uses a Zero-Knowledge Proof to verify registered evidence without revealing the confidential file.
        </p>
      </div>

      {/* Security Boundary Notice */}
      <div className="p-3.5 rounded-xl bg-amber-950/30 border border-amber-800/50 space-y-2 text-xs">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-amber-300 font-bold">
            <span>⚠️</span>
            <span>Cryptographic Security Boundary</span>
          </div>
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="text-[11px] text-amber-300 hover:text-amber-200 underline font-mono transition"
          >
            {isExpanded ? "Collapse Details ▲" : "Inspect Boundary Details ▼"}
          </button>
        </div>
        <p className="text-amber-200/90 leading-relaxed text-[11px]">
          LexVault proves post-registration integrity and membership. It does not prove that the original evidence was truthful or guarantee courtroom admissibility.
        </p>

        {isExpanded && (
          <div className="pt-2 border-t border-amber-900/40 grid grid-cols-1 sm:grid-cols-2 gap-3 text-[11px] animate-in fade-in duration-200">
            <div className="p-2.5 rounded-lg bg-slate-950/80 border border-slate-800 space-y-1">
              <div className="font-bold text-emerald-400 flex items-center gap-1">
                <span>✓</span> What LexVault Proves
              </div>
              <ul className="text-slate-300 space-y-1 list-disc list-inside text-[10px]">
                <li>Post-registration integrity (1-byte tamper breaks proof)</li>
                <li>Case tree membership without revealing file content</li>
                <li>Sequential custody transfer history on EVM ledger</li>
                <li>2-of-3 threshold authorisation before AES decryption</li>
              </ul>
            </div>

            <div className="p-2.5 rounded-lg bg-slate-950/80 border border-slate-800 space-y-1">
              <div className="font-bold text-rose-400 flex items-center gap-1">
                <span>✕</span> What LexVault Does Not Prove
              </div>
              <ul className="text-slate-300 space-y-1 list-disc list-inside text-[10px]">
                <li>Whether the file was authentic/truthful prior to upload</li>
                <li>Physical provenance before digital registration</li>
                <li>Automatic legal admissibility in specific jurisdictions</li>
                <li>Legality of investigative procedures used</li>
              </ul>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
