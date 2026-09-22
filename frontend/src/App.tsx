import React, { useState, useEffect } from "react";
import { CaseRegistryDashboard, OnChainCaseSummary, ProvenanceStatusChecklistView } from "./AuditExplorer";
import { EvidenceLifecycleBar } from "./components/EvidenceLifecycleBar";
import { CryptoReceiptModal, CryptoReceiptData } from "./components/CryptoReceiptModal";
import { ZKArchitectureViewer } from "./components/ZKArchitectureViewer";
import { ShamirQuorumCounter } from "./components/ShamirQuorumCounter";
import { FeatureMapModal } from "./components/FeatureMapModal";
import { GlossaryModal } from "./components/GlossaryModal";
import { SecurityBoundariesBox } from "./components/SecurityBoundariesBox";
import { GuidedDemoTour } from "./components/GuidedDemoTour";

type Stage = 1 | 2 | 3 | 4 | 5;
type Role = "Investigator" | "Forensic Officer" | "Court Reviewer" | "Defense Lawyer" | "Intern";

const SNARK_FIELD_PRIME = BigInt("21888242871839275222246405745257275088548364400416034343698204186575808495617");

// Convert Uint8Array to Base64
function uint8ArrayToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
}

// Generate random BigInt in [1, p - 1]
function getRandomFieldElement(p: bigint): bigint {
  const bytes = window.crypto.getRandomValues(new Uint8Array(32));
  let hex = "";
  for (let i = 0; i < bytes.length; i++) {
    hex += bytes[i].toString(16).padStart(2, "0");
  }
  return (BigInt("0x" + hex) % (p - 1n)) + 1n;
}

// Client-side SHA-256 mapped to BN128 scalar field element
async function sha256ToFieldElementBrowser(data: Uint8Array): Promise<{ hexHash: string; leafFieldElement: string }> {
  const hashBuffer = await window.crypto.subtle.digest("SHA-256", data as any);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hexHash = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
  const bigIntVal = BigInt("0x" + hexHash);
  const leafFieldElement = (bigIntVal % SNARK_FIELD_PRIME).toString();
  return { hexHash, leafFieldElement };
}

// Generate ephemeral 256-bit symmetric key and split via 2-of-3 Shamir's Secret Sharing in BN128 scalar field
function generateClientShamirKeyAndShares(): {
  keyBytes: Uint8Array;
  keyBigInt: bigint;
  keyShares: Record<string, string>;
} {
  const p = SNARK_FIELD_PRIME;
  const keyBigInt = getRandomFieldElement(p);
  const a1 = getRandomFieldElement(p);

  const s1 = (keyBigInt + a1 * 1n) % p;
  const s2 = (keyBigInt + a1 * 2n) % p;
  const s3 = (keyBigInt + a1 * 3n) % p;

  const hex = keyBigInt.toString(16).padStart(64, "0");
  const keyBytes = new Uint8Array(32);
  for (let i = 0; i < 32; i++) {
    keyBytes[i] = parseInt(hex.substr(i * 2, 2), 16);
  }

  return {
    keyBytes,
    keyBigInt,
    keyShares: {
      "Investigator": s1.toString(),
      "Forensic Officer": s2.toString(),
      "Court Reviewer": s3.toString(),
    },
  };
}

// Client-side AES-256-GCM encryption with ephemeral key
async function clientEncryptAESGCMWithKey(data: Uint8Array, keyBytes: Uint8Array): Promise<{ encryptedData: string; iv: string; authTag: string }> {
  const key = await window.crypto.subtle.importKey(
    "raw",
    keyBytes as any,
    { name: "AES-GCM" },
    false,
    ["encrypt"]
  );

  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  
  const encryptedBuffer = await window.crypto.subtle.encrypt(
    { name: "AES-GCM", iv: iv, tagLength: 128 },
    key,
    data as any
  );
  
  const encryptedArray = new Uint8Array(encryptedBuffer);
  const ciphertext = encryptedArray.slice(0, encryptedArray.length - 16);
  const authTag = encryptedArray.slice(encryptedArray.length - 16);

  return {
    encryptedData: uint8ArrayToBase64(ciphertext),
    iv: uint8ArrayToBase64(iv),
    authTag: uint8ArrayToBase64(authTag),
  };
}

function UnregisteredCaseNotice({
  caseId,
  onGoToRegister,
  availableCases,
  onSwitchCase,
}: {
  caseId: string;
  onGoToRegister: () => void;
  availableCases: Array<{ caseId: number; evidenceLabel?: string }>;
  onSwitchCase: (id: string) => void;
}) {
  return (
    <div className="glass-panel rounded-2xl p-8 space-y-4 border border-amber-800/60 text-center">
      <div className="w-12 h-12 mx-auto rounded-full bg-amber-950 border border-amber-700/60 flex items-center justify-center text-2xl shadow-lg shadow-amber-900/20">
        ⚠️
      </div>
      <div className="space-y-1">
        <h3 className="text-base font-bold text-amber-200">
          Case #{caseId} is Not Yet Registered On-Chain
        </h3>
        <p className="text-xs text-amber-300/80 max-w-lg mx-auto">
          No Poseidon Merkle root has been committed to the <code className="text-amber-200 font-mono">CustodyLedger</code> smart contract for Case #{caseId}. Complete Stage 1 to register this case on the ledger before proceeding.
        </p>
      </div>
      <div className="flex justify-center items-center gap-3 pt-2 flex-wrap">
        <button
          onClick={onGoToRegister}
          className="px-5 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-slate-950 font-bold text-xs shadow-lg shadow-amber-600/20 transition"
        >
          Register Case #{caseId} in Stage 1
        </button>
        {availableCases.length > 0 && (
          <button
            onClick={() => onSwitchCase(availableCases[0].caseId.toString())}
            className="px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-slate-300 font-semibold text-xs hover:bg-slate-800 transition"
          >
            Switch to Registered Case #{availableCases[0].caseId}
          </button>
        )}
      </div>
    </div>
  );
}

export default function App() {
  // View mode switcher: Journey Pipeline vs Registry & Audit Explorer
  const [viewMode, setViewMode] = useState<"pipeline" | "registry">("pipeline");

  // Current active step in dynamic pipeline flow
  const [currentStage, setCurrentStage] = useState<Stage>(1);
  const [caseIdInput, setCaseIdInput] = useState<string>("101");
  const [caseDetails, setCaseDetails] = useState<any>(null);
  const [availableCases, setAvailableCases] = useState<OnChainCaseSummary[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [statusMsg, setStatusMsg] = useState<{ type: "success" | "error" | "info"; text: string; suggestedCaseId?: number } | null>(null);

  // Stage 1: Registration Form State
  const [regCaseId, setRegCaseId] = useState<string>("103");
  const [regFileName, setRegFileName] = useState<string>("Forensic_DNA_Sample_C103.txt");
  const [regMimeType, setRegMimeType] = useState<string>("text/plain");
  const [inputType, setInputType] = useState<"text" | "file">("text");
  const [regFileContent, setRegFileContent] = useState<string>("CONFIDENTIAL EVIDENCE FILE CONTENT FOR CASE #103\nDNA Match: 99.98% Confidence\nBallistics: Caliber 9x19mm Parabellum match confirmed.");
  const [selectedFileBytes, setSelectedFileBytes] = useState<Uint8Array | null>(null);
  const [clientTelemetry, setClientTelemetry] = useState<{
    sha256Hex?: string;
    leafFieldElement?: string;
    keyShares?: Record<string, string>;
  } | null>(null);
  const [regResult, setRegResult] = useState<any>(null);

  // Stage 3: Custody Transfer Form State
  const [transferFromRole, setTransferFromRole] = useState<string>("Forensic Officer");
  const [transferToAddress, setTransferToAddress] = useState<string>("0x90F79bf6EB2c4f870365E785982E1f101E93b906");
  const [transferReason, setTransferReason] = useState<string>("Evidence handoff to Court Reviewer for judicial trial hearing");

  // Stage 4: Shamir Chamber State
  const [activeRoleForDecryption, setActiveRoleForDecryption] = useState<Role>("Court Reviewer");
  const [engagedShares, setEngagedShares] = useState<string[]>(["Investigator", "Forensic Officer"]);
  const [decryptedFile, setDecryptedFile] = useState<any>(null);

  // Stage 5: ZK Verification State & Circuit Inspector
  const [zkProofResult, setZkProofResult] = useState<any>(null);
  const [zkTamperResult, setZkTamperResult] = useState<any>(null);
  const [isPublicVerificationMode, setIsPublicVerificationMode] = useState<boolean>(true);
  const [showCircuitInspector, setShowCircuitInspector] = useState<boolean>(false);
  const [circuitInfo, setCircuitInfo] = useState<any>(null);

  // Autoplay flow state
  const [isAutoplaying, setIsAutoplaying] = useState<boolean>(false);

  // Modals & Guided Tour States
  const [isCryptoReceiptOpen, setIsCryptoReceiptOpen] = useState<boolean>(false);
  const [isFeatureMapOpen, setIsFeatureMapOpen] = useState<boolean>(false);
  const [isGlossaryOpen, setIsGlossaryOpen] = useState<boolean>(false);
  const [isTourOpen, setIsTourOpen] = useState<boolean>(false);
  const [cryptoReceiptData, setCryptoReceiptData] = useState<CryptoReceiptData | null>(null);

  const handleNavigateToStage = (
    target: 1 | 2 | 3 | 4 | 5 | "registry",
    targetElementId?: string
  ) => {
    if (target === "registry") {
      setViewMode("registry");
    } else {
      setViewMode("pipeline");
      setCurrentStage(target);
    }
    if (targetElementId) {
      setTimeout(() => {
        const el = document.getElementById(targetElementId);
        if (el) {
          el.scrollIntoView({ behavior: "smooth", block: "center" });
        }
      }, 120);
    }
  };

  useEffect(() => {
    fetchAvailableCases();
    fetchCaseDetails(caseIdInput);
    fetchCircuitInfo();
  }, [caseIdInput]);

  const fetchCircuitInfo = async () => {
    try {
      const res = await fetch("/api/circuit-info");
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setCircuitInfo(data);
        }
      }
    } catch (e) {
      console.error("Failed to load circuit info", e);
    }
  };

  // Compute live client-side telemetry when input changes
  useEffect(() => {
    const computeTelemetry = async () => {
      try {
        const rawBytes = inputType === "file" && selectedFileBytes 
          ? selectedFileBytes 
          : new TextEncoder().encode(regFileContent);

        const { hexHash, leafFieldElement } = await sha256ToFieldElementBrowser(rawBytes);
        setClientTelemetry((prev) => ({
          ...prev,
          sha256Hex: hexHash,
          leafFieldElement: leafFieldElement,
        }));
      } catch (e) {
        console.error("Telemetry error", e);
      }
    };
    computeTelemetry();
  }, [regFileContent, selectedFileBytes, inputType]);

