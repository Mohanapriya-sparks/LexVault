import fs from "fs";
import path from "path";
import crypto from "crypto";
import { sha256ToFieldElement } from "./merkle";

export const SNARK_FIELD_PRIME = BigInt("21888242871839275222246405745257275088548364400416034343698204186575808495617");

export const ROLE_INDEX_MAP: Record<string, bigint> = {
    "Investigator": 1n,
    "Forensic Officer": 2n,
    "Court Reviewer": 3n,
};

export interface StoredEvidenceRecord {
    caseId: number;
    filename: string;
    encryptedData: string; // Base64 AES-GCM encrypted payload
    iv: string; // Base64 IV
    authTag: string; // Base64 Auth Tag
    mimeType: string;
    registeredAt: number;
    // Private commitment stored strictly off-chain; never returned in public APIs
    originalCommitment: string;
    // Shamir 2-of-3 Role Shares (Investigator: x=1, Forensic Officer: x=2, Court Reviewer: x=3)
    keyShares?: Record<string, string>;
}

const VAULT_DIR = path.resolve(__dirname, "../../vault");

if (!fs.existsSync(VAULT_DIR)) {
    fs.mkdirSync(VAULT_DIR, { recursive: true });
}

function modPow(base: bigint, exp: bigint, mod: bigint): bigint {
    let res = 1n;
    base = ((base % mod) + mod) % mod;
    while (exp > 0n) {
        if (exp % 2n === 1n) res = (res * base) % mod;
        base = (base * base) % mod;
        exp = exp / 2n;
    }
    return res;
}

function modInverse(a: bigint, mod: bigint): bigint {
    return modPow(a, mod - 2n, mod);
}

/**
 * Reconstructs the 256-bit symmetric encryption key K from any 2 Shamir shares via Lagrange interpolation in BN128 scalar field.
 */
export function reconstructShamirKey(shares: Array<[bigint, bigint]>): Buffer {
    if (shares.length < 2) {
        throw new Error("Shamir 2-of-3 threshold requires at least 2 distinct role shares.");
    }
    const [x1, y1] = shares[0];
    const [x2, y2] = shares[1];
    if (x1 === x2) {
        throw new Error("Duplicate role share index provided.");
    }

    const p = SNARK_FIELD_PRIME;
    const l1 = (((0n - x2) * modInverse(x1 - x2, p)) % p + p) % p;
    const l2 = (((0n - x1) * modInverse(x2 - x1, p)) % p + p) % p;
    const secretBigInt = (((y1 * l1) % p + (y2 * l2) % p) % p + p) % p;

    // Convert to 32-byte Buffer
    const hex = secretBigInt.toString(16).padStart(64, "0");
    return Buffer.from(hex, "hex");
}

/**
 * Generates an ephemeral 256-bit symmetric key and 2-of-3 Shamir shares.
 */
export function generateEphemeralShamirKey(): {
    keyBuffer: Buffer;
    keyShares: Record<string, string>;
} {
    const p = SNARK_FIELD_PRIME;
    // Generate random secret key K in [1, p-1]
    const randomKeyBytes = crypto.randomBytes(32);
    const keyBigInt = (BigInt("0x" + randomKeyBytes.toString("hex")) % (p - 1n)) + 1n;

    // Generate random slope a1 in [1, p-1]
    const randomSlopeBytes = crypto.randomBytes(32);
    const a1 = (BigInt("0x" + randomSlopeBytes.toString("hex")) % (p - 1n)) + 1n;

    // f(x) = (K + a1 * x) mod p
    const s1 = (keyBigInt + a1 * 1n) % p; // Investigator (x=1)
    const s2 = (keyBigInt + a1 * 2n) % p; // Forensic Officer (x=2)
    const s3 = (keyBigInt + a1 * 3n) % p; // Court Reviewer (x=3)

    const hex = keyBigInt.toString(16).padStart(64, "0");
    const keyBuffer = Buffer.from(hex, "hex");

    return {
        keyBuffer,
        keyShares: {
            "Investigator": s1.toString(),
            "Forensic Officer": s2.toString(),
            "Court Reviewer": s3.toString(),
        },
    };
}

/**
 * Encrypts file buffer using AES-256-GCM with a specified key.
 */
