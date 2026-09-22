import React from "react";

export interface LifecycleStageInfo {
  id: number;
  name: string;
  shortDesc: string;
  icon: string;
  targetStage: 1 | 2 | 3 | 4 | 5;
  targetElementId: string;
}

export const LIFECYCLE_STAGES: LifecycleStageInfo[] = [
  {
    id: 1,
    name: "Upload",
    shortDesc: "An authorised investigator submits evidence.",
    icon: "📤",
    targetStage: 1,
    targetElementId: "register-evidence",
  },
  {
    id: 2,
    name: "Fingerprint",
    shortDesc: "SHA-256 creates a private digital fingerprint.",
    icon: "🧬",
    targetStage: 1,
    targetElementId: "crypto-receipt",
  },
  {
    id: 3,
    name: "Encrypt",
    shortDesc: "AES-256-GCM locks the raw evidence.",
    icon: "🔐",
    targetStage: 1,
    targetElementId: "crypto-receipt",
  },
  {
    id: 4,
    name: "Blockchain Anchor",
    shortDesc: "Only the case-level Merkle root and custody metadata are recorded.",
    icon: "⚓",
    targetStage: 2,
    targetElementId: "merkle-anchor",
  },
  {
    id: 5,
    name: "Custody",
    shortDesc: "Every authorised handoff is recorded.",
    icon: "⛓️",
    targetStage: 3,
    targetElementId: "custody-transfer",
  },
  {
    id: 6,
    name: "ZK Verify",
    shortDesc: "Groth16 proves evidence membership without revealing the file.",
    icon: "⚖️",
    targetStage: 5,
    targetElementId: "zk-verification",
  },
  {
    id: 7,
    name: "Authorised Review",
    shortDesc: "Two authorised approvals are required before decryption.",
    icon: "🔑",
    targetStage: 4,
    targetElementId: "threshold-decryption",
  },
];

interface EvidenceLifecycleBarProps {
  currentStage: 1 | 2 | 3 | 4 | 5;
  onSelectStage: (stage: 1 | 2 | 3 | 4 | 5, targetElementId?: string) => void;
}

export const EvidenceLifecycleBar: React.FC<EvidenceLifecycleBarProps> = ({
  currentStage,
  onSelectStage,
}) => {
  const handleStageClick = (stage: LifecycleStageInfo) => {
    onSelectStage(stage.targetStage, stage.targetElementId);
    // Smooth scroll to target if available
    setTimeout(() => {
      const el = document.getElementById(stage.targetElementId);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }, 50);
  };

  return (
    <section className="glass-panel rounded-2xl p-4 space-y-3 border border-slate-800/80 bg-slate-950/70 shadow-xl shadow-slate-950/40">
      <div className="flex flex-wrap items-center justify-between gap-2 pb-1 border-b border-slate-800/60">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-pulse"></span>
          <h2 className="text-xs uppercase font-bold text-slate-200 tracking-wider flex items-center gap-2">
            <span>Evidence Security Lifecycle</span>
            <span className="text-[10px] text-cyan-400/80 font-mono font-normal normal-case">
              (Click any stage to inspect)
            </span>
          </h2>
        </div>
        <div className="text-[11px] text-slate-400 font-mono">
          Stage Map: Ingestion → Proof → Quorum Access
        </div>
      </div>

      {/* 7-Stage Horizontal Stepper */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-2">
        {LIFECYCLE_STAGES.map((st, idx) => {
          const isActive =
            (st.id === 1 && currentStage === 1) ||
            (st.id === 2 && currentStage === 1) ||
            (st.id === 3 && currentStage === 1) ||
            (st.id === 4 && currentStage === 2) ||
            (st.id === 5 && currentStage === 3) ||
            (st.id === 6 && currentStage === 5) ||
            (st.id === 7 && currentStage === 4);

          return (
            <button
              key={st.id}
              onClick={() => handleStageClick(st)}
              className={`p-2.5 rounded-xl text-left transition-all relative group flex flex-col justify-between border ${
                isActive
                  ? "bg-slate-900 border-cyan-500 shadow-md shadow-cyan-500/10 scale-[1.02] ring-1 ring-cyan-500/30"
                  : "bg-slate-950/40 border-slate-800/80 hover:border-slate-700 hover:bg-slate-900/40"
              }`}
              title={`${st.name}: ${st.shortDesc}`}
            >
              {isActive && (
                <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-cyan-400 via-indigo-400 to-purple-400"></div>
              )}
              <div className="flex items-center justify-between w-full mb-1">
                <span className="text-sm">{st.icon}</span>
                <span
                  className={`text-[9px] px-1.5 py-0.5 rounded font-mono font-bold ${
                    isActive
                      ? "bg-cyan-950 text-cyan-300 border border-cyan-800"
                      : "bg-slate-900 text-slate-500"
                  }`}
                >
                  Step {idx + 1}
                </span>
              </div>
              <div>
                <div
                  className={`text-xs font-bold leading-tight ${
                    isActive ? "text-cyan-200" : "text-slate-300 group-hover:text-slate-100"
                  }`}
                >
                  {st.name}
                </div>
                <div className="text-[10px] text-slate-400 mt-1 leading-snug line-clamp-2">
                  {st.shortDesc}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
};
