import fs from "node:fs/promises";
import path from "node:path";
import { run } from "./lib/shell-utils";

async function main() {
  const gallery = "egypt-2025";
  const limit = 20;
  const manifestPath = path.resolve(process.cwd(), `src/data/${gallery}/images.manifest.json`);

  console.log(`🚀 Benchmarking Embedding Generation (Limit: ${limit} images)`);

  // 1. Backup manifest
  const originalManifest = await fs.readFile(manifestPath, "utf-8");

  try {
    // 2. Clear embeddings for benchmark
    const manifest = JSON.parse(originalManifest);
    let cleared = 0;
    for (const day of manifest.photoDays) {
      for (const item of day.items) {
        if (item.type === "image" && cleared < limit) {
          item.analysis.embedding = [];
          cleared++;
        }
      }
    }
    await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2));

    // 3. Sequential Run (Batch Size 1)
    console.log("\n⏱️  Running Sequential (Batch Size: 1)...");
    const startSeq = Date.now();
    await run("bun", [
      "scripts/manage.ts",
      "analyze",
      `--gallery=${gallery}`,
      `--limit=${limit}`,
      "--batch-size=1",
      "--verbose",
    ]);
    const endSeq = Date.now();
    const seqTime = (endSeq - startSeq) / 1000;

    // 4. Restore and Clear again
    await fs.writeFile(manifestPath, originalManifest);
    const manifest2 = JSON.parse(originalManifest);
    let cleared2 = 0;
    for (const day of manifest2.photoDays) {
      for (const item of day.items) {
        if (item.type === "image" && cleared2 < limit) {
          item.analysis.embedding = [];
          cleared2++;
        }
      }
    }
    await fs.writeFile(manifestPath, JSON.stringify(manifest2, null, 2));

    // 5. Batch Run (Batch Size 4)
    console.log("\n⏱️  Running Batch (Batch Size: 4)...");
    const startBatch = Date.now();
    await run("bun", [
      "scripts/manage.ts",
      "analyze",
      `--gallery=${gallery}`,
      `--limit=${limit}`,
      "--batch-size=4",
      "--verbose",
    ]);
    const endBatch = Date.now();
    const batchTime = (endBatch - startBatch) / 1000;

    // 6. Report
    console.log("\n📊 Benchmark Results:");
    console.log(`- Sequential (1/pass): ${seqTime.toFixed(2)}s`);
    console.log(`- Batch (4/pass):      ${batchTime.toFixed(2)}s`);
    const speedup = (seqTime / batchTime).toFixed(2);
    console.log(`\n🔥 Speedup: ${speedup}x`);
  } finally {
    // Restore manifest
    await fs.writeFile(manifestPath, originalManifest);
  }
}

main().catch(console.error);
