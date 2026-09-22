import React, { useState, useEffect } from "react";

export interface TourStep {
  step: number;
  title: string;
  targetId: string;
  stageTarget: 1 | 2 | 3 | 4 | 5 | "registry";
  description: string;
  actionHint: string;
  highlightCategory: string;
}

export const TOUR_STEPS: TourStep[] = [
  {
    step: 1,
    title: "Step 1: Evidence Ingestion & Client-Side Encryption",
    targetId: "register-evidence",
    stageTarget: 1,
    description: "In Stage 1, an investigator registers raw digital evidence. The browser uses Web Crypto API to generate an ephemeral 256-bit AES key, computes the SHA-256 digest, and encrypts the file before transmission.",
    actionHint: "Look at the registration form and upload button.",
    highlightCategory: "Ingestion & Encryption",
  },
  {
    step: 2,
    title: "Step 2: Cryptographic Receipt & Private Data Isolation",
    targetId: "crypto-receipt",
    stageTarget: 1,
    description: "Every registration produces an evidence-grounded Cryptographic Receipt. The SHA-256 digest is reduced into a BN128 scalar field element. Only the Merkle root is anchored on-chain.",
    actionHint: "Inspect the 8 verified operations and masked private inputs.",
    highlightCategory: "Zero-Knowledge Isolation",
  },
  {
    step: 3,
    title: "Step 3: Blockchain Custody Transfer Handoff",
    targetId: "custody-transfer",
    stageTarget: 3,
    description: "In Stage 3, evidence custody is transferred between verified roles (Investigator → Forensic Officer → Court Reviewer). Every handoff is recorded immutably on the CustodyLedger smart contract.",
    actionHint: "View the role dropdown and cryptographic transfer trigger.",
    highlightCategory: "Immutable Ledger",
  },
  {
    step: 4,
    title: "Step 4: Zero-Knowledge Groth16 Verification",
    targetId: "zk-verification",
    stageTarget: 5,
    description: "In Stage 5, Groth16 zk-SNARK proves that the evidence belongs to the case Merkle tree without revealing or decrypting the confidential file. The deployed Solidity verifier evaluates the proof via a read-only EVM eth_call.",
    actionHint: "Click 'Verify Evidence via ZK Proof' to execute the prover.",
    highlightCategory: "Zero-Knowledge Proof",
  },
  {
    step: 5,
    title: "Step 5: 1-Byte Tamper Detection Simulation",
    targetId: "tamper-test",
    stageTarget: 5,
    description: "Test LexVault's mathematical tamper resistance! Flipping just 1 byte in the evidence payload causes Circom circuit constraints to fail, immediately rejecting the proof.",
    actionHint: "Click 'Run 1-Byte Modification Tamper Test' to observe immediate circuit rejection.",
    highlightCategory: "Tamper Resistance",
  },
  {
    step: 6,
    title: "Step 6: Off-Chain 2-of-3 Shamir Threshold Decryption",
    targetId: "threshold-decryption",
    stageTarget: 4,
    description: "In Stage 4, authorized evidence decryption requires a 2-of-3 threshold quorum. The AES key is reconstructed via Lagrange interpolation only after two authorized officers sign. Unauthorized roles (e.g. Intern) are cryptographically denied.",
    actionHint: "Collect approvals from 2 officers to unlock decryption.",
    highlightCategory: "Threshold Quorum",
  },
  {
    step: 7,
    title: "Step 7: Immutable Blockchain Audit Explorer",
    targetId: "audit-explorer",
    stageTarget: "registry",
    description: "The Audit Explorer provides a multi-case dashboard, verified on-chain event logs, custody timelines, and privacy confirmations across all cases.",
    actionHint: "Explore multi-case records and on-chain verification flags.",
    highlightCategory: "Public Auditability",
  },
];

interface GuidedDemoTourProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigateStage: (stage: 1 | 2 | 3 | 4 | 5 | "registry", targetElementId?: string) => void;
}

export const GuidedDemoTour: React.FC<GuidedDemoTourProps> = ({
  isOpen,
  onClose,
  onNavigateStage,
}) => {
  const [currentStepIndex, setCurrentStepIndex] = useState(0);

  const step = TOUR_STEPS[currentStepIndex];

  useEffect(() => {
    if (isOpen && step) {
      onNavigateStage(step.stageTarget, step.targetId);
      setTimeout(() => {
        const el = document.getElementById(step.targetId);
        if (el) {
          el.scrollIntoView({ behavior: "smooth", block: "center" });
        }
      }, 150);
    }
  }, [isOpen, currentStepIndex]);

  if (!isOpen || !step) return null;

  const handleNext = () => {
    if (currentStepIndex < TOUR_STEPS.length - 1) {
      setCurrentStepIndex(currentStepIndex + 1);
    } else {
      onClose();
    }
  };

  const handlePrev = () => {
    if (currentStepIndex > 0) {
      setCurrentStepIndex(currentStepIndex - 1);
    }
  };

  return (
    <div className="fixed bottom-6 right-6 z-50 max-w-md w-[92vw] sm:w-[420px] rounded-2xl border border-cyan-500/50 bg-slate-900/95 shadow-2xl shadow-cyan-950/80 backdrop-blur-xl p-5 space-y-4 text-slate-200 animate-in slide-in-from-bottom-5 duration-300">
      {/* Top Banner */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-pulse"></span>
          <span className="text-xs font-bold text-cyan-300 uppercase tracking-wider">
            Guided Security Tour ({step.step} of {TOUR_STEPS.length})
          </span>
        </div>
        <button
          onClick={onClose}
          className="text-slate-400 hover:text-slate-200 text-xs px-2 py-1 rounded bg-slate-800/80 hover:bg-slate-700 transition"
          title="Exit Tour"
        >
          ✕ Exit
        </button>
      </div>

      {/* Step Body */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-white">{step.title}</h3>
          <span className="text-[10px] px-2 py-0.5 rounded bg-cyan-950 text-cyan-300 border border-cyan-800 font-mono">
            {step.highlightCategory}
          </span>
        </div>
        <p className="text-xs text-slate-300 leading-relaxed">{step.description}</p>
        <div className="p-2.5 rounded-xl bg-slate-950/80 border border-slate-800 text-[11px] text-cyan-300 flex items-start gap-2">
          <span className="text-cyan-400">💡</span>
          <span><strong>Action:</strong> {step.actionHint}</span>
        </div>
      </div>

      {/* Navigation Buttons */}
      <div className="flex items-center justify-between pt-2 border-t border-slate-800">
        <button
          onClick={handlePrev}
          disabled={currentStepIndex === 0}
          className="px-3.5 py-1.5 rounded-xl text-xs font-semibold text-slate-300 bg-slate-800 hover:bg-slate-700 disabled:opacity-30 disabled:pointer-events-none transition"
        >
          ← Previous
        </button>

        <div className="flex gap-1">
          {TOUR_STEPS.map((_, idx) => (
            <span
              key={idx}
              className={`w-2 h-2 rounded-full transition-all ${
                idx === currentStepIndex ? "bg-cyan-400 scale-125" : "bg-slate-700"
              }`}
            />
          ))}
        </div>

        <button
          onClick={handleNext}
          className="px-4 py-1.5 rounded-xl text-xs font-bold text-slate-950 bg-cyan-400 hover:bg-cyan-300 shadow-md shadow-cyan-400/20 transition"
        >
          {currentStepIndex === TOUR_STEPS.length - 1 ? "Finish Tour ✓" : "Next Step →"}
        </button>
      </div>
    </div>
  );
};