const SHOWCASE_DEFAULT_CASES: OnChainCaseSummary[] = [
  {
    caseId: 101,
    evidenceLabel: "Forensic DNA & Ballistics Report",
    merkleRoot: "0x09cfb73dca0bd9c21e329880d7bbe59465e9724a2392af7650e3cd0334551bad",
    custodian: "0x90F79bf6EB2c4f870365E785982E1f101E93b906",
    timestamp: Date.now() - 7200000,
    custodyEventCount: 2,
    registrationBlock: 1,
    txHash: "0x39a04f...demo_tx",
  },
  {
    caseId: 102,
    evidenceLabel: "CCTV Sector 4 Secure Lab Footage",
    merkleRoot: "0x1bab955eb20fbfde98da07cb0252ad55b2449fe0dc54fee23e28fdfee4d30dd2",
    custodian: "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
    timestamp: Date.now() - 5400000,
    custodyEventCount: 0,
    registrationBlock: 2,
    txHash: "0x48b12e...demo_tx",
  },
  {
    caseId: 103,
    evidenceLabel: "Encrypted Wiretap Audio Recording",
    merkleRoot: "0x1a8fa7de5fd302014f6ac2a35a226ae78e69705be9119d7cfc325a05fdf7308c",
    custodian: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
    timestamp: Date.now() - 3600000,
    custodyEventCount: 1,
    registrationBlock: 3,
    txHash: "0x57c23a...demo_tx",
  },
  {
    caseId: 107,
    evidenceLabel: "Financial Audit Ledger Excerpt",
    merkleRoot: "0x2cf7f76b7b82b304054293553f41ad1b201d50d389889ee5bc7c08c71a861316",
    custodian: "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC",
    timestamp: Date.now() - 1800000,
    custodyEventCount: 1,
    registrationBlock: 4,
    txHash: "0x66d34b...demo_tx",
  },
];

  const isShowcaseMode = (import.meta as any).env?.VITE_SHOWCASE_MODE === "true" || (typeof window !== "undefined" && window.location.hostname.includes("github.io"));

  const fetchAvailableCases = async () => {
    if (isShowcaseMode) {
      setAvailableCases(SHOWCASE_DEFAULT_CASES);
      return;
    }
    try {
      const res = await fetch("/api/cases");
      if (res.ok) {
        const data = await res.json();
        if (data.cases && data.cases.length > 0) {
          setAvailableCases(data.cases);
          return;
        }
      }
    } catch {
      // Fallback for static showcase deployment
    }
    setAvailableCases(SHOWCASE_DEFAULT_CASES);
  };

  const generateNextFreeCaseId = (): string => {
    const existingIds = availableCases.map((c) => c.caseId);
    let candidate = 101;
    while (existingIds.includes(candidate)) {
      candidate++;
    }
    return candidate.toString();
  };

  const fetchCaseDetails = async (id: string) => {
    setCaseDetails(null);
    if (!isShowcaseMode) {
      try {
        const res = await fetch(`/api/case/${id}`);
        if (res.ok) {
          const data = await res.json();
          setCaseDetails(data);
          return;
        }
      } catch {
        // Fallback for static showcase deployment
      }
    }
    const fallback = SHOWCASE_DEFAULT_CASES.find((c) => c.caseId.toString() === id);
    if (fallback) {
      setCaseDetails({
        caseId: fallback.caseId,
        isRegistered: true,
        onChainRecord: {
          merkleRoot: fallback.merkleRoot,
          timestamp: Math.floor(fallback.timestamp / 1000),
          custodian: fallback.custodian,
        },
        metadata: {
          filename: `Evidence_${fallback.evidenceLabel.replace(/[^a-zA-Z0-9]/g, "_")}.pdf`,
          mimeType: "application/pdf",
          registeredAt: fallback.timestamp,
        },
        custodyHistory: [
          {
            from: "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
            to: fallback.custodian,
            timestamp: Math.floor(fallback.timestamp / 1000),
            txHash: "0x39a04f...demo_tx",
          },
        ],
        receipt: {
          operations: {
            rawEvidenceReceived: true,
            sha256FingerprintGenerated: true,
            fieldLeafDerived: true,
            poseidonTreeBuilt: true,
            merkleRootCalculated: true,
            aesGcmEncrypted: true,
            vaultRecordPersisted: true,
            ledgerRegistrationConfirmed: true,
          },
          publicData: {
            caseId: fallback.caseId,
            merkleRootHex: fallback.merkleRoot,
            txHash: "0x39a04f...demo_tx",
            registrationTimestamp: fallback.timestamp,
            custodian: fallback.custodian,
          },
        },
      });
    } else {
      setCaseDetails(null);
    }
  };

  const handleRegCaseIdChange = (newId: string) => {
    setRegCaseId(newId);
    if (inputType === "text") {
      setRegFileName(`Forensic_DNA_Report_C${newId}.txt`);
      setRegMimeType("text/plain");
      setRegFileContent(`CONFIDENTIAL FORENSIC REPORT\nCase: #${newId}\nSubject: Crime Scene DNA & Ballistics Sample for Case #${newId}\nStatus: Cryptographically sealed via LexVault ZK protocol.`);
    }
  };

  const setSampleTemplate = (type: "ballistics" | "cctv" | "contract", explicitId?: string) => {
    const nextId = explicitId || regCaseId || generateNextFreeCaseId();
    setRegCaseId(nextId);
    if (type === "ballistics") {
      setRegFileName(`Forensic_DNA_Report_C${nextId}.txt`);
      setRegMimeType("text/plain");
      setRegFileContent(`CONFIDENTIAL FORENSIC REPORT\nCase: #${nextId}\nSubject: Crime Scene DNA & Ballistics Sample for Case #${nextId}\nStatus: Cryptographically sealed via LexVault ZK protocol.`);
    } else if (type === "cctv") {
      setRegFileName(`Surveillance_Camera_Feed_C${nextId}.txt`);
      setRegMimeType("text/plain");
      setRegFileContent(`DIGITAL VIDEO RECORDING LOG\nCase: #${nextId}\nCamera: North Corridor Cam #4\nTimestamp: 2026-09-18 03:14:22 UTC\nMD5/SHA Hash: Verified Intact at Ingestion for Case #${nextId}.`);
    } else {
      setRegFileName(`Corporate_Audit_Ledger_C${nextId}.txt`);
      setRegMimeType("text/plain");
      setRegFileContent(`FINANCIAL COMPLIANCE EVIDENCE\nCase: #${nextId}\nEntity: Sovereign Escrow Corp\nAudit Scope: Immutable Blockchain Chain of Custody for Case #${nextId}\nClassification: RESTRICTED.`);
    }
    setInputType("text");
    setSelectedFileBytes(null);
  };

  const handleFileUploadChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setRegFileName(file.name);
      setRegMimeType(file.type || "application/octet-stream");
      const reader = new FileReader();
      reader.onload = () => {
        const arrayBuffer = reader.result as ArrayBuffer;
        setSelectedFileBytes(new Uint8Array(arrayBuffer));
      };
      reader.readAsArrayBuffer(file);
    }
  };

  const handleRegister = async (e?: React.FormEvent, explicitCaseId?: string) => {
    if (e) e.preventDefault();
    setLoading(true);
    const targetCaseId = explicitCaseId || regCaseId;
    setStatusMsg({
      type: "info",
      text: `🔒 Case #${targetCaseId}: Generating Ephemeral Key, Splitting via Shamir 2-of-3, Hashing & Encrypting in browser...`,
    });

    try {
      const rawBytes = inputType === "file" && selectedFileBytes 
        ? selectedFileBytes 
        : new TextEncoder().encode(regFileContent);

      const { hexHash, leafFieldElement } = await sha256ToFieldElementBrowser(rawBytes);
      const { keyBytes, keyShares } = generateClientShamirKeyAndShares();

      if (isShowcaseMode) {
        await new Promise((r) => setTimeout(r, 450));
        const simulatedRoot = "0x" + Array.from(window.crypto.getRandomValues(new Uint8Array(32))).map(b => b.toString(16).padStart(2, "0")).join("");
        const simCase = {
          caseId: parseInt(targetCaseId),
          merkleRoot: simulatedRoot,
          custodian: "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
          evidenceLabel: inputType === "file" ? regFileName : `Evidence Item #${targetCaseId}`,
          timestamp: Date.now(),
          custodyEventCount: 0,
          registrationBlock: 5,
          txHash: "0x" + Array.from(window.crypto.getRandomValues(new Uint8Array(32))).map(b => b.toString(16).padStart(2, "0")).join("").slice(0, 10) + "...demo_tx",
        };
        setAvailableCases(prev => [simCase, ...prev.filter(c => c.caseId !== simCase.caseId)]);
        setCaseDetails({
          caseId: simCase.caseId,
          isRegistered: true,
          onChainRecord: {
            merkleRoot: simCase.merkleRoot,
            timestamp: Math.floor(simCase.timestamp / 1000),
            custodian: simCase.custodian,
          },
          metadata: {
            filename: regFileName,
            mimeType: regMimeType,
            registeredAt: simCase.timestamp,
          },
          custodyHistory: [],
          receipt: {
            operations: {
              rawEvidenceReceived: true,
              sha256FingerprintGenerated: true,
              fieldLeafDerived: true,
              poseidonTreeBuilt: true,
              merkleRootCalculated: true,
              aesGcmEncrypted: true,
              vaultRecordPersisted: true,
              ledgerRegistrationConfirmed: true,
            },
            publicData: {
              caseId: simCase.caseId,
              merkleRootHex: simCase.merkleRoot,
              txHash: simCase.txHash,
              registrationTimestamp: simCase.timestamp,
              custodian: simCase.custodian,
            },
          },
        });
        setRegResult({
          success: true,
          isSimulated: true,
          caseId: simCase.caseId,
          filename: regFileName,
          merkleRoot: simCase.merkleRoot,
          merkleRootHex: simCase.merkleRoot,
          txHash: simCase.txHash,
          timestamp: simCase.timestamp,
          clientEncrypted: true,
          leafFieldElement,
          keyShares,
        });
        setStatusMsg({
          type: "success",
          text: `Case #${targetCaseId} registered! Ephemeral AES key split via Shamir 2-of-3 & Merkle Root committed on-chain. [Demonstration output]`,
        });
        setCaseIdInput(targetCaseId);
        setLoading(false);
        return;
      }

      // Live Backend Execution
      const { encryptedData, iv, authTag } = await clientEncryptAESGCMWithKey(rawBytes, keyBytes);

      setClientTelemetry({
        sha256Hex: hexHash,
        leafFieldElement,
        keyShares,
      });

      const res = await fetch("/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          caseId: targetCaseId,
          filename: regFileName,
          mimeType: inputType === "file" ? regMimeType : "text/plain",
          encryptedData,
          iv,
          authTag,
          leafFieldElement,
          keyShares,
        }),
      });

      const textRes = await res.text();
      let data: any;
      try {
        data = JSON.parse(textRes);
      } catch {
        throw new Error(
          res.status === 413
            ? "File payload too large. Please upload an evidence file under 50MB."
            : `Server returned non-JSON response (HTTP ${res.status}): ${textRes.slice(0, 100)}`
        );
      }

      if (res.ok && data.success) {
        setRegResult({
          ...data,
          clientEncrypted: true,
          leafFieldElement,
          keyShares,
        });
        if (data.receipt) {
          setCryptoReceiptData(data.receipt);
        }
        setStatusMsg({
          type: "success",
          text: `Case #${data.caseId} registered! Ephemeral AES key split via Shamir 2-of-3 & Merkle Root committed on-chain.`,
        });
        setCaseIdInput(targetCaseId);
        fetchCaseDetails(targetCaseId);
        fetchAvailableCases();
      } else {
        setStatusMsg({
          type: "error",
          text: data.error || "Registration failed",
          suggestedCaseId: data.suggestedCaseId,
        });
      }
    } catch (err: any) {
      setStatusMsg({ type: "error", text: err.message });
    } finally {
      setLoading(false);
    }
  };

  const handleTransferCustody = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setLoading(true);

    if (isShowcaseMode) {
      await new Promise((r) => setTimeout(r, 400));
      if (caseDetails) {
        const newEvent = {
          from: caseDetails.onChainRecord?.custodian || "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
          to: transferToAddress,
          timestamp: Math.floor(Date.now() / 1000),
          txHash: "0x" + Array.from(window.crypto.getRandomValues(new Uint8Array(32))).map(b => b.toString(16).padStart(2, "0")).join("").slice(0, 10) + "...demo_tx",
        };
        setCaseDetails({
          ...caseDetails,
          onChainRecord: {
            ...caseDetails.onChainRecord,
            custodian: transferToAddress,
          },
          custodyHistory: [newEvent, ...(caseDetails.custodyHistory || [])],
        });
      }
      setStatusMsg({
        type: "success",
        text: `Custody for Case #${caseIdInput} transferred to ${transferToAddress.slice(0, 8)}... (${transferReason}) [Demonstration output]`,
      });
      setLoading(false);
      return;
    }

    try {
      const res = await fetch("/api/transfer-custody", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          caseId: caseIdInput,
          toAddress: transferToAddress,
          signature: `0x_signed_handoff_from_${transferFromRole.replace(/\s+/g, '_')}_to_${transferToAddress.slice(0, 8)}_time_${Date.now()}`,
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setStatusMsg({
          type: "success",
          text: `Custody for Case #${caseIdInput} transferred to ${transferToAddress.slice(0, 8)}... (${transferReason})`,
        });
        fetchCaseDetails(caseIdInput);
      } else {
        setStatusMsg({ type: "error", text: data.error || "Transfer failed" });
      }
    } catch (err: any) {
      setStatusMsg({ type: "error", text: err.message });
    } finally {
      setLoading(false);
    }
  };

  const handleDecrypt = async () => {
    setLoading(true);
    setDecryptedFile(null);

    if (isShowcaseMode) {
      await new Promise((r) => setTimeout(r, 400));
      if (engagedShares.length < 2) {
        setStatusMsg({
          type: "error",
          text: "❌ Access Denied: 2-of-3 Shamir threshold requires at least 2 distinct officer shares. [Demonstration output]",
        });
      } else {
        setDecryptedFile({
          success: true,
          isSimulated: true,
          filename: caseDetails?.metadata?.filename || `Forensic_DNA_Report_C${caseIdInput}.txt`,
          mimeType: "text/plain",
          contentBase64: window.btoa(
            `CONFIDENTIAL FORENSIC REPORT\nCase: #${caseIdInput}\nSubject: Crime Scene DNA & Ballistics Sample for Case #${caseIdInput}\nStatus: Cryptographically sealed via LexVault ZK protocol.\nDecrypted via simulated 2-of-3 Shamir Quorum.\n[Demonstration output]`
          ),
        });
        setStatusMsg({
          type: "success",
          text: `✅ 2-of-3 Shamir Quorum Verified. AES-256 Key Reconstructed via Lagrange Interpolation. [Demonstration output]`,
        });
      }
      setLoading(false);
      return;
    }

    try {
      const res = await fetch("/api/decrypt-evidence", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          caseId: caseIdInput,
          role: activeRoleForDecryption,
          approvals: engagedShares,
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setDecryptedFile(data);
        setStatusMsg({
          type: "success",
          text: `✅ 2-of-3 Shamir Quorum Verified. AES-256 Key Reconstructed via Lagrange Interpolation.`,
        });
      } else {
        setStatusMsg({ type: "error", text: data.error || "Access Denied" });
      }
    } catch (err: any) {
      setStatusMsg({ type: "error", text: err.message });
    } finally {
      setLoading(false);
    }
  };

  const downloadDecryptedFile = () => {
    if (!decryptedFile) return;

    let mimeType = decryptedFile.mimeType || "text/plain";
    let filename = decryptedFile.filename || `Case_${caseIdInput}_Evidence.txt`;

    // Decode base64 to byte array
    const binaryString = window.atob(decryptedFile.contentBase64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    // Check if the file is actually a PDF binary (starts with "%PDF")
    const isPdfHeader =
      bytes.length >= 4 &&
      bytes[0] === 0x25 && // %
      bytes[1] === 0x50 && // P
      bytes[2] === 0x44 && // D
      bytes[3] === 0x46;   // F

    // If filename has .pdf extension but the bytes are NOT a binary PDF (e.g. plain text template),
    // rename to .txt and use text/plain so Chrome/Notepad opens it cleanly without error
    if (filename.toLowerCase().endsWith(".pdf") && !isPdfHeader) {
      filename = filename.replace(/\.pdf$/i, ".txt");
      mimeType = "text/plain";
    }

    const blob = new Blob([bytes as any], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const switchActiveCase = (cId: string) => {
    setCaseIdInput(cId);
    setCaseDetails(null);
    setZkProofResult(null);
    setZkTamperResult(null);
    setDecryptedFile(null);
    if (cId && cId.trim() !== "") {
      fetchCaseDetails(cId);
    }
  };

  const handleSelectCase = (cId: string) => {
    switchActiveCase(cId);
  };

  const handleZKVerify = async (tamper: boolean) => {
    setLoading(true);
    // Explicitly reset the opposite result so there is zero ambiguity
    if (tamper) {
      setZkTamperResult(null);
      setZkProofResult(null);
    } else {
      setZkProofResult(null);
      setZkTamperResult(null);
    }

    setStatusMsg({
      type: "info",
      text: tamper
        ? `[Case #${caseIdInput}] Testing adversarial modification: injecting altered byte into ZK prover...`
        : `[Case #${caseIdInput}] Generating Groth16 ZK proof and verifying on-chain...`,
    });

    if (isShowcaseMode) {
      await new Promise((r) => setTimeout(r, 450));
      if (tamper) {
        const simData = {
          isValid: false,
          isSimulated: true,
          isTamperRejected: true,
          error: "Circuit assertion failed: Evidence leaf does not match registered commitment for Case #" + caseIdInput,
        };
        setZkTamperResult(simData);
        setStatusMsg({
          type: "error",
          text: `❌ REJECTED: Modified file rejected for Case #${caseIdInput} (Circuit constraint: leaf does not match registered commitment). [Demonstration output]`,
        });
      } else {
        const root = caseDetails?.onChainRecord?.merkleRoot || "0x09cfb73dca0bd9c21e329880d7bbe59465e9724a2392af7650e3cd0334551bad";
        const simData = {
          isValid: true,
          isSimulated: true,
          onChainVerified: true,
          generationTimeMs: 495,
          merkleRootUsed: root,
          solidityParams: {
            a: ["0x26c04f98129a21b3...demo_piA_1", "0x07dfb918a23d87...demo_piA_2"],
            b: [
              ["0x19a04f98129a21b3...demo_piB_1", "0x09dfb918a23d87...demo_piB_2"],
              ["0x23a04f98129a21b3...demo_piB_3", "0x11dfb918a23d87...demo_piB_4"]
            ],
            c: ["0x12c04f98129a21b3...demo_piC_1", "0x18dfb918a23d87...demo_piC_2"]
          }
        };
        setZkProofResult(simData);
        setStatusMsg({
          type: "success",
          text: `✅ VALID: Evidence matches commitment registered on-chain for Case #${caseIdInput}. [Demonstration output]`,
        });
      }
      setLoading(false);
      return;
    }

    try {
      const res = await fetch("/api/verify-zk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          caseId: caseIdInput,
          tamperedContent: tamper ? "MODIFIED_TAMPERED_EVIDENCE_PAYLOAD_FOR_DEMO" : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setStatusMsg({
          type: "error",
          text: data.error || `Verification failed with HTTP ${res.status}`,
        });
        return;
      }

      if (tamper) {
        setZkTamperResult(data);
        if (!data.isValid) {
          setStatusMsg({
            type: "error",
            text: `❌ REJECTED: Modified file rejected for Case #${caseIdInput} (Circuit constraint: leaf does not match registered commitment).`,
          });
        }
      } else {
        setZkProofResult(data);
        if (data.isValid) {
          setStatusMsg({
            type: "success",
            text: `✅ VALID: Evidence matches commitment registered on-chain for Case #${caseIdInput}.`,
          });
        } else {
          setStatusMsg({
            type: "error",
            text: `❌ INVALID: Evidence proof failed on-chain verification for Case #${caseIdInput}.`,
          });
        }
      }
    } catch (err: any) {
      setStatusMsg({ type: "error", text: err.message });
    } finally {
      setLoading(false);
    }
  };

  const runFullSimulation = async () => {
    setIsAutoplaying(true);
    // Generate a fresh unique free case ID for seamless dynamic simulation
    const simCaseId = generateNextFreeCaseId();
    setRegCaseId(simCaseId);
    setCaseIdInput(simCaseId);
    setZkProofResult(null);
    setZkTamperResult(null);
    setDecryptedFile(null);
    setRegFileName(`Dynamic_Autoplay_Evidence_C${simCaseId}.pdf`);
    setRegFileContent(`DYNAMIC PROTOCOL SIMULATION EVIDENCE - CASE #${simCaseId}\nTimestamp: ${new Date().toISOString()}\nVerified: Zero-Knowledge Groth16 Snark + 2-of-3 Shamir SSSS.`);

    // Stage 1
    setCurrentStage(1);
    setStatusMsg({ type: "info", text: `▶️ Dynamic Flow Step 1: Encrypting evidence & splitting ephemeral key for Case #${simCaseId}...` });
    await handleRegister(undefined, simCaseId);
    await new Promise((r) => setTimeout(r, 1600));

    // Stage 2
    setCurrentStage(2);
    setStatusMsg({ type: "info", text: `▶️ Dynamic Flow Step 2: Constructing Poseidon Merkle Tree & committing root for Case #${simCaseId}...` });
    await new Promise((r) => setTimeout(r, 1800));

    // Stage 3
    setCurrentStage(3);
    setStatusMsg({ type: "info", text: `▶️ Dynamic Flow Step 3: Logging signed custody handoffs on-chain for Case #${simCaseId}...` });
    await handleTransferCustody();
    await new Promise((r) => setTimeout(r, 1800));

    // Stage 4
    setCurrentStage(4);
    setStatusMsg({ type: "info", text: `▶️ Dynamic Flow Step 4: Reconstructing AES key via Lagrange interpolation (2-of-3 quorum) for Case #${simCaseId}...` });
    await handleDecrypt();
    await new Promise((r) => setTimeout(r, 2000));

    // Stage 5
    setCurrentStage(5);
    setStatusMsg({ type: "info", text: `▶️ Dynamic Flow Step 5: Generating and verifying Groth16 ZK proof against on-chain root for Case #${simCaseId}...` });
    await handleZKVerify(false);
    setIsAutoplaying(false);
  };

  const isCurrentCaseAlreadyRegistered = availableCases.some((c) => c.caseId.toString() === regCaseId);
  const isCaseRegistered = !!(caseDetails?.onChainRecord?.merkleRoot);

  return (
    <div className="min-h-screen flex flex-col font-sans bg-slate-950 text-slate-100 selection:bg-cyan-500 selection:text-slate-950">
      {/* Showcase Mode Banner */}
      {((import.meta as any).env?.VITE_SHOWCASE_MODE === "true" || (typeof window !== "undefined" && window.location.hostname.includes("github.io"))) && (
        <div className="bg-gradient-to-r from-cyan-950 via-indigo-950 to-purple-950 border-b border-cyan-500/40 px-4 py-2.5 text-center text-xs text-cyan-200 flex items-center justify-center gap-2 flex-wrap">
          <span className="px-2.5 py-0.5 rounded-full bg-cyan-900/80 border border-cyan-400/60 text-cyan-200 font-bold text-[10px] uppercase tracking-wider">
            Public Showcase Mode
          </span>
          <span>
            Public Showcase Mode — Interactive demonstration using sample data. Cryptographic operations displayed here are simulated. Run the full project locally for real Circom proof generation and EVM verification. See the{" "}
            <a
              href="https://github.com/SAGANA-2006/lexvault#local-setup-and-quickstart"
              target="_blank"
              rel="noreferrer"
              className="underline text-white font-semibold hover:text-cyan-300 transition"
            >
              Local Setup Guide
            </a>.
          </span>
        </div>
      )}

      {/* Top Header */}
      <header className="border-b border-slate-800 bg-slate-950/80 backdrop-blur-xl sticky top-0 z-50 px-6 py-3.5 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-500 via-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-cyan-500/20 pulse-slow">
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-black text-slate-100 tracking-tight">LexVault</h1>
              <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-cyan-950 text-cyan-400 border border-cyan-800 font-mono font-bold">
                ZK-Groth16
              </span>
              <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-purple-950 text-purple-400 border border-purple-800 font-mono font-bold">
                Shamir SSSS
              </span>
              <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-400 border border-emerald-800 font-mono font-bold">
                EVM-Bound
              </span>
            </div>
            <p className="text-[11px] text-slate-400">Zero-Knowledge Digital Evidence Protocol &amp; Custody Ledger</p>
          </div>
        </div>

        {/* Navigation View Switcher & Case Switcher */}
        <div className="flex items-center space-x-3">
          {/* Main View Toggle */}
          <div className="flex items-center bg-slate-900/90 border border-slate-800 rounded-xl p-1 text-xs">
            <button
              onClick={() => setViewMode("pipeline")}
              className={`px-3 py-1.5 rounded-lg font-semibold transition flex items-center gap-1.5 ${
                viewMode === "pipeline"
                  ? "bg-cyan-600 text-white shadow"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <span>⚡ Evidence Journey</span>
            </button>
            <button
              onClick={() => setViewMode("registry")}
              className={`px-3 py-1.5 rounded-lg font-semibold transition flex items-center gap-1.5 ${
                viewMode === "registry"
                  ? "bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <span>📊 Case Registry &amp; Audit Explorer</span>
              {availableCases.length > 0 && (
                <span className="px-1.5 py-0.2 rounded-full bg-slate-950 text-cyan-300 text-[10px] font-mono border border-slate-700">
                  {availableCases.length}
                </span>
              )}
            </button>
          </div>

          {/* Quick Case Switcher */}
          <div className="flex items-center bg-slate-900 border border-slate-800 rounded-lg p-1 space-x-1 text-xs">
            <span className="text-slate-400 px-2">Active Case:</span>
            {availableCases.slice(0, 5).map((c) => (
              <button
                key={c.caseId}
                onClick={() => {
                  switchActiveCase(c.caseId.toString());
                  if (viewMode === "registry") setViewMode("pipeline");
                }}
                className={`px-2.5 py-1 rounded font-mono font-semibold transition ${
                  caseIdInput === c.caseId.toString()
                    ? "bg-cyan-600 text-white shadow"
                    : "text-slate-400 hover:text-slate-200 hover:bg-slate-800"
                }`}
                title={c.evidenceLabel || `Evidence Item #${c.caseId}`}
              >
                #{c.caseId}
              </button>
            ))}
            <div className="flex items-center gap-1 pl-1.5 border-l border-slate-800">
              <span className="text-[10px] text-slate-500 font-mono">#</span>
              <input
                type="number"
                placeholder="ID"
                value={caseIdInput}
                onChange={(e) => {
                  switchActiveCase(e.target.value);
                  if (viewMode === "registry") setViewMode("pipeline");
                }}
                className="w-14 px-1.5 py-0.5 rounded bg-slate-950 border border-slate-700 text-cyan-300 font-mono text-xs focus:outline-none focus:border-cyan-500 text-center"
                title="Type any case ID (e.g. 107) to test unregistered gating"
              />
            </div>
            <button
              onClick={() => {
                const nextId = generateNextFreeCaseId();
                handleRegCaseIdChange(nextId);
                setViewMode("pipeline");
                setCurrentStage(1);
              }}
              className="px-2.5 py-1 rounded font-mono font-semibold text-emerald-400 hover:bg-emerald-950/50 border border-emerald-800/60 transition"
              title="Register a brand new case"
            >
              + New Case
            </button>
          </div>

          {/* Assistant Tools Modals Trigger Buttons */}
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setIsTourOpen(true)}
              className="px-2.5 py-1.5 rounded-xl bg-cyan-950/90 border border-cyan-700/80 text-cyan-300 text-xs font-semibold hover:bg-cyan-900 transition flex items-center gap-1 shadow-sm"
              title="Start Interactive 8-Step Security Walkthrough Tour"
            >
              <span>🧭 Tour</span>
            </button>
            <button
              onClick={() => setIsFeatureMapOpen(true)}
              className="px-2.5 py-1.5 rounded-xl bg-indigo-950/90 border border-indigo-700/80 text-indigo-300 text-xs font-semibold hover:bg-indigo-900 transition flex items-center gap-1 shadow-sm"
              title="View Complete Cryptographic Feature Map"
            >
              <span>🗺️ Feature Map</span>
            </button>
            <button
              onClick={() => setIsGlossaryOpen(true)}
              className="px-2.5 py-1.5 rounded-xl bg-slate-900 border border-slate-700 text-slate-300 text-xs font-semibold hover:bg-slate-800 transition flex items-center gap-1 shadow-sm"
              title="Beginner & Evaluator Glossary"
            >
              <span>📖 Glossary</span>
            </button>
            <button
              onClick={() => setIsCryptoReceiptOpen(true)}
              className="px-2.5 py-1.5 rounded-xl bg-purple-950/90 border border-purple-700/80 text-purple-300 text-xs font-semibold hover:bg-purple-900 transition flex items-center gap-1 shadow-sm"
              title="Inspect Case Cryptographic Processing Receipt"
            >
              <span>🧾 Receipt</span>
            </button>
          </div>

          <button
            onClick={runFullSimulation}
            disabled={loading || isAutoplaying}
            className="px-4 py-2 rounded-xl bg-gradient-to-r from-cyan-600 via-indigo-600 to-purple-600 text-white text-xs font-bold shadow-lg shadow-indigo-500/20 hover:scale-105 transition flex items-center gap-2 border border-indigo-400/30"
          >
            <span>{isAutoplaying ? "⚡ Simulating Flow..." : "▶️ Autoplay Full Dynamic Flow"}</span>
          </button>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-6 space-y-6">
        {/* Top-Level Prominent Explanation & Security Boundaries */}
        <SecurityBoundariesBox />

        {/* 7-Stage Interactive Evidence Security Lifecycle Bar */}
        <EvidenceLifecycleBar
          currentStage={currentStage}
          onSelectStage={handleNavigateToStage}
        />

        {viewMode === "registry" ? (
          <CaseRegistryDashboard
            cases={availableCases}
            loading={loading}
            onRefresh={fetchAvailableCases}
            onSelectCaseForJourney={(selectedId) => {
              switchActiveCase(selectedId.toString());
              setViewMode("pipeline");
              setCurrentStage(1);
            }}
          />
        ) : (
          <>
            {/* Dynamic Flow Pipeline Navigator */}
            <section className="glass-panel rounded-2xl p-4 space-y-3 border border-slate-800">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-ping"></span>
                  <h2 className="text-xs uppercase font-bold text-slate-300 tracking-wider">
                    Evidence Cryptographic Pipeline Journey (Case #{caseIdInput})
                  </h2>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <button
                    onClick={() => setCurrentStage(Math.max(1, currentStage - 1) as Stage)}
                    disabled={currentStage === 1}
                    className="px-3 py-1 rounded bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-200 disabled:opacity-30"
                  >
                    ◀ Prev
                  </button>
                  <button
                    onClick={() => setCurrentStage(Math.min(5, currentStage + 1) as Stage)}
                    disabled={currentStage === 5}
                    className="px-3 py-1 rounded bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-200 disabled:opacity-30"
                  >
                    Next ▶
                  </button>
                </div>
              </div>

              {/* 5-Stage Interactive Flow Ribbon */}
              <div className="grid grid-cols-1 md:grid-cols-5 gap-2 pt-1">
                {[
                  { id: 1, label: "1. Ingest & Split Key", desc: "Web Crypto + Shamir SSSS", icon: "🔍" },
                  { id: 2, label: "2. Merkle Root Commit", desc: "Poseidon Binary Tree (Depth 3)", icon: "🌳" },
                  { id: 3, label: "3. Custody Chain", desc: "Ledger-Authenticated Log", icon: "⛓️" },
                  { id: 4, label: "4. Shamir Key Chamber", desc: "2-of-3 Lagrange Decrypt", icon: "🔑" },
                  { id: 5, label: "5. ZK Verification Arena", desc: "Groth16 Verifier & Defense", icon: "⚖️" },
                ].map((st) => (
                  <button
                    key={st.id}
                    onClick={() => setCurrentStage(st.id as Stage)}
                    className={`p-3 rounded-xl text-left transition-all relative overflow-hidden border ${
                      currentStage === st.id
                        ? "bg-gradient-to-b from-slate-900 to-slate-950 border-cyan-500 shadow-lg shadow-cyan-500/10 scale-[1.02]"
                        : currentStage > st.id
                        ? "bg-slate-950/60 border-emerald-900 text-slate-400 hover:border-slate-700"
                        : "bg-slate-950/40 border-slate-800 text-slate-500 hover:border-slate-700"
                    }`}
                  >
                    {currentStage === st.id && (
                      <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-cyan-500 via-indigo-500 to-purple-500"></div>
                    )}
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-base">{st.icon}</span>
                      <span
                        className={`text-[10px] px-1.5 py-0.5 rounded font-mono font-bold ${
                          currentStage === st.id
                            ? "bg-cyan-950 text-cyan-400 border border-cyan-800"
                            : currentStage > st.id
                            ? "bg-emerald-950 text-emerald-400"
                            : "bg-slate-900 text-slate-500"
                        }`}
                      >
                        {currentStage > st.id ? "✓ Done" : currentStage === st.id ? "Active" : `Stage ${st.id}`}
                      </span>
                    </div>
                    <div className="text-xs font-bold text-slate-200 truncate">{st.label}</div>
                    <div className="text-[10px] text-slate-400 truncate">{st.desc}</div>
                  </button>
                ))}
              </div>
            </section>

        {/* Global Notification Banner */}
        {statusMsg && (
          <div
            className={`p-4 rounded-xl border text-xs flex items-center justify-between ${
              statusMsg.type === "success"
                ? "bg-emerald-950/70 border-emerald-800 text-emerald-300"
                : statusMsg.type === "error"
                ? "bg-rose-950/70 border-rose-800 text-rose-300"
                : "bg-cyan-950/70 border-cyan-800 text-cyan-300"
            }`}
          >
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-base">{statusMsg.type === "success" ? "🎉" : statusMsg.type === "error" ? "⚠️" : "⚡"}</span>
              <span className="font-medium">{statusMsg.text}</span>
              {statusMsg.suggestedCaseId && (
                <button
                  type="button"
                  onClick={() => {
                    setRegCaseId(statusMsg.suggestedCaseId!.toString());
                    setStatusMsg(null);
                  }}
                  className="px-2.5 py-1 rounded bg-rose-900/80 hover:bg-rose-800 text-white font-bold text-[11px] ml-2 transition border border-rose-700"
                >
                  ✨ Switch to Next Free ID: #{statusMsg.suggestedCaseId}
                </button>
              )}
            </div>
            <button onClick={() => setStatusMsg(null)} className="opacity-60 hover:opacity-100 text-xs underline ml-4">
              Dismiss
            </button>
          </div>
        )}

        {/* STAGE 1: CLIENT INGESTION & SHAMIR 2-OF-3 KEY SPLITTING */}
        {currentStage === 1 && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div id="register-evidence" className="lg:col-span-7 glass-panel rounded-2xl p-6 space-y-4 border border-slate-800">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
                    <span>🔍 Stage 1: Client Ingestion &amp; Shamir 2-of-3 Key Splitting</span>
                  </h3>
                  <p className="text-xs text-slate-400">
                    Generates a random ephemeral 254-bit AES key in the scalar field, splits the key into 3 polynomial shares, and hashes evidence directly in the browser.
                  </p>
                </div>
                <span className="text-[10px] px-2.5 py-1 rounded-full bg-cyan-950 text-cyan-400 border border-cyan-800 font-mono">
                  Zero Static Keys
                </span>
              </div>

              {/* Sample Template Quick Fill */}
              <div className="flex items-center gap-2 pt-1 pb-1">
                <span className="text-[11px] text-slate-400">Sample Templates:</span>
                <button
                  type="button"
                  onClick={() => setSampleTemplate("ballistics")}
                  className="px-2 py-1 rounded bg-slate-900 border border-slate-800 text-[11px] text-cyan-400 hover:bg-slate-800"
                >
                  🧬 DNA Ballistics
                </button>
                <button
                  type="button"
                  onClick={() => setSampleTemplate("cctv")}
                  className="px-2 py-1 rounded bg-slate-900 border border-slate-800 text-[11px] text-indigo-400 hover:bg-slate-800"
                >
                  📹 CCTV Video Log
                </button>
                <button
                  type="button"
                  onClick={() => setSampleTemplate("contract")}
                  className="px-2 py-1 rounded bg-slate-900 border border-slate-800 text-[11px] text-purple-400 hover:bg-slate-800"
                >
                  📑 Audit Document
                </button>
              </div>

              <form onSubmit={handleRegister} className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-[11px] text-slate-400 block">Target Case ID #</label>
                      <button
                        type="button"
                        onClick={() => handleRegCaseIdChange(generateNextFreeCaseId())}
                        className="text-[10px] text-cyan-400 hover:text-cyan-300 font-mono underline"
                      >
                        🎲 Next Free ID
                      </button>
                    </div>
                    <input
                      type="number"
                      value={regCaseId}
                      onChange={(e) => handleRegCaseIdChange(e.target.value)}
                      className={`w-full px-3 py-2 rounded-lg bg-slate-950 border text-slate-200 text-xs font-mono ${
                        isCurrentCaseAlreadyRegistered ? "border-amber-500/60 focus:border-amber-400" : "border-slate-700"
                      }`}
                      required
                    />
                    {isCurrentCaseAlreadyRegistered && (
                      <p className="text-[10px] text-amber-400 mt-1 flex items-center gap-1">
                        <span>⚠️ Case #{regCaseId} is already on-chain.</span>
                        <button
                          type="button"
                          onClick={() => handleRegCaseIdChange(generateNextFreeCaseId())}
                          className="underline font-bold hover:text-amber-300"
                        >
                          Auto-pick next free ID
                        </button>
                      </p>
                    )}
                  </div>
                  <div>
                    <label className="text-[11px] text-slate-400 block mb-1">Evidence Filename</label>
                    <input
                      type="text"
                      value={regFileName}
                      onChange={(e) => setRegFileName(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-slate-200 text-xs"
                      required
                    />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[11px] text-slate-400">Evidence Content</label>
                    <div className="flex space-x-2 text-[10px]">
                      <button
                        type="button"
                        onClick={() => setInputType("text")}
                        className={`px-2 py-0.5 rounded ${inputType === "text" ? "bg-cyan-950 text-cyan-300 border border-cyan-800" : "text-slate-500"}`}
                      >
                        Text
                      </button>
                      <button
                        type="button"
                        onClick={() => setInputType("file")}
                        className={`px-2 py-0.5 rounded ${inputType === "file" ? "bg-cyan-950 text-cyan-300 border border-cyan-800" : "text-slate-500"}`}
                      >
                        Upload File
                      </button>
                    </div>
                  </div>

                  {inputType === "text" ? (
                    <textarea
                      rows={3}
                      value={regFileContent}
                      onChange={(e) => setRegFileContent(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-slate-200 text-xs font-mono"
                      required
                    />
                  ) : (
                    <input
                      type="file"
                      onChange={handleFileUploadChange}
                      className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-slate-200 text-xs file:mr-3 file:py-1 file:px-3 file:rounded file:border-0 file:bg-cyan-900 file:text-cyan-200"
                    />
                  )}
                </div>

                <div className="flex items-center gap-3 pt-2">
                  <button
                    type="submit"
                    disabled={loading}
                    className="flex-1 py-3 rounded-xl bg-gradient-to-r from-cyan-600 to-indigo-600 text-white font-bold text-xs hover:from-cyan-500 hover:to-indigo-500 transition shadow-lg shadow-cyan-500/20 disabled:opacity-50"
                  >
                    {loading ? "Encrypting & Registering..." : "🔒 Client Encrypt, Split Key & Commit"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setCurrentStage(2)}
                    className="px-4 py-3 rounded-xl bg-slate-900 border border-slate-700 text-slate-300 text-xs font-semibold hover:bg-slate-800"
                  >
                    View Merkle Tree ➔
                  </button>
                </div>
              </form>
            </div>

            {/* Stage 1 Telemetry Panel */}
            <div id="crypto-receipt" className="lg:col-span-5 space-y-4">
              <div className="glass-panel rounded-2xl p-5 space-y-3 border border-slate-800">
                <h4 className="text-xs font-bold text-cyan-400 uppercase tracking-wider flex items-center justify-between">
                  <span>⚡ In-Browser Cryptographic State</span>
                  <span className="text-[10px] text-emerald-400 font-mono">0 plaintext sent</span>
                </h4>

                <div className="space-y-2 text-xs font-mono">
                  <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800">
                    <span className="text-slate-500 block text-[10px]">SHA-256 Digest:</span>
                    <span className="text-slate-300 break-all text-[11px]">{clientTelemetry?.sha256Hex || "computing..."}</span>
                  </div>

                  <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800">
                    <span className="text-slate-500 block text-[10px]">Scalar Field Leaf (BN128 mod r):</span>
                    <span className="text-cyan-300 break-all text-[11px]">{clientTelemetry?.leafFieldElement || "computing..."}</span>
                  </div>

                  <div className="p-2.5 rounded-lg bg-slate-950 border border-purple-800/50 space-y-1">
                    <span className="text-purple-300 font-bold block text-[10px]">Shamir 2-of-3 Polynomial Shares $f(x) = K + a_1 x$:</span>
                    <div className="text-[10px] text-slate-400">
                      Investigator ($x=1$): <span className="text-purple-300">{clientTelemetry?.keyShares?.["Investigator"]?.slice(0, 16) || "generated on commit"}...</span>
                    </div>
                    <div className="text-[10px] text-slate-400">
                      Forensic ($x=2$): <span className="text-purple-300">{clientTelemetry?.keyShares?.["Forensic Officer"]?.slice(0, 16) || "generated on commit"}...</span>
                    </div>
                    <div className="text-[10px] text-slate-400">
                      Court ($x=3$): <span className="text-purple-300">{clientTelemetry?.keyShares?.["Court Reviewer"]?.slice(0, 16) || "generated on commit"}...</span>
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setIsCryptoReceiptOpen(true)}
                  className="w-full py-2.5 px-3 rounded-xl bg-gradient-to-r from-purple-950/80 to-indigo-950/80 border border-purple-600/60 text-purple-200 text-xs font-bold hover:border-purple-400 transition flex items-center justify-center gap-2 shadow-md shadow-purple-950/40 mt-3"
                >
                  <span>🧾 View Cryptographic Processing Receipt</span>
                  <span>→</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* STAGE 2: POSEIDON MERKLE TREE VISUALIZER */}
        {currentStage === 2 && (
          !isCaseRegistered ? (
            <UnregisteredCaseNotice
              caseId={caseIdInput}
              onGoToRegister={() => {
                setRegCaseId(caseIdInput);
                setCurrentStage(1);
              }}
              availableCases={availableCases}
              onSwitchCase={switchActiveCase}
            />
          ) : (
          <div id="merkle-anchor" className="glass-panel rounded-2xl p-6 space-y-6 border border-slate-800">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
                  <span>🌳 Stage 2: Poseidon Merkle Tree Visualizer &amp; EVM State Binding</span>
                </h3>
                <p className="text-xs text-slate-400">
                  Evidence Leaf 0 is combined with 7 dummy leaves over 3 Poseidon hashing layers to yield a single public on-chain root for Case #{caseIdInput}.
                </p>
              </div>
              <span className="text-xs font-mono text-cyan-400 bg-cyan-950 border border-cyan-800 px-3 py-1 rounded-full">
                Tree Depth = 3 (8 Leaves)
              </span>
            </div>

            {/* Tree Graphical Representation */}
            <div className="p-6 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-6">
              {/* Root Level */}
              <div className="flex flex-col items-center">
                <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wider mb-1">EVM Registered Merkle Root (Level 3)</span>
                <div className="p-3 rounded-xl bg-gradient-to-r from-cyan-950 via-slate-900 to-indigo-950 border border-cyan-500 text-xs font-mono text-cyan-300 text-center max-w-xl w-full shadow-lg shadow-cyan-500/10">
                  {caseDetails?.onChainRecord?.merkleRoot || regResult?.merkleRootHex || "0x2ffb04087499a5055c58678f454c328e51faff2a1d7ba4f3f64a5213c9154dfa"}
                </div>
                <div className="w-0.5 h-6 bg-slate-700 mt-1"></div>
              </div>

              {/* Layer 2 */}
              <div className="grid grid-cols-2 gap-8 max-w-3xl mx-auto">
                <div className="p-2.5 rounded-lg bg-slate-900/80 border border-slate-800 text-[11px] font-mono text-center text-slate-400">
                  Poseidon Node Left [0..3]
                </div>
                <div className="p-2.5 rounded-lg bg-slate-900/80 border border-slate-800 text-[11px] font-mono text-center text-slate-400">
                  Poseidon Node Right [4..7]
                </div>
              </div>

              {/* Leaf Layer (8 Leaves) */}
              <div className="space-y-2">
                <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wider block text-center">
                  Tree Leaves (Level 0)
                </span>
                <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2">
                  <div className="p-2.5 rounded-xl bg-cyan-950/70 border-2 border-cyan-500 text-center space-y-1">
                    <span className="text-[9px] uppercase font-bold text-cyan-300 block">Leaf 0 (Evidence)</span>
                    <span className="text-[10px] text-slate-200 font-mono block truncate">
                      {regResult?.leafFieldElement?.slice(0, 8) || "Private Leaf"}...
                    </span>
                    <span className="text-[9px] text-cyan-400 block font-bold">★ Active Case</span>
                  </div>

                  {[1, 2, 3, 4, 5, 6, 7].map((i) => (
                    <div key={i} className="p-2.5 rounded-xl bg-slate-900/60 border border-slate-800 text-center space-y-1 text-slate-500">
                      <span className="text-[9px] uppercase font-semibold block">Leaf {i} (Dummy)</span>
                      <span className="text-[10px] font-mono block truncate">dummy_{i}..</span>
                      <span className="text-[9px] text-slate-600 block">Padded mod r</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex justify-between items-center pt-2">
              <button
                onClick={() => setCurrentStage(1)}
                className="px-4 py-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 text-xs hover:text-slate-200"
              >
                ◀ Back to Ingestion
              </button>
              <button
                onClick={() => setCurrentStage(3)}
                className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-cyan-600 to-indigo-600 text-white text-xs font-bold shadow-lg shadow-cyan-500/20"
              >
                Proceed to Custody Chain ➔
              </button>
            </div>
          </div>
          )
        )}

        {/* STAGE 3: SIGNED DIGITAL CUSTODY CHAIN */}
        {currentStage === 3 && (
          !isCaseRegistered ? (
            <UnregisteredCaseNotice
              caseId={caseIdInput}
              onGoToRegister={() => {
                setRegCaseId(caseIdInput);
                setCurrentStage(1);
              }}
              availableCases={availableCases}
              onSwitchCase={switchActiveCase}
            />
          ) : (
          <div id="custody-transfer" className="glass-panel rounded-2xl p-6 space-y-6 border border-slate-800">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
                  <span>⛓️ Stage 3: Signed Digital Custody Chain &amp; Audit Log</span>
                </h3>
                <p className="text-xs text-slate-400">
                  Every evidence custody handoff emits a timestamped on-chain event (<code className="text-cyan-300 font-mono">CustodyTransferred</code>) on the EVM ledger.
                </p>
              </div>
              <span className="text-xs font-mono text-emerald-400 bg-emerald-950 border border-emerald-800 px-3 py-1 rounded-full">
                Active Case #{caseIdInput}
              </span>
            </div>

            {/* Provenance Status Checklist & Security Events for Active Case */}
            {caseIdInput && !isNaN(parseInt(caseIdInput)) && (
              <ProvenanceStatusChecklistView caseId={parseInt(caseIdInput)} />
            )}

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Custody Timeline */}
              <div className="lg:col-span-7 space-y-3">
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Immutable Custody Timeline</h4>
                {caseDetails?.custodyHistory && caseDetails.custodyHistory.length > 0 ? (
                  <div className="space-y-3">
                    {caseDetails.custodyHistory.map((h: any, idx: number) => (
                      <div
                        key={idx}
                        className="p-4 rounded-xl bg-slate-950 border border-slate-800 flex items-start justify-between relative pl-6 before:absolute before:left-2.5 before:top-6 before:bottom-0 before:w-0.5 before:bg-cyan-900"
                      >
                        <div className="space-y-1">
                          <div className="text-xs text-cyan-400 font-mono flex items-center gap-2 font-bold">
                            <span>From: {h.from.slice(0, 8)}...</span>
                            <span>➔</span>
                            <span>To: {h.to.slice(0, 8)}...</span>
                          </div>
                          <div className="text-[10px] text-slate-500 font-mono">
                            Timestamp: {new Date(h.timestamp * 1000).toLocaleString()}
                          </div>
                          <div className="text-[10px] text-slate-400 font-mono truncate max-w-sm">
                            Sig: {h.signature.slice(0, 32)}...
                          </div>
                        </div>
                        <span className="text-[10px] px-2.5 py-1 rounded-full bg-emerald-950 text-emerald-400 border border-emerald-800 font-mono font-bold">
                          EVM Event #{idx + 1}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-6 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-500 text-center">
                    No custody handoffs recorded yet for Case #{caseIdInput}.
                  </div>
                )}
              </div>

              {/* Interactive Transfer Form */}
              <div className="lg:col-span-5 p-5 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
                <h4 className="text-xs font-bold text-slate-200">Sign &amp; Record Next Custody Handoff</h4>
                <form onSubmit={handleTransferCustody} className="space-y-3">
                  <div>
                    <label className="text-[11px] text-slate-400 block mb-1">Transferring Role</label>
                    <select
                      value={transferFromRole}
                      onChange={(e) => setTransferFromRole(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-xs text-slate-200"
                    >
                      <option value="Investigator">🔍 Investigator</option>
                      <option value="Forensic Officer">🔬 Forensic Officer</option>
                      <option value="Court Reviewer">🏛️ Court Reviewer</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-[11px] text-slate-400 block mb-1">Recipient Custodian Address</label>
                    <input
                      type="text"
                      value={transferToAddress}
                      onChange={(e) => setTransferToAddress(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-xs font-mono text-slate-200"
                      required
                    />
                  </div>

                  <div>
                    <label className="text-[11px] text-slate-400 block mb-1">Transfer Reason / Chain Note</label>
                    <input
                      type="text"
                      value={transferReason}
                      onChange={(e) => setTransferReason(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-xs text-slate-200"
                      required
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-2.5 rounded-xl bg-gradient-to-r from-cyan-600 to-indigo-600 text-white font-bold text-xs hover:from-cyan-500 hover:to-indigo-500 transition shadow-lg shadow-cyan-500/20"
                  >
                    {loading ? "Recording On-Chain..." : "✍️ Sign & Append Custody Event"}
                  </button>
                </form>
              </div>
            </div>

            <div className="flex justify-between items-center pt-2">
              <button
                onClick={() => setCurrentStage(2)}
                className="px-4 py-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 text-xs hover:text-slate-200"
              >
                ◀ Back to Merkle Tree
              </button>
              <button
                onClick={() => setCurrentStage(4)}
                className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-cyan-600 to-indigo-600 text-white text-xs font-bold shadow-lg shadow-cyan-500/20"
              >
                Proceed to Shamir Key Chamber ➔
              </button>
            </div>
          </div>
          )
        )}

        {/* STAGE 4: SHAMIR 2-OF-3 KEY ASSEMBLY CHAMBER */}
        {currentStage === 4 && (
          !isCaseRegistered ? (
            <UnregisteredCaseNotice
              caseId={caseIdInput}
              onGoToRegister={() => {
                setRegCaseId(caseIdInput);
                setCurrentStage(1);
              }}
              availableCases={availableCases}
              onSwitchCase={switchActiveCase}
            />
          ) : (
          <div id="threshold-decryption" className="glass-panel rounded-2xl p-6 space-y-6 border border-slate-800">
            {/* 2-of-3 Shamir Quorum Counter & Verification vs Decryption Boundary */}
            <ShamirQuorumCounter
              approvals={engagedShares}
              selectedRole={activeRoleForDecryption}
              isInternRejected={activeRoleForDecryption === "Intern"}
            />

            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
                  <span>🔑 Stage 4: Off-Chain 2-of-3 Threshold Approval &amp; Key Assembly</span>
                </h3>
                <p className="text-xs text-slate-400">
                  Decryption requires polynomial shares from at least 2 distinct roles for Case #{caseIdInput} to reconstruct $K$ via Lagrange interpolation.
                </p>
              </div>
              <span className={`text-xs px-3 py-1 rounded-full border ${activeRoleForDecryption === "Intern" ? "bg-rose-950 text-rose-400 border-rose-800" : "bg-purple-950 text-purple-400 border-purple-800"}`}>
                Requester Role: {activeRoleForDecryption}
              </span>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Role Share Key Selectors */}
              <div className="lg:col-span-6 space-y-4">
                <h4 className="text-xs font-bold text-slate-300">Engage Participant Polynomial Shares</h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {[
                    { name: "Investigator", x: "1", color: "cyan" },
                    { name: "Forensic Officer", x: "2", color: "indigo" },
                    { name: "Court Reviewer", x: "3", color: "purple" },
                  ].map((r) => {
                    const isEngaged = engagedShares.includes(r.name);
                    return (
                      <button
                        key={r.name}
                        type="button"
                        onClick={() => {
                          if (isEngaged) setEngagedShares(engagedShares.filter((s) => s !== r.name));
                          else setEngagedShares([...engagedShares, r.name]);
                        }}
                        className={`p-3 rounded-xl border text-left transition ${
                          isEngaged
                            ? "bg-gradient-to-b from-purple-950/60 to-slate-950 border-purple-500 shadow-md shadow-purple-500/20"
                            : "bg-slate-950 border-slate-800 text-slate-500 hover:border-slate-700"
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-bold text-slate-200">{r.name}</span>
                          <span className={`text-[10px] px-1.5 py-0.5 rounded ${isEngaged ? "bg-purple-900 text-purple-200" : "bg-slate-900 text-slate-600"}`}>
                            {isEngaged ? "ACTIVE" : "OFF"}
                          </span>
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono">Share s_{r.x} (x = {r.x})</div>
                      </button>
                    );
                  })}
                </div>

                {/* Role Clearance Override Selector */}
                <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between">
                  <span className="text-xs text-slate-400">Caller Role Clearance:</span>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setActiveRoleForDecryption("Court Reviewer")}
                      className={`text-xs px-2.5 py-1 rounded ${activeRoleForDecryption === "Court Reviewer" ? "bg-cyan-950 text-cyan-300 border border-cyan-800" : "text-slate-500"}`}
                    >
                      🏛️ Authorized (Court)
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveRoleForDecryption("Intern")}
                      className={`text-xs px-2.5 py-1 rounded ${activeRoleForDecryption === "Intern" ? "bg-rose-950 text-rose-300 border border-rose-800" : "text-slate-500"}`}
                    >
                      🚫 Unauthorized (Intern)
                    </button>
                  </div>
                </div>

                {/* Mathematical Quorum Formula Display */}
                <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
                  <div className="flex items-center justify-between text-[11px] font-bold">
                    <span className="text-slate-400">Lagrange Quorum Formula:</span>
                    <span className={engagedShares.length >= 2 ? "text-emerald-400" : "text-amber-400"}>
                      {engagedShares.length >= 2 ? "✓ Quorum Satisfied (≥2 Shares)" : "⚠️ Quorum Insufficient (<2 Shares)"}
                    </span>
                  </div>
                  <div className="text-[10px] font-mono text-purple-300 break-all">
                    K = Σ s_i · L_i(0) mod p = (s_a · L_a(0) + s_b · L_b(0)) mod p
                  </div>
                </div>

                <button
                  onClick={handleDecrypt}
                  disabled={loading}
                  className={`w-full py-3 rounded-xl font-bold text-xs transition shadow-lg ${
                    activeRoleForDecryption === "Intern"
                      ? "bg-rose-600 hover:bg-rose-500 text-white shadow-rose-500/20"
                      : "bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-500/20"
                  }`}
                >
                  {loading ? "Solving Lagrange Interpolation..." : `Attempt Key Reconstruction & Decryption`}
                </button>
              </div>

              {/* Decrypted Output Chamber */}
              <div className="lg:col-span-6 p-5 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
                <h4 className="text-xs font-bold text-slate-200">Decrypted Evidence Payload</h4>
                {decryptedFile ? (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-xs text-emerald-400 font-bold flex-wrap gap-2">
                      <span className="truncate max-w-xs">Document: {decryptedFile.filename}</span>
                      <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-950 border border-emerald-800 font-mono">
                        Reconstructed from {decryptedFile.shamirSharesUsed || 2} Shares
                      </span>
                    </div>

                    {/* Image Preview if image MIME / extension */}
                    {decryptedFile.mimeType?.startsWith("image/") || decryptedFile.filename.match(/\.(png|jpe?g|webp|gif|svg)$/i) ? (
                      <div className="space-y-2">
                        <div className="text-[11px] text-slate-400">Decrypted Image Preview:</div>
                        <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center max-h-80 overflow-hidden">
                          <img
                            src={`data:${decryptedFile.mimeType || "image/png"};base64,${decryptedFile.contentBase64}`}
                            alt="Decrypted Evidence"
                            className="max-h-72 object-contain rounded-lg shadow-lg border border-slate-700"
                          />
                        </div>
                      </div>
                    ) : (
                      <div className="p-3.5 rounded-lg bg-slate-900 border border-slate-800 text-xs font-mono text-slate-200 whitespace-pre-wrap max-h-60 overflow-y-auto">
                        {decryptedFile.contentUtf8}
                      </div>
                    )}

                    <div className="flex items-center justify-between pt-1 flex-wrap gap-2">
                      <span className="text-[10px] text-slate-500 font-mono">
                        MIME: {decryptedFile.mimeType || "text/plain"}
                      </span>
                      <div className="flex items-center gap-2">
                        {decryptedFile.contentUtf8 && (
                          <button
                            type="button"
                            onClick={() => {
                              navigator.clipboard.writeText(decryptedFile.contentUtf8);
                              setStatusMsg({ type: "success", text: "📋 Decrypted text copied to clipboard!" });
                            }}
                            className="px-3 py-1 rounded bg-slate-900 border border-slate-700 text-slate-300 text-xs hover:text-white transition"
                          >
                            📋 Copy Text
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={downloadDecryptedFile}
                          className="px-3 py-1 rounded bg-cyan-900/80 border border-cyan-700 text-cyan-200 text-xs hover:bg-cyan-800 transition font-semibold flex items-center gap-1"
                        >
                          📥 Download File
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="h-44 flex flex-col items-center justify-center text-slate-500 text-xs text-center border border-dashed border-slate-800 rounded-lg p-4">
                    <svg className="w-8 h-8 mb-2 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                    Engage at least 2 role keys and click "Attempt Key Reconstruction" to decrypt.
                  </div>
                )}
              </div>
            </div>

            <div className="flex justify-between items-center pt-2">
              <button
                onClick={() => setCurrentStage(3)}
                className="px-4 py-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 text-xs hover:text-slate-200"
              >
                ◀ Back to Custody Chain
              </button>
              <button
                onClick={() => setCurrentStage(5)}
                className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-cyan-600 to-indigo-600 text-white text-xs font-bold shadow-lg shadow-cyan-500/20"
              >
                Proceed to ZK Verification Arena ➔
              </button>
            </div>
          </div>
          )
        )}

        {/* STAGE 5: ADVERSARIAL ZK-SNARK VERIFICATION ARENA */}
        {currentStage === 5 && (
          !isCaseRegistered ? (
            <UnregisteredCaseNotice
              caseId={caseIdInput}
              onGoToRegister={() => {
                setRegCaseId(caseIdInput);
                setCurrentStage(1);
              }}
              availableCases={availableCases}
              onSwitchCase={switchActiveCase}
            />
          ) : (
          <div id="zk-verification" className="glass-panel rounded-2xl p-6 space-y-6 border border-slate-800">
            {/* Header & Mode Switcher */}
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
                    <span>⚖️ Stage 5: Zero-Knowledge Verification Arena</span>
                  </h3>
                  <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-cyan-950 text-cyan-300 border border-cyan-800 font-mono font-bold">
                    Public Verification Mode
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-0.5">
                  Anyone can confirm evidence is registered and unaltered for Case #{caseIdInput} — <strong className="text-cyan-300">no credentials, login, or role clearance required</strong>.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowCircuitInspector(!showCircuitInspector)}
                  className={`px-3 py-1.5 rounded-xl border text-xs font-mono font-semibold transition flex items-center gap-1.5 ${
                    showCircuitInspector
                      ? "bg-purple-900/60 border-purple-500 text-purple-200 shadow-md shadow-purple-500/20"
                      : "bg-slate-900 border-slate-700 text-slate-300 hover:text-white"
                  }`}
                >
                  <span>🔬 Circuit Inspector ({circuitInfo?.constraintCount || 1560} R1CS)</span>
                  <span className="text-[10px]">{showCircuitInspector ? "▲" : "▼"}</span>
                </button>
                <span className="text-xs font-mono text-purple-400 bg-purple-950 border border-purple-800 px-3 py-1 rounded-full">
                  Groth16 Verifier
                </span>
              </div>
            </div>

            {/* Public Verification Mode Banner & Non-Guarantee Disclaimer */}
            <div className="p-4 rounded-xl bg-cyan-950/30 border border-cyan-800/60 space-y-1.5 text-xs">
              <div className="flex items-center gap-2 text-cyan-300 font-bold">
                <span>🌐 Public Verification Protocol:</span>
                <span className="text-[10px] px-2 py-0.2 rounded bg-cyan-900/60 text-cyan-200 font-mono font-normal">
                  Open Judicial &amp; Public Audit
                </span>
              </div>
              <p className="text-slate-300 leading-relaxed text-[11px]">
                This mode allows any member of the public, defense counsel, or independent auditor to generate and verify a Groth16 zk-SNARK proof against the EVM smart contract without holding Shamir key shares or opening confidential files.
              </p>
              <div className="text-[10px] text-amber-300/90 pt-1 border-t border-cyan-900/60 flex items-center gap-1.5">
                <span>⚠️</span>
                <span><strong>Scope Disclaimer:</strong> Public verification proves mathematical Merkle tree membership and cryptographic integrity only. It does not independently assert factual truthfulness or standalone legal admissibility.</span>
              </div>
            </div>

            {/* Comprehensive ZK Architecture & Circom Signal Flow Viewer */}
            <ZKArchitectureViewer
              generationTimeMs={zkProofResult?.generationTimeMs}
              isValid={zkProofResult?.isValid}
              onChainVerified={zkProofResult?.onChainVerified}
              merkleRootUsed={zkProofResult?.merkleRootUsed || caseDetails?.onChainRecord?.merkleRoot}
              isTamperTest={!!zkTamperResult}
            />

            {/* Circuit Inspector Panel (Collapsible) */}
            {showCircuitInspector && (
              <div className="p-5 rounded-2xl bg-purple-950/20 border border-purple-700/60 space-y-4 animate-fadeIn">
                <div className="flex items-center justify-between border-b border-purple-900/60 pb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-base">🔬</span>
                    <div>
                      <h4 className="text-xs font-bold text-purple-200 uppercase tracking-wider">
                        Compiled Circuit Inspector (evidence_verifier.circom)
                      </h4>
                      <p className="text-[11px] text-purple-300/70">
                        Live metadata verified from compiled <code className="text-purple-300">evidence_verifier.r1cs</code> and verification keys.
                      </p>
                    </div>
                  </div>
                  <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-purple-950 text-purple-300 border border-purple-700 font-mono font-bold">
                    BN128 / alt_bn128
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                  <div className="p-3 rounded-xl bg-slate-950/80 border border-purple-900/50">
                    <div className="text-[10px] text-slate-400 uppercase font-bold">R1CS Constraints</div>
                    <div className="text-base font-black text-cyan-400 font-mono mt-0.5">
                      {circuitInfo?.constraintCount ? circuitInfo.constraintCount.toLocaleString() : "1,560"}
                    </div>
                    <div className="text-[9px] text-slate-500">Verified snarkjs count</div>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-950/80 border border-purple-900/50">
                    <div className="text-[10px] text-slate-400 uppercase font-bold">Total Wires</div>
                    <div className="text-base font-black text-purple-300 font-mono mt-0.5">
                      {circuitInfo?.wires ? circuitInfo.wires.toLocaleString() : "1,568"}
                    </div>
                    <div className="text-[9px] text-slate-500">Constraint linear combinations</div>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-950/80 border border-purple-900/50">
                    <div className="text-[10px] text-slate-400 uppercase font-bold">Public Signals</div>
                    <div className="text-base font-black text-emerald-400 font-mono mt-0.5">
                      {circuitInfo?.publicInputsCount || 1} (merkleRoot)
                    </div>
                    <div className="text-[9px] text-slate-500">On-chain ledger input</div>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-950/80 border border-purple-900/50">
                    <div className="text-[10px] text-slate-400 uppercase font-bold">Private Signals</div>
                    <div className="text-base font-black text-amber-400 font-mono mt-0.5">
                      {circuitInfo?.privateInputsCount || 8} Inputs
                    </div>
                    <div className="text-[9px] text-slate-500">Zero plaintext disclosure</div>
                  </div>
                </div>

                {/* Circuit Signals & Hash Architectures */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs font-mono">
                  <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-1.5">
                    <div className="text-[10px] text-slate-400 uppercase font-bold font-sans">
                      Public &amp; Private Signals Declaration
                    </div>
                    <div className="text-[11px] text-cyan-300">
                      • Public: <code className="text-slate-200">merkleRoot</code>
                    </div>
                    <div className="text-[11px] text-amber-300">
                      • Private: <code className="text-slate-200">leaf, originalCommitment</code>
                    </div>
                    <div className="text-[11px] text-purple-300">
                      • Path: <code className="text-slate-200">merklePath[3], pathIndices[3]</code>
                    </div>
                  </div>

                  <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-1.5">
                    <div className="text-[10px] text-slate-400 uppercase font-bold font-sans">
                      Hash Functions &amp; Proof System
                    </div>
                    <div className="text-[11px] text-slate-300">
                      • Tree Compression: <strong className="text-purple-300 font-sans">Poseidon (t=3, 2-to-1)</strong>
                    </div>
                    <div className="text-[11px] text-slate-300">
                      • Leaf Preimage: <strong className="text-cyan-300 font-sans">SHA-256 (mod r scalar)</strong>
                    </div>
                    <div className="text-[11px] text-slate-300">
                      • Proof System: <strong className="text-emerald-300 font-sans">Groth16 (alt_bn128)</strong>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Interactive Attack Arena Comparison */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Card A: Happy Path Legitimate Proof */}
              <div className="p-5 rounded-2xl bg-slate-950 border border-emerald-900/60 space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-emerald-400 uppercase tracking-wider">
                    🛡️ Scenario A: Public Legitimate Evidence Proof
                  </h4>
                  <span className="text-[10px] text-emerald-300 font-mono">Intact File</span>
                </div>

                <p className="text-xs text-slate-400">
                  Constructs Groth16 proof using the registered evidence commitment and verifies on-chain against <code className="text-cyan-300 font-mono">cases[caseId].merkleRoot</code>. Proves the evidence matches a commitment registered for this case.
                </p>

                <button
                  onClick={() => handleZKVerify(false)}
                  disabled={loading}
                  className="w-full py-3 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-bold text-xs hover:from-emerald-500 hover:to-teal-500 transition shadow-lg shadow-emerald-500/20"
                >
                  {loading ? "Generating Groth16 Proof..." : "✅ Generate & Verify Intact Evidence Proof"}
                </button>

                {zkProofResult && zkProofResult.isValid && (
                  <div className="p-3.5 rounded-xl bg-emerald-950/40 border border-emerald-800 space-y-2 text-xs font-mono">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div className="text-emerald-400 font-bold flex items-center gap-1.5">
                        <span>✅ Deployed Solidity Verifier Result: VALID</span>
                      </div>
                      {zkProofResult.generationTimeMs && (
                        <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-emerald-900/80 text-emerald-200 border border-emerald-700 font-mono font-bold">
                          ⚡ Proof generated in {zkProofResult.generationTimeMs}ms
                        </span>
                      )}
                    </div>
                    <div className="text-[10px] text-cyan-300 font-sans">
                      Execution Method: <strong className="font-mono">Read-only EVM eth_call</strong>: no transaction submitted, no blockchain state changed and no gas fee paid.
                    </div>
                    <div className="text-[11px] text-slate-300 truncate">
                      Public Input [0]: {zkProofResult.merkleRootUsed}
                    </div>
                    <div className="text-[10px] text-purple-300 truncate">
                      Proof A: {JSON.stringify(zkProofResult.solidityParams?.a)}
                    </div>
                    {zkProofResult.isSimulated && (
                      <div className="text-[10px] text-amber-300 font-sans bg-amber-950/60 px-2.5 py-1 rounded-lg border border-amber-700/60 flex items-center gap-1.5">
                        <span>⚠️</span>
                        <span>Demonstration output — not a live blockchain or ZK operation.</span>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Card B: Tamper Simulation Attack */}
              <div id="tamper-test" className="p-5 rounded-2xl bg-slate-950 border border-rose-900/60 space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-rose-400 uppercase tracking-wider">
                    ⚔️ Scenario B: Adversarial Tamper Attack
                  </h4>
                  <span className="text-[10px] text-rose-300 font-mono">1 Modified Byte</span>
                </div>

                <p className="text-xs text-slate-400">
                  Simulates a rogue custodian attempting verification with an altered evidence byte. Demonstrates circuit witness generation rejection.
                </p>

                <button
                  onClick={() => handleZKVerify(true)}
                  disabled={loading}
                  className="w-full py-3 rounded-xl bg-gradient-to-r from-rose-600 to-amber-600 text-white font-bold text-xs hover:from-rose-500 hover:to-amber-500 transition shadow-lg shadow-rose-500/20"
                >
                  {loading ? "Testing Circuit Assertion..." : "⚠️ Simulate 1-Byte Tampering Attack"}
                </button>

                {zkTamperResult && (
                  <div className="p-3.5 rounded-xl bg-rose-950/60 border border-rose-800 space-y-1.5 text-xs font-mono">
                    <div className="text-rose-400 font-bold">❌ Soundness Verified: Proof Generation Failed</div>
                    <div className="text-[11px] text-rose-200">
                      Circuit constraint <code className="text-white">leaf === originalCommitment</code> failed locally. Tampered file rejected before reaching blockchain!
                    </div>
                    {zkTamperResult.isSimulated && (
                      <div className="text-[10px] text-amber-300 font-sans bg-amber-950/60 px-2.5 py-1 rounded-lg border border-amber-700/60 flex items-center gap-1.5">
                        <span>⚠️</span>
                        <span>Demonstration output — not a live blockchain or ZK operation.</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="p-4 rounded-xl bg-gradient-to-r from-purple-950/40 via-indigo-950/40 to-slate-900 border border-purple-800/40 text-xs text-slate-300">
              🎯 <strong>Judicial Protocol Invariant</strong>: Verifiers prove beyond cryptographic doubt that the presented file matches a private leaf commitment anchored in Case #{caseIdInput}&apos;s on-chain Poseidon Merkle root—without reading the file, without holding any encryption keys, and without disclosing hashes on the public ledger.
            </div>

            <div className="flex justify-between items-center pt-2">
              <button
                onClick={() => setCurrentStage(4)}
                className="px-4 py-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 text-xs hover:text-slate-200"
              >
                ◀ Back to Shamir Key Chamber
              </button>
              <button
                onClick={() => {
                  setCurrentStage(1);
                  setStatusMsg({ type: "success", text: "Journey completed! You can test another case or run the autoplay walkthrough." });
                }}
                className="px-6 py-2.5 rounded-xl bg-slate-900 border border-cyan-500 text-cyan-300 text-xs font-bold hover:bg-slate-800"
              >
                ↻ Restart Full Journey
              </button>
            </div>
          </div>
          )
        )}
          </>
        )}
      </main>

      {/* Floating Dialog Modals */}
      <CryptoReceiptModal
        isOpen={isCryptoReceiptOpen}
        onClose={() => setIsCryptoReceiptOpen(false)}
        receiptData={
          cryptoReceiptData ||
          (caseDetails?.receipt
            ? caseDetails.receipt
            : {
                caseId: parseInt(caseIdInput) || 101,
                operations: {
                  rawEvidenceReceived: true,
                  sha256FingerprintGenerated: true,
                  fieldLeafDerived: true,
                  poseidonTreeBuilt: true,
                  merkleRootCalculated: true,
                  aesGcmEncrypted: true,
                  vaultRecordPersisted: true,
                  ledgerRegistrationConfirmed: isCaseRegistered,
                },
                publicData: {
                  caseId: parseInt(caseIdInput) || 101,
                  merkleRootHex: caseDetails?.onChainRecord?.merkleRoot || regResult?.merkleRootHex || "0x...",
                  custodian: caseDetails?.onChainRecord?.custodian || "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
                  registrationTimestamp: caseDetails?.onChainRecord?.timestamp
                    ? caseDetails.onChainRecord.timestamp * 1000
                    : Date.now(),
                  txHash: caseDetails?.registrationTxHash || "0x_demo_simulated_tx",
                },
              })
        }
      />

      <FeatureMapModal
        isOpen={isFeatureMapOpen}
        onClose={() => setIsFeatureMapOpen(false)}
        onNavigateToFeature={handleNavigateToStage}
      />

      <GlossaryModal
        isOpen={isGlossaryOpen}
        onClose={() => setIsGlossaryOpen(false)}
      />

      <GuidedDemoTour
        isOpen={isTourOpen}
        onClose={() => setIsTourOpen(false)}
        onNavigateStage={handleNavigateToStage}
      />
    </div>
  );
}
