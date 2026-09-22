const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
    console.log("=== Deploying LexVault Smart Contracts ===");

    const [deployer] = await ethers.getSigners();
    console.log("Deployer address:", deployer.address);

    // 1. Deploy Groth16 Verifier Contract
    const VerifierFactory = await ethers.getContractFactory("Groth16Verifier");
    const verifier = await VerifierFactory.deploy();
    await verifier.waitForDeployment();
    const verifierAddress = await verifier.getAddress();
    console.log("Groth16Verifier deployed at:", verifierAddress);

    // 2. Deploy CustodyLedger Contract
    const LedgerFactory = await ethers.getContractFactory("CustodyLedger");
    const ledger = await LedgerFactory.deploy(verifierAddress);
    await ledger.waitForDeployment();
    const ledgerAddress = await ledger.getAddress();
    console.log("CustodyLedger deployed at:", ledgerAddress);

    // Save deployment metadata
    const deploymentInfo = {
        network: "localhost",
        verifierAddress,
        custodyLedgerAddress: ledgerAddress,
        deployer: deployer.address,
        timestamp: new Date().toISOString(),
    };

    const outputPath = path.resolve(__dirname, "../deployment.json");
    fs.writeFileSync(outputPath, JSON.stringify(deploymentInfo, null, 2));
    console.log(`✅ Saved deployment info to ${outputPath}`);
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
