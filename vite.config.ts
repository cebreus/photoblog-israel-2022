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
    fs: {
      // Allow serving files from shared/ directory (added in Dec 2024 refactoring)
      allow: ['..'],
    },
    hmr: {
      overlay: false,
    },
  },
  ssr: {
    noExternal: ["svelte-sonner", "@lucide/svelte", "sveltekit-superforms"],
  },
  resolve: {
    alias: {
      $manifests: path.resolve(__dirname, "src/data", contentDir),
    },
  },
  test: {
    fileParallelism: false,
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
          name: "unit-core",
          environment: "node",
          include: ["tests/unit/core/**/*.{test,spec}.{js,ts}"],
          setupFiles: ["./tests/setup/server.ts"],
        },
      },
      {
        extends: "./vite.config.ts",
        test: {
          name: "unit-dom",
          environment: "jsdom",
          include: [
            "tests/unit/stores/**/*.{test,spec}.{js,ts}",
            "tests/unit/features/**/*.{test,spec}.{js,ts}",
          ],
          setupFiles: ["./tests/setup/server.ts"],
        },
      },
      {
        extends: "./vite.config.ts",
        test: {
          name: "integration-api",
          environment: "node",
          include: ["tests/integration/api/**/*.{test,spec}.{js,ts}"],
          exclude: ["src/**/*.svelte.{test,spec}.{js,ts}"],
          setupFiles: ["./tests/setup/server.ts"],
        },
      },
      {
        extends: "./vite.config.ts",
        test: {
          name: "integration-build",
          environment: "node",
          include: ["tests/integration/cli/**/*.{test,spec}.{js,ts}"],
          setupFiles: ["./tests/setup/server.ts"],
        },
      },
      {
        extends: "./vite.config.ts",
        test: {
          name: "integration-data",
          environment: "node",
          include: ["tests/integration/data-integrity/**/*.{test,spec}.{js,ts}"],
          setupFiles: ["./tests/setup/server.ts"],
        },
      },
      {
        extends: "./vite.config.ts",
        test: {
          name: "browser-integration",
          browser: {
            enabled: true,
            headless: true,
            provider: playwright(),
            instances: [{ browser: "chromium" }],
          },
          include: ["tests/integration/browser/**/*.{test,spec}.{js,ts}"],
          setupFiles: ["./vitest-setup-client.ts", "./tests/setup/browser.ts"],
        },
      },
    ],
  },
});
