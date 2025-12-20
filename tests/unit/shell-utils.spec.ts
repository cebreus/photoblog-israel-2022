/**
 * @fileoverview Shell Utilities Unit Tests
 *
 * @description
 * Tests wrapper functions for shell command execution.
 * Verifies that shell commands are constructed and executed correctly, capturing
 * stdout/stderr and handling exit codes.
 *
 * @modules-tested
 * - scripts/lib/shell-utils.ts
 */

import { describe, expect, it, vi } from "vitest";
import { execCapture, run } from "../../scripts/lib/shell-utils";

const mockSpawn = vi.fn();

// Mock child_process.spawn
vi.mock("node:child_process", () => ({
  spawn: (...args: any[]) => mockSpawn(...args),
  default: { spawn: (...args: any[]) => mockSpawn(...args) },
}));

describe("shell-utils", () => {
  describe("run", () => {
    it("should spawn a process and resolve on exit 0", async () => {
      mockSpawn.mockReturnValue({
        on: (event: string, cb: any) => {
          if (event === "close") cb(0);
          return { on: vi.fn() }; // chainable
        },
        stdout: { on: vi.fn(), pipe: vi.fn() },
        stderr: { on: vi.fn(), pipe: vi.fn() },
      });

      await expect(run("echo", ["hello"])).resolves.not.toThrow();
      expect(mockSpawn).toHaveBeenCalledWith("echo", ["hello"], expect.any(Object));
    });

    it("should reject on non-zero exit code", async () => {
      mockSpawn.mockReturnValue({
        on: (event: string, cb: any) => {
          if (event === "close") cb(1);
          return { on: vi.fn() };
        },
        stdout: { on: vi.fn(), pipe: vi.fn() },
        stderr: { on: vi.fn(), pipe: vi.fn() },
      });

      await expect(run("false", [])).rejects.toThrow("Command 'false ' failed with code 1");
    });
  });

  describe("execCapture", () => {
    it("should capture stdout", async () => {
      mockSpawn.mockReturnValue({
        on: (event: string, cb: any) => {
          if (event === "close") cb(0);
          return { on: vi.fn() };
        },
        stdout: {
          on: (event: string, cb: any) => {
            if (event === "data") cb(Buffer.from("captured output\n"));
          },
          pipe: vi.fn(),
        },
        stderr: { on: vi.fn(), pipe: vi.fn() },
      });

      const result = await execCapture("echo", ["captured output"]);
      expect(result).toBe("captured output");
    });
  });
});
