/**
 * scan_public_repository.js
 * Scans all git-tracked files for leaked credentials, private keys, tokens,
 * or unintended absolute local workstation paths.
 */

const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const ROOT_DIR = path.resolve(__dirname, "..");

// Known standard Hardhat deterministic test private keys & known public fixtures
const HARDHAT_TEST_KEYS_ALLOWLIST = new Set([
  "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80", // Hardhat #0
  "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d", // Hardhat #1
  "0x5de4111afa1a4b94908f83103eb272296c108c461205812e9d7d82e56f83529a", // Hardhat #2
  "0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6", // Hardhat #3
  "0x47e179ec346de212963f5f947611077273e79ec9709b57d5a99415705307c9db", // Hardhat #4
  "0x8b3a350cf5c34c9194ca85829a2df0ec3153be0318b5e2d3348e872092edffba", // Hardhat #5
  "0x0000000000000000000000000000000000000000000000000000000000000000", // Zero bytes32
]);

const BINARY_EXTENSIONS = new Set([
  ".wasm", ".zkey", ".ptau", ".png", ".jpg", ".jpeg", ".svg", ".ico",
  ".mp4", ".pdf", ".gz", ".tar", ".zip", ".woff", ".woff2", ".ttf", ".eot"
]);

// Secret pattern matchers (focusing on actual secrets, not harmless property names or public Merkle roots)
const SUSPICIOUS_PATTERNS = [
  {
    name: "Explicit Private Key Assignment",
    regex: /(?:private[_\s-]?key|secret[_\s-]?key|signing[_\s-]?key)[\s:=]+["'](0x[0-9a-fA-F]{64}|[0-9a-fA-F]{64})["']/gi,
    extract: (m) => m[1]
  },
  {
    name: "GitHub Token",
    regex: /(ghp_[A-Za-z0-9_]{36}|github_pat_[A-Za-z0-9_]{82})/g,
    extract: (m) => m[1]
  },
  {
    name: "AWS Access Key ID",
    regex: /(AKIA[0-9A-Z]{16})/g,
    extract: (m) => m[1]
  },
  {
    name: "Absolute Local Workstation Path",
    regex: /(?:[a-zA-Z]:\\[Uu]sers\\[a-zA-Z0-9_-]+|\/home\/[a-zA-Z0-9_-]+|\/Users\/[a-zA-Z0-9_-]+)/g,
    extract: (m) => m[0]
  }
];

function getTrackedFiles() {
  try {
    const output = execSync("git ls-files", { cwd: ROOT_DIR, encoding: "utf8" });
    return output.split(/\r?\n/).filter(Boolean);
  } catch (err) {
    console.error("Failed to run git ls-files:", err.message);
    process.exit(1);
  }
}

function scanFile(filePath) {
  const fullPath = path.join(ROOT_DIR, filePath);
  const ext = path.extname(filePath).toLowerCase();

  if (BINARY_EXTENSIONS.has(ext)) {
    return [];
  }

  if (!fs.existsSync(fullPath)) {
    return [];
  }

  const content = fs.readFileSync(fullPath, "utf8");
  const violations = [];

  for (const rule of SUSPICIOUS_PATTERNS) {
    let match;
    const regex = new RegExp(rule.regex.source, rule.regex.flags);
    while ((match = regex.exec(content)) !== null) {
      const captured = rule.extract(match);
      if (!captured) continue;

      // Allowlist check
      if (HARDHAT_TEST_KEYS_ALLOWLIST.has(captured.toLowerCase()) ||
          HARDHAT_TEST_KEYS_ALLOWLIST.has(`0x${captured.toLowerCase()}`)) {
        continue;
      }

      const redacted = captured.length > 8
        ? `${captured.slice(0, 4)}...${captured.slice(-4)}`
        : "[REDACTED]";

      violations.push({
        file: filePath,
        rule: rule.name,
        redactedValue: redacted,
      });
    }
  }

  return violations;
}

function main() {
  console.log("=================================================");
  console.log("LexVault Public Repository Security & Secrets Scan");
  console.log("=================================================");

  const files = getTrackedFiles();
  console.log(`Scanning ${files.length} git-tracked files...`);

  let totalViolations = 0;
  const issues = [];

  for (const file of files) {
    const fileViolations = scanFile(file);
    if (fileViolations.length > 0) {
      issues.push(...fileViolations);
      totalViolations += fileViolations.length;
    }
  }

  if (totalViolations === 0) {
    console.log("✔ SUCCESS: No matches found for configured patterns.");
    process.exit(0);
  } else {
    console.error(`✖ FAILURE: Found ${totalViolations} potential security issue(s):`);
    for (const issue of issues) {
      console.error(`  - [${issue.rule}] in ${issue.file}: ${issue.redactedValue}`);
    }
    process.exit(1);
  }
}

main();
