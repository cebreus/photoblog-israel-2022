import path from "path";
import { validatePathInsideRoot } from "./lib/path-utils";
import { fixUnderwaterImage } from "./lib/underwater";

const SAFE_INPUT_ROOT = process.cwd();

import { parseArgs } from "node:util";

const { values, positionals } = parseArgs({
  args: Bun.argv,
  options: {
    both: {
      type: "boolean",
    },
    help: {
      type: "boolean",
      short: "h",
    },
  },
  strict: false,
  allowPositionals: true,
});

if (values.help || positionals.length < 3) {
  console.log(
    "Usage: bun scripts/fix-underwater.ts <path-to-image> [output-path-or-format] [--both]",
  );
  console.log("\nExamples:");
  console.log("  bun scripts/fix-underwater.ts img.heic             # Saves as img-fixed.heic");
  console.log("  bun scripts/fix-underwater.ts img.heic .jpg        # Saves as img-fixed.jpg");
  console.log("  bun scripts/fix-underwater.ts img.heic --both      # Saves as HEIC and JPG");
  process.exit(1);
}

const inputPath = validatePathInsideRoot(
  positionals[2] || "",
  SAFE_INPUT_ROOT,
);
const generateBoth = values.both;

if (!inputPath) {
  console.error("❌ Error: Missing or invalid input path.");
  process.exit(1);
}

const cwd = process.cwd();
const relInput = path.relative(cwd, inputPath);

try {
  const ext = path.extname(inputPath);
  const basename = path.basename(inputPath, ext);
  const dir = path.dirname(inputPath);

  const outputs: string[] = [];
  if (generateBoth) {
    outputs.push(path.join(dir, `${basename}-fixed.heic`));
    outputs.push(path.join(dir, `${basename}-fixed.jpg`));
  } else {
    const argOut = positionals[3];
    let finalPath = argOut || path.join(dir, `${basename}-fixed${ext}`);
    if (finalPath.startsWith(".") && finalPath.length <= 5) {
      finalPath = path.join(dir, `${basename}-fixed${finalPath}`);
    }
    outputs.push(finalPath);
  }

  const relOutputs = outputs.map((p) => path.relative(cwd, p));
  console.log(`🚀 Processing: ${relInput} -> ${relOutputs.join(", ")}`);

  const start = performance.now();
  await fixUnderwaterImage(inputPath, outputs);
  console.log(`✅ Finished in ${((performance.now() - start) / 1000).toFixed(2)}s`);
} catch (error) {
  console.error(`❌ Error: ${error instanceof Error ? error.message : error}`);
  process.exit(1);
}
