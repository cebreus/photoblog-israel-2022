import adapter from "@sveltejs/adapter-static";
import { vitePreprocess } from "@sveltejs/vite-plugin-svelte";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outputDir = process.env.OUTPUT_DIR || "build";
const contentDir = process.env.CONTENT_DIR || "egypt-2025";

/** @type {import('@sveltejs/kit').Config} */
const config = {
  // Consult https://svelte.dev/docs/kit/integrations
  // for more information about preprocessors
  preprocess: vitePreprocess(),
  kit: {
    adapter: adapter({
      pages: outputDir,
      assets: outputDir,
      fallback: "404.html",
      precompress: false,
    }),
    alias: {
      $manifests: path.resolve(__dirname, "src/data", contentDir),
      $scripts: path.resolve(__dirname, "scripts"),
    },
  },
};
export default config;
