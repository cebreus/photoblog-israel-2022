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
import { execCapture, run } from "../../../scripts/lib/utils/shell";

const mockSpawn = vi.fn();

// Mock child_process.spawn
vi.mock("node:child_process", () => ({
  spawn: (...args: any[]) => mockSpawn(...args),
  default: { spawn: (...args: any[]) => mockSpawn(...args) },
}));

describe("shell-utils", () => {
  // Spy on Bun.spawn if available (our polyfill)
  const isBun = typeof Bun !== "undefined";
  let bunSpawnSpy: any;

  if (isBun) {
    bunSpawnSpy = vi.spyOn(Bun, "spawn");
  }

  describe("run", () => {
    it("should spawn a process and resolve on exit 0", async () => {
      if (isBun) {
        // Mock Bun.spawn return value
        bunSpawnSpy.mockReturnValue({
          exited: Promise.resolve(0),
          stdout: new Response(undefined).body,
          stderr: new Response(undefined).body,
        });

        await expect(run("echo", ["hello"])).resolves.not.toThrow();
        expect(bunSpawnSpy).toHaveBeenCalledWith(
          ["echo", "hello"],
          expect.objectContaining({
            stdout: "inherit",
            stderr: "inherit",
          }),
        );
      } else {
        // Fallback for non-Bun envs (if any)
        mockSpawn.mockReturnValue({
          on: (event: string, cb: any) => {
            if (event === "close") cb(0);
            return { on: vi.fn() };
          },
          stdout: { on: vi.fn(), pipe: vi.fn() },
          stderr: { on: vi.fn(), pipe: vi.fn() },
        });

        await expect(run("echo", ["hello"])).resolves.not.toThrow();
        expect(mockSpawn).toHaveBeenCalledWith("echo", ["hello"], expect.any(Object));
      }
    });

    it("should reject on non-zero exit code", async () => {
      if (isBun) {
        bunSpawnSpy.mockReturnValue({
          exited: Promise.resolve(1),
          // Clean stdout/stderr mocks
          stdout: new Response("").body,
          stderr: new Response("").body,
        });

        await expect(run("false", [])).rejects.toThrow();
      } else {
        mockSpawn.mockReturnValue({
          on: (event: string, cb: any) => {
            if (event === "close") cb(1);
            return { on: vi.fn() };
          },
          stdout: { on: vi.fn(), pipe: vi.fn() },
          stderr: { on: vi.fn(), pipe: vi.fn() },
        });

        await expect(run("false", [])).rejects.toThrow("Command 'false ' failed with code 1");
      }
    });
  });

  describe("execCapture", () => {
    it("should capture stdout", async () => {
      if (isBun) {
        bunSpawnSpy.mockReturnValue({
          exited: Promise.resolve(0),
          // Captured output needs newline which execCapture trims
          stdout: new Response("captured output\n").body,
          stderr: new Response("").body,
        });

        const result = await execCapture("echo", ["captured output"]);
        expect(result).toBe("captured output");
      } else {
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
      }
    });
  });
});
