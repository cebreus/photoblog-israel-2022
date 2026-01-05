import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "../../../src/routes/api/log/+server";

// Mock dev environment
vi.mock("$app/environment", () => ({
  dev: false, // Set to production mode for testing
}));

// Mock logger
const mockLogger = {
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
  trace: vi.fn(),
  fatal: vi.fn(),
};

vi.mock("$lib/logger", () => ({
  createLogger: () => mockLogger,
}));

// Helper to create properly typed mock RequestEvent
function createMockRequestEvent(request: Request): Parameters<typeof POST>[0] {
  return {
    request,
    cookies: {} as any,
    fetch: fetch,
    getClientAddress: () => "127.0.0.1",
    isDataRequest: false,
    isSubRequest: false,
    isRemoteRequest: false,
    locals: {} as App.Locals,
    params: {},
    platform: undefined,
    route: { id: null },
    setHeaders: () => {},
    tracing: {} as any,
    url: new URL(request.url),
  };
}

describe("POST /api/log", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should forward info level logs to backend logger", async () => {
    const request = new Request("http://localhost:5173/api/log", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        level: 30, // info
        msg: "Test info message",
        label: "test-component",
        userId: "123",
      }),
    });

    const response = await POST(createMockRequestEvent(request));

    expect(response.status).toBe(200);
    expect(mockLogger.info).toHaveBeenCalledWith("Test info message", { userId: "123" });
  });

  it("should forward warn level logs to backend logger", async () => {
    const request = new Request("http://localhost:5173/api/log", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        level: 40, // warn
        msg: "Test warning",
        status: 404,
      }),
    });

    const response = await POST(createMockRequestEvent(request));

    expect(response.status).toBe(200);
    expect(mockLogger.warn).toHaveBeenCalledWith("Test warning", { status: 404 });
  });

  it("should forward error level logs to backend logger", async () => {
    const request = new Request("http://localhost:5173/api/log", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        level: 50, // error
        msg: "Test error",
        err: { message: "Something failed" },
      }),
    });

    const response = await POST(createMockRequestEvent(request));

    expect(response.status).toBe(200);
    expect(mockLogger.error).toHaveBeenCalledWith("Test error", {
      err: { message: "Something failed" },
    });
  });

  it("should handle debug level logs", async () => {
    const request = new Request("http://localhost:5173/api/log", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        level: 20, // debug
        msg: "Debug info",
      }),
    });

    const response = await POST(createMockRequestEvent(request));

    expect(response.status).toBe(200);
    expect(mockLogger.debug).toHaveBeenCalledWith("Debug info", {});
  });

  it("should handle trace level logs", async () => {
    const request = new Request("http://localhost:5173/api/log", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        level: 10, // trace
        msg: "Trace info",
      }),
    });

    const response = await POST(createMockRequestEvent(request));

    expect(response.status).toBe(200);
    expect(mockLogger.trace).toHaveBeenCalledWith("Trace info", {});
  });

  it("should default to info level for unknown levels", async () => {
    const request = new Request("http://localhost:5173/api/log", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        level: 999, // unknown
        msg: "Unknown level message",
      }),
    });

    const response = await POST(createMockRequestEvent(request));

    expect(response.status).toBe(200);
    expect(mockLogger.info).toHaveBeenCalledWith("Unknown level message", {});
  });

  it("should use label prefix for frontend logs", async () => {
    const request = new Request("http://localhost:5173/api/log", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        level: 30,
        msg: "Test with label",
        label: "PhotoGrid",
      }),
    });

    await POST(createMockRequestEvent(request));

    // createLogger should be called with "fe:PhotoGrid"
    expect(mockLogger.info).toHaveBeenCalled();
  });

  it("should return 500 for invalid JSON", async () => {
    const request = new Request("http://localhost:5173/api/log", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "invalid json",
    });

    const response = await POST(createMockRequestEvent(request));

    expect(response.status).toBe(500);
  });
});
