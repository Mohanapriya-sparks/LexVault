import React from "react";

interface ShamirQuorumCounterProps {
  approvals: string[];
  onToggleApproval?: (role: string) => void;
  selectedRole?: string;
  isInternRejected?: boolean;
}

const AUTHORISED_ROLES = [
  { name: "Investigator", desc: "Share 1 holder (Ingestion)", icon: "🕵️" },
  { name: "Forensic Officer", desc: "Share 2 holder (Analysis)", icon: "🔬" },
  { name: "Court Reviewer", desc: "Share 3 holder (Adjudication)", icon: "⚖️" },
];

export const ShamirQuorumCounter: React.FC<ShamirQuorumCounterProps> = ({
  approvals,
  onToggleApproval,
  selectedRole,
  isInternRejected,
}) => {
  const count = approvals.length;
  const isQuorumReached = count >= 2;

  return (
    <div className="glass-panel rounded-2xl p-5 space-y-4 border border-purple-500/30 bg-slate-950/80 shadow-xl shadow-purple-950/20">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-800">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-purple-950 border border-purple-500/40 flex items-center justify-center text-sm shadow-inner">
            🛡️
          </div>
          <div>
            <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
              <span>Off-chain 2-of-3 Threshold Approval &amp; Shamir Key Reconstruction</span>
            </h3>
            <p className="text-[11px] text-slate-400">
              Role-governed cryptographic access control with Lagrange polynomial interpolation
            </p>
          </div>
        </div>

        {/* Quorum Progress Pill */}
        <div className="flex items-center gap-2 text-xs font-mono">
          <span className="text-slate-400 text-[11px]">Quorum Status:</span>
          <span
            className={`px-2.5 py-0.5 rounded-full font-bold border ${
              isQuorumReached
                ? "bg-emerald-950 text-emerald-300 border-emerald-700 shadow-md shadow-emerald-900/30"
                : count === 1
                ? "bg-amber-950 text-amber-300 border-amber-700"
                : "bg-slate-900 text-slate-400 border-slate-800"
            }`}
          >
            {count} / 2 Required Approvals {isQuorumReached ? "(QUORUM UNLOCKED)" : "(LOCKED)"}
          </span>
        </div>
      </div>

      {/* Authorised Approver Roles Grid */}
      <div className="space-y-1.5">
        <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider flex items-center justify-between">
          <span>Authorised Key Share Holders (3 Participants)</span>
          <span className="text-[10px] text-slate-500 font-mono">2 required to reconstruct AES key</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
          {AUTHORISED_ROLES.map((r) => {
            const hasApproved = approvals.includes(r.name);
            const isCurrentRole = selectedRole === r.name;

            return (
              <div
                key={r.name}
                className={`p-3 rounded-xl border transition-all flex flex-col justify-between ${
                  hasApproved
                    ? "bg-purple-950/40 border-purple-500/60 shadow-md shadow-purple-950/30"
                    : "bg-slate-900/60 border-slate-800/80"
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-base">{r.icon}</span>
                  <span
                    className={`text-[9px] px-2 py-0.5 rounded font-mono font-bold ${
                      hasApproved
                        ? "bg-purple-900 text-purple-200 border border-purple-700"
                        : "bg-slate-950 text-slate-500 border border-slate-800"
                    }`}
                  >
                    {hasApproved ? "APPROVED" : "PENDING"}
                  </span>
                </div>
                <div>
                  <div className="text-xs font-bold text-slate-200 flex items-center gap-1">
                    <span>{r.name}</span>
                    {isCurrentRole && (
                      <span className="text-[9px] text-cyan-400 font-normal font-mono">(You)</span>
                    )}
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5">{r.desc}</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Intern Rejection Notice if applicable */}
      {isInternRejected && (
        <div className="p-3 rounded-xl bg-rose-950/40 border border-rose-800/60 flex items-start gap-2.5 text-xs text-rose-200 animate-in fade-in duration-200">
          <span className="text-base">🚫</span>
          <div className="space-y-0.5">
            <div className="font-bold text-rose-300 uppercase tracking-wider text-[11px]">
              Access Denied — Role Policy Enforcement
            </div>
            <p className="text-[11px] text-rose-200/90 leading-relaxed">
              The <strong>Intern</strong> role has 0 Shamir key shares allocated. Access to evidence decryption and share submission is cryptographically impossible and policy-prohibited.
            </p>
          </div>
        </div>
      )}

      {/* Verification vs Decryption Distinction Box */}
      <div className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800 space-y-2 text-xs">
        <div className="text-[11px] font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
          <span>⚖️</span> Architecture Boundary: ZK Verification vs. Decryption
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 text-[11px]">
          <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800/80 space-y-1">
            <div className="font-bold text-cyan-300 flex items-center gap-1">
              <span>📐</span> Stage 5: ZK Verification
            </div>
            <ul className="text-slate-400 space-y-0.5 list-disc list-inside text-[10px]">
              <li>Uses Groth16 &amp; Deployed Solidity Verifier</li>
              <li>Read-only EVM <code className="text-cyan-200 font-mono">eth_call</code></li>
              <li>Proves case membership &amp; integrity</li>
              <li><strong>Zero confidential data revealed or decrypted</strong></li>
            </ul>
          </div>

          <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800/80 space-y-1">
            <div className="font-bold text-purple-300 flex items-center gap-1">
              <span>🔐</span> Stage 4: Authorised Decryption
            </div>
            <ul className="text-slate-400 space-y-0.5 list-disc list-inside text-[10px]">
              <li>Off-chain 2-of-3 threshold quorum layer</li>
              <li>Reconstructs AES-256-GCM symmetric key</li>
              <li>Requires 2 independent authorised role shares</li>
              <li><strong>Reveals plaintext only to authorised reviewer</strong></li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};
