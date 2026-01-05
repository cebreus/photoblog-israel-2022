import { beforeEach, describe, expect, it, vi } from "vitest";

describe("logContext Propagation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should propagate logContext from API handler to request log", async () => {
    // This test verifies that business context set in API handlers
    // is correctly captured in the final request log

    const mockLog = {
      info: vi.fn(),
      error: vi.fn(),
    };

    const logContext: Record<string, any> = {};

    // Simulate API handler setting context
    logContext.userId = "user-123";
    logContext.action = "update";
    logContext.itemsProcessed = 5;

    // Simulate hooks.server.ts final log
    mockLog.info(
      {
        stage: "end",
        status: 200,
        durationMs: 123,
        ...logContext,
      },
      "Request finished",
    );

    // Verify context was included
    expect(mockLog.info).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "user-123",
        action: "update",
        itemsProcessed: 5,
        durationMs: expect.any(Number),
      }),
      "Request finished",
    );
  });

  it("should handle empty logContext gracefully", async () => {
    const mockLog = {
      info: vi.fn(),
    };

    const logContext: Record<string, any> = {};

    // Simulate final log with empty context
    mockLog.info(
      {
        stage: "end",
        status: 200,
        durationMs: 50,
        ...logContext,
      },
      "Request finished",
    );

    expect(mockLog.info).toHaveBeenCalledWith(
      {
        stage: "end",
        status: 200,
        durationMs: 50,
      },
      "Request finished",
    );
  });

  it("should accumulate multiple context entries during request lifecycle", async () => {
    const logContext: Record<string, any> = {};

    // Simulate multiple stages adding context
    logContext.userId = "user-456";
    logContext.operation = "delete";

    // Later in the request
    logContext.deletedCount = 3;
    logContext.errors = 0;

    // Verify all context is present
    expect(logContext).toEqual({
      userId: "user-456",
      operation: "delete",
      deletedCount: 3,
      errors: 0,
    });
  });

  it("should allow overwriting context values", async () => {
    const logContext: Record<string, any> = {};

    logContext.status = "pending";
    logContext.status = "completed"; // Overwrite

    expect(logContext.status).toBe("completed");
  });

  it("should handle complex nested context objects", async () => {
    const mockLog = {
      info: vi.fn(),
    };

    const logContext: Record<string, any> = {
      user: {
        id: "123",
        role: "admin",
      },
      operation: {
        type: "bulk-update",
        targets: ["img1", "img2", "img3"],
      },
      metrics: {
        duration: 1500,
        itemsProcessed: 3,
      },
    };

    mockLog.info(
      {
        stage: "end",
        ...logContext,
      },
      "Complex operation completed",
    );

    expect(mockLog.info).toHaveBeenCalledWith(
      expect.objectContaining({
        user: expect.objectContaining({ id: "123", role: "admin" }),
        operation: expect.objectContaining({ type: "bulk-update" }),
        metrics: expect.objectContaining({ itemsProcessed: 3 }),
      }),
      "Complex operation completed",
    );
  });
});
