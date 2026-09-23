// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IVerifier {
    function verifyProof(
        uint256[2] calldata a,
        uint256[2][2] calldata b,
        uint256[2] calldata c,
        uint256[1] calldata input
    ) external view returns (bool r);
}

/**
 * @title CustodyLedger
 * @notice On-chain ledger for LexVault digital evidence tracking.
 * @dev Stores ONLY the case-level Poseidon Merkle root. Individual evidence hashes / commitments
 *      are NEVER stored or exposed on-chain.
 */
contract CustodyLedger {
    struct CaseRecord {
        bytes32 merkleRoot; // The ONLY cryptographic artifact stored on-chain
        uint256 timestamp;
        address custodian;
    }

    struct CustodyTransfer {
        address from;
        address to;
        uint256 timestamp;
        bytes signature;
    }

    // caseId => CaseRecord
    mapping(uint256 => CaseRecord) public cases;

    // caseId => CustodyTransfer[]
    mapping(uint256 => CustodyTransfer[]) private _custodyHistory;

    // SnarkJS Groth16 Verifier Contract
    IVerifier public immutable verifier;

    // Events
    event CaseRegistered(
        uint256 indexed caseId,
        bytes32 merkleRoot,
        address indexed custodian,
        uint256 timestamp
    );

    event CustodyTransferred(
        uint256 indexed caseId,
        address indexed from,
        address indexed to,
        uint256 timestamp,
        bytes signature
    );

    constructor(address _verifier) {
        require(_verifier != address(0), "Invalid verifier address");
        verifier = IVerifier(_verifier);
    }

    /**
     * @notice Registers a new evidence case by storing its case-level Poseidon Merkle root.
     * @dev MVP Registrar Note: In this prototype, any caller may register a new caseId.
     *      Production deployment requires a permissioned registrar contract or decentralized identity gating.
     * @param caseId Unique identifier for the case.
     * @param merkleRoot Poseidon Merkle root covering the case's evidence leaf and dummy leaves.
     */
    function registerCase(uint256 caseId, bytes32 merkleRoot) external {
        require(cases[caseId].merkleRoot == bytes32(0), "Case already registered");
        require(merkleRoot != bytes32(0), "Invalid Merkle root");

        cases[caseId] = CaseRecord({
            merkleRoot: merkleRoot,
            timestamp: block.timestamp,
            custodian: msg.sender
        });

        emit CaseRegistered(caseId, merkleRoot, msg.sender, block.timestamp);
    }

    /**
     * @notice Records an authorized custody transfer event for a registered case.
     * @dev Authorization Enforcement:
     *      - msg.sender MUST match the recorded current custodian.
     *      - Destination address `to` cannot be address(0) or the existing custodian.
     *      - Audit Payload Note: The `signature` parameter is stored as an authorization/audit
     *        payload on-chain. Cryptographic EIP-712 signature verification is planned future work.
     * @param caseId Unique case identifier.
     * @param to Address of the new custodian.
     * @param signature Authorization/audit payload recorded with the custody event.
     */
    function transferCustody(
        uint256 caseId,
        address to,
        bytes calldata signature
    ) external {
        CaseRecord storage record = cases[caseId];
        require(record.merkleRoot != bytes32(0), "Case not registered");
        require(to != address(0), "Invalid new custodian");
        require(msg.sender == record.custodian, "Only current custodian can transfer");
        require(to != record.custodian, "Cannot transfer to current custodian");

        address currentCustodian = record.custodian;
        record.custodian = to;

        _custodyHistory[caseId].push(
            CustodyTransfer({
                from: currentCustodian,
                to: to,
                timestamp: block.timestamp,
                signature: signature
            })
        );

        emit CustodyTransferred(caseId, currentCustodian, to, block.timestamp, signature);
    }

    /**
     * @notice Verifies a Zero-Knowledge integrity and case-membership proof.
     * @dev CONTRACT-ENFORCED CASE BINDING: The merkleRoot is NOT supplied by the caller.
     *      It is retrieved directly from contract storage (`cases[caseId].merkleRoot`)
     *      and passed as the sole public input into `verifier.verifyProof()`.
     * @param caseId The registered case ID.
     * @param a Groth16 proof parameter A.
     * @param b Groth16 proof parameter B.
     * @param c Groth16 proof parameter C.
     * @return True if the proof is valid for the registered case Merkle root.
     */
    function verifyEvidence(
        uint256 caseId,
        uint256[2] calldata a,
        uint256[2][2] calldata b,
        uint256[2] calldata c
    ) external view returns (bool) {
        CaseRecord memory record = cases[caseId];
        require(record.merkleRoot != bytes32(0), "Case not registered");

        // Convert bytes32 stored merkleRoot to uint256[1] fixed array expected by SnarkVerifier (Shape A)
        uint256[1] memory publicInputs;
        publicInputs[0] = uint256(record.merkleRoot);

        return verifier.verifyProof(a, b, c, publicInputs);
    }

    /**
     * @notice Returns the custody transfer audit log for a case.
     */
    function getCustodyHistory(
        uint256 caseId
    ) external view returns (CustodyTransfer[] memory) {
        return _custodyHistory[caseId];
    }
}
