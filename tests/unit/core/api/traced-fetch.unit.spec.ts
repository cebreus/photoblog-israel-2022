import { beforeEach, describe, expect, it, vi } from "vitest";
import { tracedFetch } from "$lib/utils/api";

// Mock logger
vi.mock("$lib/logger", () => ({
  log: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe("tracedFetch", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (global as any).fetch = vi.fn();

    // Mock crypto.randomUUID
    vi.stubGlobal("crypto", {
      randomUUID: () => "test-uuid-12345",
    });
  });

  it("should add X-Request-ID header to request", async () => {
    const mockResponse = new Response(JSON.stringify({ ok: true }), { status: 200 });
    (global.fetch as any).mockResolvedValue(mockResponse);

    await tracedFetch("/api/test", { method: "GET" });

    expect(global.fetch).toHaveBeenCalledWith(
      "/api/test",
      expect.objectContaining({
        headers: expect.any(Headers),
      }),
    );

    const callArgs = (global.fetch as any).mock.calls[0];
    const headers = callArgs[1].headers as Headers;
    expect(headers.get("X-Request-ID")).toBe("test-uuid-12345");
  });

  it("should log info on successful request", async () => {
    const { log } = await import("$lib/logger");
    const mockResponse = new Response(JSON.stringify({ ok: true }), { status: 200 });
    (global.fetch as any).mockResolvedValue(mockResponse);

    await tracedFetch("/api/test", { method: "POST" });

    expect(log.info).toHaveBeenCalledWith(
      {
        traceId: "test-uuid-12345",
        url: "/api/test",
        method: "POST",
      },
      "FE Trace: Initiating API call",
    );
  });

  it("should log warning on non-ok response", async () => {
    const { log } = await import("$lib/logger");
    const mockResponse = new Response(JSON.stringify({ error: "Not found" }), { status: 404 });
    (global.fetch as any).mockResolvedValue(mockResponse);

    await tracedFetch("/api/test");

    expect(log.warn).toHaveBeenCalledWith(
      {
        traceId: "test-uuid-12345",
        url: "/api/test",
        status: 404,
        statusText: "",
      },
      "FE Trace: API call failed",
    );
  });

  it("should log error and rethrow on network failure", async () => {
    const { log } = await import("$lib/logger");
    const networkError = new Error("Network error");
    (global.fetch as any).mockRejectedValue(networkError);

    await expect(tracedFetch("/api/test")).rejects.toThrow("Network error");

    expect(log.error).toHaveBeenCalledWith(
      {
        err: networkError,
        traceId: "test-uuid-12345",
        url: "/api/test",
      },
      "FE Trace: API call threw error",
    );
  });

  it("should preserve existing headers", async () => {
    const mockResponse = new Response(JSON.stringify({ ok: true }), { status: 200 });
    (global.fetch as any).mockResolvedValue(mockResponse);

    await tracedFetch("/api/test", {
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer token",
      },
    });

    const callArgs = (global.fetch as any).mock.calls[0];
    const headers = callArgs[1].headers as Headers;
    expect(headers.get("Content-Type")).toBe("application/json");
    expect(headers.get("Authorization")).toBe("Bearer token");
    expect(headers.get("X-Request-ID")).toBe("test-uuid-12345");
  });
});
