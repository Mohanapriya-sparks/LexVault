import React, { useState } from "react";

export interface GlossaryTerm {
  term: string;
  category: "Cryptography" | "Zero-Knowledge" | "Blockchain" | "Access Control";
  definition: string;
  analogy: string;
}

export const GLOSSARY_TERMS: GlossaryTerm[] = [
  {
    term: "Cryptographic Hash (SHA-256)",
    category: "Cryptography",
    definition: "A one-way mathematical function that converts any digital file into a unique 256-bit fingerprint. If even a single byte changes, the resulting hash changes completely.",
    analogy: "Like a human fingerprint: unique to one person and impossible to reverse-engineer back into the person.",
  },
  {
    term: "Symmetric Encryption (AES-256-GCM)",
    category: "Cryptography",
    definition: "Military-grade encryption standard that uses a single 256-bit key to lock data. Galois/Counter Mode (GCM) simultaneously provides confidentiality and tamper detection (authentication tag).",
    analogy: "Like an indestructible physical safe that requires a precise key and reveals immediately if anyone tried to pick the lock.",
  },
  {
    term: "Merkle Tree & Poseidon Root",
    category: "Zero-Knowledge",
    definition: "A hierarchical data structure where every parent node is the hash of its children. In LexVault, Poseidon (an algebraic hash optimized for ZK circuits) produces a single root representing all case evidence.",
    analogy: "Like a tree trunk (root) connecting multiple branches and leaves: changing one leaf alters the entire trunk.",
  },
  {
    term: "Zero-Knowledge Proof (Groth16)",
    category: "Zero-Knowledge",
    definition: "A cryptographic proof that allows one party to convince another that a mathematical statement is true without revealing the secret input data itself.",
    analogy: "Proving you know the password to a door by walking through it, without ever saying the password out loud.",
  },
  {
    term: "EVM eth_call (View Operation)",
    category: "Blockchain",
    definition: "Read-only EVM eth_call: no transaction submitted, no blockchain state changed and no gas fee paid. Verification logic is evaluated against the deployed smart contract without modifying state.",
    analogy: "Like reading a public bulletin board to verify a signature without pinning a new note to it.",
  },
  {
    term: "Immutable Custody Ledger",
    category: "Blockchain",
    definition: "A smart contract on the blockchain that logs every evidence registration and custodian handoff in an append-only, tamper-evident sequence.",
    analogy: "An indelible public notary ledger where entries can never be erased, overwritten, or backdated.",
  },
  {
    term: "Shamir's Secret Sharing (2-of-3 Quorum)",
    category: "Access Control",
    definition: "A mathematical algorithm that divides a secret decryption key into 3 shares. Any 2 shares can reconstruct the key using polynomial interpolation, but 1 share reveals zero information.",
    analogy: "A bank vault requiring 2 out of 3 distinct keys held by different officers to open.",
  },
  {
    term: "Chain of Custody",
    category: "Access Control",
    definition: "The chronological documentation showing the custody, control, transfer, analysis, and disposition of physical or electronic evidence.",
    analogy: "A strict sign-in/sign-out registry tracking who held the evidence at every second.",
  },
];

interface GlossaryModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const GlossaryModal: React.FC<GlossaryModalProps> = ({ isOpen, onClose }) => {
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("All");

  if (!isOpen) return null;

  const categories = ["All", "Cryptography", "Zero-Knowledge", "Blockchain", "Access Control"];

  const filteredTerms = GLOSSARY_TERMS.filter((t) => {
    const matchesCategory = selectedCategory === "All" || t.category === selectedCategory;
    const matchesSearch =
      t.term.toLowerCase().includes(search.toLowerCase()) ||
      t.definition.toLowerCase().includes(search.toLowerCase()) ||
      t.analogy.toLowerCase().includes(search.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-2xl border border-cyan-500/40 bg-slate-900 shadow-2xl shadow-cyan-950/60 p-6 space-y-5 text-slate-200">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-cyan-950/80 border border-cyan-500/50 flex items-center justify-center text-lg shadow-inner">
              📖
            </div>
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <span>LexVault Beginner &amp; Evaluator Glossary</span>
              </h2>
              <p className="text-xs text-slate-400">
                Plain-language explanations of core cryptography and blockchain terms
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center text-sm transition"
            title="Close Glossary"
          >
            ✕
          </button>
        </div>

        {/* Search & Category Filter */}
        <div className="flex flex-col sm:flex-row gap-2">
          <input
            type="text"
            placeholder="Search terms, analogies, definitions..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500"
          />
          <div className="flex gap-1 overflow-x-auto pb-1 sm:pb-0">
            {categories.map((c) => (
              <button
                key={c}
                onClick={() => setSelectedCategory(c)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition ${
                  selectedCategory === c
                    ? "bg-cyan-600 text-slate-950 shadow-md shadow-cyan-600/20"
                    : "bg-slate-950 text-slate-400 border border-slate-800 hover:text-slate-200"
                }`}
              >
                {c}
              </button>
            ))}
          </div>
        </div>

        {/* Terms List */}
        <div className="space-y-3">
          {filteredTerms.length === 0 ? (
            <div className="p-8 text-center text-slate-500 text-xs">
              No matching glossary terms found.
            </div>
          ) : (
            filteredTerms.map((t) => (
              <div
                key={t.term}
                className="p-4 rounded-xl bg-slate-950/70 border border-slate-800/80 space-y-2 hover:border-slate-700 transition"
              >
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-xs font-bold text-cyan-300">{t.term}</h3>
                  <span className="text-[10px] px-2 py-0.5 rounded bg-slate-900 text-slate-400 font-mono border border-slate-800">
                    {t.category}
                  </span>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">{t.definition}</p>
                <div className="p-2.5 rounded-lg bg-slate-900/80 border border-slate-800/60 text-[11px] text-amber-300/90 flex items-start gap-2">
                  <span className="text-amber-400">💡</span>
                  <span><strong>Analogy:</strong> {t.analogy}</span>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end pt-2">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-bold text-xs shadow-lg shadow-cyan-600/20 transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
