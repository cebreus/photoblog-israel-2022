import { sveltekit } from "@sveltejs/kit/vite";
import tailwindcss from "@tailwindcss/vite";
import { playwright } from "@vitest/browser-playwright";
import path from "path";
import devtoolsJson from "vite-plugin-devtools-json";
import { defineConfig } from "vitest/config";

const contentDir = process.env.CONTENT_DIR || "egypt-2025";

export default defineConfig({
  plugins: [tailwindcss(), sveltekit(), devtoolsJson()],
  // Disable the Vite runtime error overlay in test/browser runs to avoid it intercepting clicks
  // This prevents <vite-error-overlay> from blocking pointer events during playwright tests.
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
      exclude: [
        "src/lib/components/ui/**",
        "**/*.d.ts",
        "tests/**", // Also exclude tests folder itself from coverage stats usually
        "scripts/**", // Scripts are dev tools, usually not part of app coverage, but user might want them? Let's stick to what was asked primarily, but 'tests' is safe.
        // Actually, let's keep it simple and just do the requested one + standard reliable ones.
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
          include: ["src/**/*.svelte.{test,spec}.{js,ts}"],
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
    ],
  },
});
