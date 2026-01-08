import path from "node:path";
import { createLogger } from "./lib/core/cli-logger";
import { fixUnderwaterImage } from "./lib/image/underwater";
import { validatePathInsideRoot } from "./lib/utils/path";

const logger = createLogger("fix-underwater");

const SAFE_INPUT_ROOT = process.cwd();

import { parseCliArguments } from "./lib/core/cli-parser";

const options = parseCliArguments(process.argv.slice(2));
const values = options;
const positionals = process.argv.slice(2).filter((a) => !a.startsWith("--"));

if (values.help || positionals.length < 3) {
  logger.info(
    {},
    `
Examples:
  bun scripts/fix-underwater.ts img.heic             # Saves as img-fixed.heic
  bun scripts/fix-underwater.ts img.heic .jpg        # Saves as img-fixed.jpg
  bun scripts/fix-underwater.ts img.heic --both      # Saves as HEIC and JPG
`,
  );
  process.exit(1);
}

const inputPath = validatePathInsideRoot(positionals[2] || "", SAFE_INPUT_ROOT);
const generateBoth = values.both ?? process.argv.includes("--both");

if (!inputPath) {
  logger.error({}, "❌ Error: Missing or invalid input path.");
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
  logger.info({ input: relInput, outputs: relOutputs }, "🚀 Processing underwater correction");

  const start = performance.now();
  await fixUnderwaterImage(inputPath, outputs);
  logger.info({ durationS: ((performance.now() - start) / 1000).toFixed(2) }, "✅ Finished");
} catch (error) {
  logger.error({ err: error }, `❌ Error: ${error instanceof Error ? error.message : error}`);
  process.exit(1);
}
