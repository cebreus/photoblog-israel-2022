import { tracedFetch } from "$lib/utils/api";
import { beforeEach, describe, expect, it, vi } from "vitest";

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

    // Mock math.random to have predictable IDs
    vi.spyOn(Math, "random").mockReturnValue(0.1234);
    vi.spyOn(Math, "floor").mockImplementation((x) => Number(Math.trunc(x))); // Simple floor mock or pass-through
  });

  it("should add X-Request-ID header with human-readable format", async () => {
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
    const id = headers.get("X-Request-ID");

    // Check if ID is in format req-[hex]
    expect(id).toMatch(/^req-[0-9a-f]{4}$/);
  });

  it("should SKIP tracing (logging) for /api/log to prevent infinite loops", async () => {
    const { log } = await import("$lib/logger");
    const mockResponse = new Response(JSON.stringify({ ok: true }), { status: 200 });
    (global.fetch as any).mockResolvedValue(mockResponse);

    // Call API log endpoint
    await tracedFetch("/api/log", { method: "POST", body: "{}" });

    // Should fetch
    expect(global.fetch).toHaveBeenCalledWith("/api/log", expect.anything());

    // Should NOT log
    expect(log.info).not.toHaveBeenCalled();
    expect(log.warn).not.toHaveBeenCalled();
    expect(log.error).not.toHaveBeenCalled();
  });

  it("should log info on successful request", async () => {
    const { log } = await import("$lib/logger");
    const mockResponse = new Response(JSON.stringify({ ok: true }), { status: 200 });
    // Mock header mirror
    // We can't easily mock the ID match here without knowing the exact random seed interaction,
    // but we can check the call structure.
    (global.fetch as any).mockResolvedValue(mockResponse);

    await tracedFetch("/api/test", { method: "POST" });

    // First call: Start
    expect(log.info).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        url: "/api/test",
        method: "POST",
      }),
      expect.stringMatching(/^FE > Starting req-/),
    );

    // Second call: End
    expect(log.info).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        url: "/api/test",
        status: 200,
        durationMs: expect.any(Number),
      }),
      expect.stringMatching(/^FE > Finished req-/),
    );
  });

  it("should log warning on non-ok response", async () => {
    const { log } = await import("$lib/logger");
    const mockResponse = new Response(JSON.stringify({ error: "Not found" }), { status: 404 });
    (global.fetch as any).mockResolvedValue(mockResponse);

    await tracedFetch("/api/test");

    expect(log.warn).toHaveBeenCalledWith(
      expect.objectContaining({
        url: "/api/test",
        status: 404,
      }),
      expect.stringMatching(/^FE > Failed req-/),
    );
  });
});
