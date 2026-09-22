const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const rootDir = path.resolve(__dirname, "../../");
const circuitsDir = path.resolve(rootDir, "circuits");
const buildDir = path.resolve(circuitsDir, "build");
const contractsDir = path.resolve(rootDir, "contracts");

if (!fs.existsSync(buildDir)) {
    fs.mkdirSync(buildDir, { recursive: true });
}

console.log("=== 1. Compiling Circom Circuit ===");
const circomCmd = `npx circom2 evidence_verifier.circom -l ../node_modules --r1cs --wasm --sym --wat`;
console.log("Executing in", circuitsDir, ":", circomCmd);
execSync(circomCmd, { cwd: circuitsDir, stdio: "inherit" });

// Copy JS and build artifacts
const generatedJsDir = path.join(circuitsDir, "evidence_verifier_js");
const targetJsDir = path.join(buildDir, "evidence_verifier_js");

if (fs.existsSync(targetJsDir)) {
    fs.rmSync(targetJsDir, { recursive: true, force: true });
}
fs.cpSync(generatedJsDir, targetJsDir, { recursive: true });

fs.copyFileSync(path.join(circuitsDir, "evidence_verifier.r1cs"), path.join(buildDir, "evidence_verifier.r1cs"));
fs.copyFileSync(path.join(circuitsDir, "evidence_verifier.sym"), path.join(buildDir, "evidence_verifier.sym"));

// Clean up temporary root artifacts so circuits/build is the single canonical location
try {
    fs.rmSync(generatedJsDir, { recursive: true, force: true });
    fs.unlinkSync(path.join(circuitsDir, "evidence_verifier.r1cs"));
    fs.unlinkSync(path.join(circuitsDir, "evidence_verifier.sym"));
} catch (_) {}

console.log("\n=== 2. SnarkJS Powers of Tau Ceremony (POT 12) ===");
const ptau0 = path.join(buildDir, "pot12_0000.ptau");
const ptau1 = path.join(buildDir, "pot12_0001.ptau");
const ptauFinal = path.join(buildDir, "pot12_final.ptau");

if (!fs.existsSync(ptauFinal)) {
    execSync(`npx snarkjs powersoftau new bn128 12 "${ptau0}"`, { stdio: "inherit" });
    execSync(`npx snarkjs powersoftau contribute "${ptau0}" "${ptau1}" --name="LexVault" -v -e="lexvault_entropy_seed"`, { input: "entropy_seed_data\n", stdio: ["pipe", "inherit", "inherit"] });
    execSync(`npx snarkjs powersoftau prepare phase2 "${ptau1}" "${ptauFinal}"`, { stdio: "inherit" });
}

console.log("\n=== 3. Groth16 Setup & ZKey Generation ===");
const r1csPath = path.join(buildDir, "evidence_verifier.r1cs");
const zkey0 = path.join(buildDir, "evidence_verifier_0000.zkey");
const zkeyFinal = path.join(buildDir, "evidence_verifier_final.zkey");
const vkeyPath = path.join(buildDir, "verification_key.json");

execSync(`npx snarkjs groth16 setup "${r1csPath}" "${ptauFinal}" "${zkey0}"`, { stdio: "inherit" });
execSync(`npx snarkjs zkey contribute "${zkey0}" "${zkeyFinal}" --name="LexVault" -v -e="lexvault_zkey_entropy"`, { input: "zkey_entropy_data\n", stdio: ["pipe", "inherit", "inherit"] });
execSync(`npx snarkjs zkey export verificationkey "${zkeyFinal}" "${vkeyPath}"`, { stdio: "inherit" });

console.log("\n=== 4. Generating Solidity Verifier Contract ===");
const verifierSolPath = path.join(contractsDir, "Verifier.sol");
execSync(`npx snarkjs zkey export solidityverifier "${zkeyFinal}" "${verifierSolPath}"`, { stdio: "inherit" });

// Fix Solidity compiler pragma version in auto-generated Verifier.sol (^0.8.20)
let verifierContent = fs.readFileSync(verifierSolPath, "utf8");
verifierContent = verifierContent.replace(/pragma solidity \^\d+\.\d+\.\d+;/, "pragma solidity ^0.8.20;");
fs.writeFileSync(verifierSolPath, verifierContent);

console.log("\n✅ Circuit compilation, zkey setup, and Verifier.sol export complete!");
