const http = require("http");

function postJson(url, data) {
    return new Promise((resolve, reject) => {
        const u = new URL(url);
        const postData = JSON.stringify(data);
        const t0 = performance.now();
        const req = http.request(
            {
                hostname: u.hostname,
                port: u.port,
                path: u.pathname,
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Content-Length": Buffer.byteLength(postData),
                },
            },
            (res) => {
                let body = "";
                res.on("data", (chunk) => (body += chunk));
                res.on("end", () => {
                    const totalRoundTripMs = Math.round(performance.now() - t0);
                    try {
                        resolve({ status: res.statusCode, totalRoundTripMs, data: JSON.parse(body) });
                    } catch (e) {
                        resolve({ status: res.statusCode, totalRoundTripMs, data: body });
                    }
                });
            }
        );
        req.on("error", reject);
        req.write(postData);
        req.end();
    });
}

async function runTimingDistributionTest() {
    console.log("══════════════════════════════════════════════════════════════════════════════════════════");
    console.log("⏱️  LIVE RAW TIMING VERIFICATION: 5 CONSECUTIVE GROTH16 PROOF GENERATIONS");
    console.log("══════════════════════════════════════════════════════════════════════════════════════════\n");
    console.log(`Test Execution Timestamp: ${new Date().toISOString()}`);
    console.log(`Target Endpoint: http://localhost:3001/api/verify-zk`);
    console.log(`Target Case ID: 101 (On-Chain Registered Poseidon Root)\n`);

    const samples = [];

    for (let i = 1; i <= 5; i++) {
        const res = await postJson("http://localhost:3001/api/verify-zk", { caseId: 101 });
        const serverSnarkMs = res.data.generationTimeMs;
        const totalRoundTripMs = res.totalRoundTripMs;
        const isValid = res.data.isValid;
        const publicSignals = res.data.publicSignals;

        samples.push(serverSnarkMs);

        console.log(`[SAMPLE #${i}] @ ${new Date().toISOString()}`);
        console.log(`  • snarkjs.groth16.fullProve() Wall-Clock Time: ${serverSnarkMs} ms`);
        console.log(`  • Client-to-Server Total HTTP Round-Trip Time: ${totalRoundTripMs} ms`);
        console.log(`  • Deployed Solidity Verifier Result:           ${isValid ? "✅ VALID" : "❌ INVALID"}`);
        console.log(`  • Execution Method:                            EVM eth_call — no blockchain state modified`);
        console.log(`  • Public Signal [0] (merkleRoot):             ${publicSignals ? publicSignals[0] : "N/A"}`);
        console.log(`------------------------------------------------------------------------------------------`);
    }

    const avg = Math.round(samples.reduce((a, b) => a + b, 0) / samples.length);
    const min = Math.min(...samples);
    const max = Math.max(...samples);

    console.log(`\n📊 SUMMARY OF 5 LIVE MEASURED RUNS:`);
    console.log(`  • Samples (ms): [${samples.join(", ")}]`);
    console.log(`  • Minimum Time: ${min} ms`);
    console.log(`  • Maximum Time: ${max} ms`);
    console.log(`  • Average Time: ${avg} ms`);
    console.log("══════════════════════════════════════════════════════════════════════════════════════════\n");
}

runTimingDistributionTest().catch((err) => {
    console.error("❌ Timing test failed:", err);
    process.exit(1);
});
