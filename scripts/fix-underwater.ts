import path from "node:path";
import { fixUnderwaterImage } from "./lib/underwater";

const args = process.argv.slice(2);

if (args.length === 0) {
  console.log("Usage: bun scripts/fix-underwater.ts <path-to-image> [output-path]");
  process.exit(1);
}

const inputPath = args[0];
const ext = path.extname(inputPath);
const basename = path.basename(inputPath, ext);
const dir = path.dirname(inputPath);

// Default output
// Keep original extension if possible (HEIC -> HEIC)
const outputExt = ext;
const defaultOutputPath = path.join(dir, `${basename}-fixed${outputExt}`);

const outputPath = args[1] || defaultOutputPath;

console.log(`Processing: ${inputPath}`);
console.log(`Output: ${outputPath}`);

const startTime = performance.now();

try {
  await fixUnderwaterImage(inputPath, outputPath);
  const duration = performance.now() - startTime;
  console.log(`✅ Done in ${duration.toFixed(2)}ms`);
} catch (error) {
  console.error("❌ Error:", error);
  process.exit(1);
}