export function encryptEvidenceBufferWithKey(buffer: Buffer, keyBuffer: Buffer) {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv("aes-256-gcm", keyBuffer, iv);
    const encrypted = Buffer.concat([cipher.update(buffer), cipher.final()]);
    const authTag = cipher.getAuthTag();

    return {
        encryptedData: encrypted.toString("base64"),
        iv: iv.toString("base64"),
        authTag: authTag.toString("base64"),
    };
}

/**
 * Decrypts AES-256-GCM encrypted payload using a specific key buffer.
 */
export function decryptEvidenceWithKey(
    encryptedBase64: string,
    ivBase64: string,
    authTagBase64: string,
    keyBuffer: Buffer
): Buffer {
    const iv = Buffer.from(ivBase64, "base64");
    const authTag = Buffer.from(authTagBase64, "base64");
    const decipher = crypto.createDecipheriv("aes-256-gcm", keyBuffer, iv);
    decipher.setAuthTag(authTag);
    const decrypted = Buffer.concat([decipher.update(Buffer.from(encryptedBase64, "base64")), decipher.final()]);
    return decrypted;
}

/**
 * Saves client-side encrypted evidence record with Shamir key shares.
 * Raw file is never transmitted to or received by the backend.
 */
export function saveClientEncryptedEvidence(
    caseId: number,
    filename: string,
    mimeType: string,
    encryptedData: string,
    iv: string,
    authTag: string,
    leafFieldElement: string,
    keyShares?: Record<string, string>
): StoredEvidenceRecord {
    const record: StoredEvidenceRecord = {
        caseId,
        filename,
        encryptedData,
        iv,
        authTag,
        mimeType,
        registeredAt: Date.now(),
        originalCommitment: leafFieldElement,
        keyShares,
    };

    const filePath = path.join(VAULT_DIR, `case_${caseId}.json`);
    fs.writeFileSync(filePath, JSON.stringify(record, null, 2));

    return record;
}

/**
 * Stores encrypted evidence record off-chain (fallback for CLI scripts).
 */
export function saveEncryptedEvidence(
    caseId: number,
    filename: string,
    mimeType: string,
    buffer: Buffer
): { record: StoredEvidenceRecord; leafFieldElement: string } {
    // 1. Calculate SHA-256 leaf mapped to BN128 scalar field
    const sha256Hex = crypto.createHash("sha256").update(buffer).digest("hex");
    const leafFieldElement = sha256ToFieldElement(sha256Hex).toString();

    // 2. Generate ephemeral key & Shamir 2-of-3 shares
    const { keyBuffer, keyShares } = generateEphemeralShamirKey();

    // 3. Encrypt payload
    const { encryptedData, iv, authTag } = encryptEvidenceBufferWithKey(buffer, keyBuffer);

    const record: StoredEvidenceRecord = {
        caseId,
        filename,
        encryptedData,
        iv,
        authTag,
        mimeType,
        registeredAt: Date.now(),
        originalCommitment: leafFieldElement,
        keyShares,
    };

    const filePath = path.join(VAULT_DIR, `case_${caseId}.json`);
    fs.writeFileSync(filePath, JSON.stringify(record, null, 2));

    return { record, leafFieldElement };
}

/**
 * Loads private evidence record by caseId.
 */
export function getStoredEvidence(caseId: number): StoredEvidenceRecord | null {
    const filePath = path.join(VAULT_DIR, `case_${caseId}.json`);
    if (!fs.existsSync(filePath)) {
        return null;
    }
    const data = fs.readFileSync(filePath, "utf8");
    return JSON.parse(data);
}

/**
 * Lists all stored case records metadata.
 */
export function listAllCases(): Array<{ caseId: number; filename: string; mimeType: string; registeredAt: number; hasShares: boolean }> {
    if (!fs.existsSync(VAULT_DIR)) return [];
    const files = fs.readdirSync(VAULT_DIR).filter(f => f.startsWith("case_") && f.endsWith(".json"));
    return files.map(file => {
        try {
            const data = JSON.parse(fs.readFileSync(path.join(VAULT_DIR, file), "utf8"));
            return {
                caseId: data.caseId,
                filename: data.filename,
                mimeType: data.mimeType,
                registeredAt: data.registeredAt,
                hasShares: !!data.keyShares,
            };
        } catch {
            return null;
        }
    }).filter(Boolean) as any[];
}
