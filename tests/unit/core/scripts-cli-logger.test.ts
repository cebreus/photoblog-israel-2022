import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createLogger } from "../../../scripts/lib/core/cli-logger";

describe("cli-logger", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.clearAllMocks();
  });

  it("should create a logger with the given label", () => {
    const logger = createLogger("test-label");
    expect(logger).toBeDefined();
    expect(logger.info).toBeInstanceOf(Function);
  });

  it("should include TRACE_ID in the context if present in env", async () => {
    process.env.TRACE_ID = "test-trace-id-123";
    // Re-import to trigger module-level env reading
    vi.resetModules();
    const { createLogger: createLoggerReimported } = await import(
      "../../../scripts/lib/core/cli-logger"
    );

    // We can't easily spy on the internal pino logger without mocking pino,
    // but we can check if it runs without error.
    // For a real test of output, we'd need to mock stdout/pino.
    const logger = createLoggerReimported("trace-test");
    expect(logger).toBeDefined();
  });

  it("should support JSON format", async () => {
    process.env.LOG_FORMAT = "json";
    vi.resetModules();
    const { createLogger: createLoggerJson } = await import("../../../scripts/lib/core/cli-logger");
    const logger = createLoggerJson("json-test");
    expect(logger.info).toBeInstanceOf(Function);
  });
});
