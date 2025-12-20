import { sveltekit } from "@sveltejs/kit/vite";
import tailwindcss from "@tailwindcss/vite";
import { playwright } from "@vitest/browser-playwright";
import path from "path";
import devtoolsJson from "vite-plugin-devtools-json";
import { defineConfig } from "vitest/config";

const contentDir = process.env.CONTENT_DIR || "egypt-2025";

export default defineConfig({
  plugins: [tailwindcss(), sveltekit(), devtoolsJson()],
  server: {
    hmr: {
      overlay: false,
    },
  },
  ssr: {
    noExternal: ["svelte-sonner", "lucide-svelte", "bits-ui", "sveltekit-superforms"],
  },
  resolve: {
    alias: {
      $manifests: path.resolve(__dirname, "src/data", contentDir),
    },
  },
  test: {
    expect: { requireAssertions: true },
    coverage: {
      include: ["src/**"],
      exclude: [
        "src/lib/components/ui/**",
        "src/app.html",
        "**/*.d.ts",
        "tests/**",
        "scripts/**",
        "src/**/*.svelte",
        "**/*.test.ts",
        "**/*.spec.ts",
      ],
    },
    projects: [
      {
        extends: "./vite.config.ts",
        test: {
          name: "client",
          browser: {
            enabled: true,
            headless: true,
            provider: playwright(),
            instances: [{ browser: "chromium" }],
          },
          include: [
            "src/**/*.svelte.{test,spec}.{js,ts}",
            "tests/components/**/*.{test,spec}.{js,ts}",
            "tests/components/**/*.{test,spec}.svelte.{js,ts}",
          ],
          exclude: ["src/lib/server/**"],
          setupFiles: ["./vitest-setup-client.ts", "./tests/setup/browser.ts"],
        },
      },
      {
        extends: "./vite.config.ts",
        test: {
          name: "server",
          environment: "node",
          include: ["src/**/*.{test,spec}.{js,ts}", "tests/unit/**/*.{test,spec}.{js,ts}"],
          exclude: ["src/**/*.svelte.{test,spec}.{js,ts}"],
          setupFiles: ["./tests/setup/server.ts"],
        },
      },
      {
        extends: "./vite.config.ts",
        test: {
          name: "integration",
          environment: "node",
          include: ["tests/integration/**/*.{test,spec}.{js,ts}"],
          exclude: ["src/**/*.svelte.{test,spec}.{js,ts}"],
          setupFiles: ["./tests/setup/server.ts"],
        },
      },
    ],
  },
});
