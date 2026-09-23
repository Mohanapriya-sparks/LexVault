/**
 * scan_git_history.js
 * Scans the entire Git commit history (all commits, diffs, and trees)
 * for private keys, tokens, or personal workstation paths.
 */

const { execSync } = require("child_process");
const path = require("path");

const ROOT_DIR = path.resolve(__dirname, "..");

const HARDHAT_TEST_KEYS_ALLOWLIST = new Set([
  "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80",
  "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d",
  "0x5de4111afa1a4b94908f83103eb272296c108c461205812e9d7d82e56f83529a",
  "0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6",
  "0x47e179ec346de212963f5f947611077273e79ec9709b57d5a99415705307c9db",
  "0x8b3a350cf5c34c9194ca85829a2df0ec3153be0318b5e2d3348e872092edffba",
  "0x0000000000000000000000000000000000000000000000000000000000000000",
]);

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
    name: "Absolute Personal Local Path in Added Code",
    regex: /^\+[^+].*(?:[a-zA-Z]:\\[Uu]sers\\[a-zA-Z0-9_-]+|\/home\/[a-zA-Z0-9_-]+|\/Users\/[a-zA-Z0-9_-]+)/gm,
    extract: (m) => m[0]
  }
];

function main() {
  console.log("=================================================");
  console.log("LexVault Git History Security & Secrets Audit");
  console.log("=================================================");

  let gitLogOutput;
  try {
    // Check all commits with diffs
    gitLogOutput = execSync("git log -p --all", { cwd: ROOT_DIR, encoding: "utf8", maxBuffer: 50 * 1024 * 1024 });
  } catch (err) {
    console.error("Failed to read git log:", err.message);
    process.exit(1);
  }

  const commitCount = (gitLogOutput.match(/^commit [a-f0-9]{40}/gm) || []).length;
  console.log(`Auditing full commit history (${commitCount} commits across all refs)...`);

  const issues = [];

  for (const rule of SUSPICIOUS_PATTERNS) {
    let match;
    const regex = new RegExp(rule.regex.source, rule.regex.flags);
    while ((match = regex.exec(gitLogOutput)) !== null) {
      const captured = rule.extract(match);
      if (!captured) continue;

      if (HARDHAT_TEST_KEYS_ALLOWLIST.has(captured.toLowerCase()) ||
          HARDHAT_TEST_KEYS_ALLOWLIST.has(`0x${captured.toLowerCase()}`)) {
        continue;
      }

      // Ignore standard package lock hashes / sha512 integrity hashes
      if (captured.includes("integrity sha512-") || captured.includes("resolved \"https://registry.npmjs.org/")) {
        continue;
      }

      const redacted = captured.length > 8
        ? `${captured.slice(0, 4)}...${captured.slice(-4)}`
        : "[REDACTED]";

      issues.push({
        rule: rule.name,
        redactedValue: redacted,
      });
    }
  }

  if (issues.length === 0) {
    console.log("✔ SUCCESS: No matches found for configured patterns.");
    process.exit(0);
  } else {
    console.error(`✖ FAILURE: Found ${issues.length} potential secret issue(s) in Git history:`);
    for (const issue of issues) {
      console.error(`  - [${issue.rule}]: ${issue.redactedValue}`);
    }
    process.exit(1);
  }
}

main();
