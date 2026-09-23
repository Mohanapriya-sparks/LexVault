/**
 * verify_repo_links_and_assets.js
 * Validates documentation links, screenshot assets, URL casings,
 * brand uniqueness (no ShadowTrace references), and showcase build purity.
 */

const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const ROOT_DIR = path.resolve(__dirname, "..");

function getTrackedFiles() {
  try {
    const output = execSync("git ls-files", { cwd: ROOT_DIR, encoding: "utf8" });
    return output.split(/\r?\n/).filter(Boolean);
  } catch (err) {
    console.error("Failed to run git ls-files:", err.message);
    process.exit(1);
  }
}

function checkShadowTraceBranding(files) {
  const violations = [];
  const SHADOW_PATTERN = /shadowtrace/i;

  for (const file of files) {
    // Skip this verification script itself where we check for the pattern
    if (file === "scripts/verify_repo_links_and_assets.js") continue;
    const fullPath = path.join(ROOT_DIR, file);
    if (!fs.existsSync(fullPath)) continue;
    const ext = path.extname(file).toLowerCase();
    if ([".wasm", ".zkey", ".ptau", ".png", ".jpg", ".jpeg", ".ico", ".mp4", ".pdf"].includes(ext)) continue;

    const content = fs.readFileSync(fullPath, "utf8");
    if (SHADOW_PATTERN.test(content)) {
      violations.push(`File ${file} contains forbidden reference to 'ShadowTrace'.`);
    }
  }
  return violations;
}

function checkLowercaseRepoUrls(files) {
  const violations = [];
  // Pattern looking for github.com/.../lexvault (lowercase) or github.io/lexvault (lowercase)
  // Must NOT match package names like "lexvault" in package.json
  const LOWERCASE_URL_PATTERN = /(?:github\.com\/[^\/\s"']+\/lexvault(?:\.git|\/|\b)|github\.io\/lexvault(?:\/|\b))/i;

  for (const file of files) {
    if (file === "scripts/verify_repo_links_and_assets.js") continue;
    const fullPath = path.join(ROOT_DIR, file);
    if (!fs.existsSync(fullPath)) continue;
    const ext = path.extname(file).toLowerCase();
    if (![".md", ".yml", ".yaml", ".ts", ".tsx", ".js", ".jsx", ".html"].includes(ext)) continue;

    const content = fs.readFileSync(fullPath, "utf8");
    const lines = content.split(/\r?\n/);
    lines.forEach((line, idx) => {
      // Check if URL has lowercase lexvault
      if (line.includes("github.com/Mohanapriya-sparks/lexvault") ||
          line.includes("github.com/mohanapriya-sparks/lexvault") ||
          line.includes("mohanapriya-sparks.github.io/lexvault")) {
        violations.push(`File ${file}:${idx + 1} contains lowercase repository URL: ${line.trim()}`);
      }
    });
  }
  return violations;
}

function checkMarkdownLinksAndAssets(files) {
  const violations = [];
  const mdFiles = files.filter(f => f.endsWith(".md"));

  for (const file of mdFiles) {
    const fullPath = path.join(ROOT_DIR, file);
    if (!fs.existsSync(fullPath)) continue;
    const dir = path.dirname(fullPath);
    const content = fs.readFileSync(fullPath, "utf8");

    // Match markdown links [text](target) and images ![alt](target)
    const linkRegex = /!?\[([^\]]*)\]\(([^)]+)\)/g;
    let match;

    while ((match = linkRegex.exec(content)) !== null) {
      const target = match[2].trim();

      // Skip external web URLs, anchors (#...), mailto:, and placeholders
      if (/^(?:https?:\/\/|mailto:|#)/i.test(target)) continue;

      // Extract path before any anchor (#) or query (?)
      const cleanPath = target.split("#")[0].split("?")[0];
      if (!cleanPath) continue;

      const resolvedTarget = path.resolve(dir, cleanPath);
      if (!fs.existsSync(resolvedTarget)) {
        violations.push(`Broken link in ${file}: '${target}' (resolved: ${path.relative(ROOT_DIR, resolvedTarget)})`);
      }
    }
  }

  return violations;
}

function checkShowcaseBuildBundle() {
  const distDir = path.join(ROOT_DIR, "frontend", "dist");
  if (!fs.existsSync(distDir)) {
    console.log("ℹ frontend/dist not found; skipping bundle scan (run 'npm run build:showcase' to generate).");
    return [];
  }

  const violations = [];
  const assetsDir = path.join(distDir, "assets");
  if (!fs.existsSync(assetsDir)) return [];

  const jsFiles = fs.readdirSync(assetsDir).filter(f => f.endsWith(".js"));
  for (const jsFile of jsFiles) {
    const content = fs.readFileSync(path.join(assetsDir, jsFile), "utf8");
    // Check for hardcoded localhost backend or raw /api fetch in showcase code
    if (content.includes("http://localhost:3001") || content.includes("http://localhost:8545")) {
      violations.push(`Showcase bundle ${jsFile} contains hardcoded localhost URLs.`);
    }
  }

  return violations;
}

function main() {
  console.log("=================================================");
  console.log("LexVault Repository Links, Assets & Brand Audit");
  console.log("=================================================");

  const files = getTrackedFiles();
  let allViolations = [];

  console.log("1. Checking for foreign brand references (ShadowTrace)...");
  const brandViolations = checkShadowTraceBranding(files);
  if (brandViolations.length > 0) {
    allViolations.push(...brandViolations);
  } else {
    console.log("   ✔ Zero foreign brand references found.");
  }

  console.log("2. Checking repository and Pages URL casing (/LexVault/ vs /lexvault/)...");
  const urlViolations = checkLowercaseRepoUrls(files);
  if (urlViolations.length > 0) {
    allViolations.push(...urlViolations);
  } else {
    console.log("   ✔ All repository and Pages URLs use canonical uppercase /LexVault/.");
  }

  console.log("3. Verifying relative Markdown links and screenshot assets...");
  const linkViolations = checkMarkdownLinksAndAssets(files);
  if (linkViolations.length > 0) {
    allViolations.push(...linkViolations);
  } else {
    console.log("   ✔ All relative documentation links and referenced assets resolve on disk.");
  }

  console.log("4. Verifying Showcase bundle for localhost dependencies...");
  const bundleViolations = checkShowcaseBuildBundle();
  if (bundleViolations.length > 0) {
    allViolations.push(...bundleViolations);
  } else {
    console.log("   ✔ Showcase bundle verified clean.");
  }

  if (allViolations.length === 0) {
    console.log("=================================================");
    console.log("✔ SUCCESS: All repository integrity checks passed.");
    console.log("=================================================");
    process.exit(0);
  } else {
    console.error("=================================================");
    console.error(`✖ FAILURE: Found ${allViolations.length} repository audit issue(s):`);
    for (const v of allViolations) {
      console.error(`  - ${v}`);
    }
    console.error("=================================================");
    process.exit(1);
  }
}

main();
