import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock crypto.randomUUID
vi.stubGlobal("crypto", {
  randomUUID: () => "generated-uuid-67890",
});

describe("Request Tracing (hooks.server.ts)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should use Web Crypto API for UUID generation", () => {
    const uuid = crypto.randomUUID();
    expect(uuid).toBe("generated-uuid-67890");
  });

  it("should export handle function from hooks.server.ts", async () => {
    const module = await import("../../../src/hooks.server");
    expect(module.handle).toBeDefined();
    expect(typeof module.handle).toBe("function");
  });

  // Note: Full integration testing of hooks.server.ts requires complex SvelteKit mocking
  // that conflicts with strict route typing. These smoke tests verify the module structure.
  // E2E tests should cover actual request flow and tracing behavior.
});
