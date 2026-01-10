import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createLogger } from "../../../scripts/lib/core/cli-logger";
import { stopAllBars } from "../../../scripts/lib/core/progress-manager";

describe("CLI Logger JSON Mode", () => {
  let originalEnv: string | undefined;
  let originalLevel: string | undefined;
  let consoleOutput: string[];
  let originalStdoutWrite: any;
  let originalStderrWrite: any;

  beforeEach(() => {
    stopAllBars();
    originalEnv = process.env.LOG_FORMAT;
    originalLevel = process.env.LOG_LEVEL;
    process.env.LOG_LEVEL = "info";
    consoleOutput = [];

    // Capture stdout and stderr
    originalStdoutWrite = process.stdout.write;
    process.stdout.write = ((chunk: any) => {
      consoleOutput.push(chunk.toString());
      return true;
    }) as any;

    originalStderrWrite = process.stderr.write;
    process.stderr.write = ((chunk: any) => {
      consoleOutput.push(chunk.toString());
      return true;
    }) as any;
  });

  afterEach(() => {
    process.env.LOG_FORMAT = originalEnv;
    process.env.LOG_LEVEL = originalLevel;

    process.stdout.write = originalStdoutWrite;
    process.stderr.write = originalStderrWrite;
  });

  it("should output JSON when LOG_FORMAT=json", () => {
    process.env.LOG_FORMAT = "json";
    const logger = createLogger("test-logger");

    logger.info("Test message");

    expect(consoleOutput.length).toBeGreaterThan(0);
    const logLine = consoleOutput[0];
    expect(() => JSON.parse(logLine)).not.toThrow();

    const parsed = JSON.parse(logLine);
    expect(parsed).toMatchObject({
      level: 30, // info
      msg: "Test message",
      label: "test-logger",
    });
  });

  it("should output different log levels in JSON", () => {
    process.env.LOG_FORMAT = "json";
    const logger = createLogger("test-logger");

    logger.info("Info message");
    logger.warn("Warn message");
    logger.error("Error message");

    expect(consoleOutput.length).toBe(3);

    const levels = consoleOutput.map((log) => JSON.parse(log).level);
    expect(levels).toEqual([
      30, // info
      40, // warn
      50, // error
    ]);
  });

  it("should include timestamp in JSON output", () => {
    process.env.LOG_FORMAT = "json";
    const logger = createLogger("test-logger");

    logger.info("Test with timestamp");

    const parsed = JSON.parse(consoleOutput[0]);
    expect(parsed.time).toBeDefined();
    expect(typeof parsed.time).toBe("number");
  });

  it("should use pretty format when LOG_FORMAT is not json", () => {
    delete process.env.LOG_FORMAT;
    const logger = createLogger("test-logger");

    logger.info("Pretty format test");

    // Pretty format should NOT be valid JSON
    expect(() => JSON.parse(consoleOutput[0])).toThrow();

    // Should contain the label
    expect(consoleOutput[0]).toContain("test-logger");
  });
});
