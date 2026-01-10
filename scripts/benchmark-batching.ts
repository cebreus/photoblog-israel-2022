import path from "node:path";
import { createLogger } from "$scripts/core/cli-logger";
import { readFileText, writeFile } from "$scripts/utils/runtime";
import { run } from "$scripts/utils/shell";

const logger = createLogger("benchmark");

async function main() {
  const gallery = "egypt-2025";
  const limit = 20;
  const manifestPath = path.resolve(process.cwd(), `src/data/${gallery}/images.manifest.json`);

  logger.info({ limit }, "🚀 Benchmarking Embedding Generation");

  // 1. Backup manifest
  const originalManifest = await readFileText(manifestPath);

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
    await writeFile(manifestPath, JSON.stringify(manifest, null, 2));

    // 3. Sequential Run (Batch Size 1)
    logger.info({ batchSize: 1 }, "⏱️  Running Sequential");
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
    await writeFile(manifestPath, originalManifest);
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
    await writeFile(manifestPath, JSON.stringify(manifest2, null, 2));

    // 5. Batch Run (Batch Size 4)
    logger.info({ batchSize: 4 }, "⏱️  Running Batch");
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
    const speedup = (seqTime / batchTime).toFixed(2);
    logger.info(
      {
        seqTime: seqTime.toFixed(2),
        batchTime: batchTime.toFixed(2),
        speedup: speedup,
      },
      "📊 Benchmark Results",
    );
  } finally {
    // Restore manifest
    await writeFile(manifestPath, originalManifest);
  }
}

main().catch((err: any) => logger.error({ err }, "Benchmark failed"));
