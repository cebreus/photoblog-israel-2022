import { toast } from "svelte-sonner";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { smartToast } from "$lib/utils/toasts";

vi.mock("svelte-sonner", () => ({
  toast: {
    loading: vi.fn(),
    success: vi.fn(),
    error: vi.fn(),
  },
}));

describe("smartToast", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("should show loading toast after delay", async () => {
    vi.mocked(toast.loading).mockReturnValue("123");
    let resolve: (v: any) => void;
    // @ts-expect-error
    const p = new Promise((r) => {
      resolve = r;
    });

    const wrapped = smartToast(p, { loading: "Load", success: "Ok", error: "Err", delay: 500 });

    // Fast forward
    await vi.advanceTimersByTimeAsync(600);

    expect(toast.loading).toHaveBeenCalledWith("Load");
    // @ts-expect-error
    resolve("Done");
    await wrapped;
    expect(toast.success).toHaveBeenCalledWith("Ok", { id: "123" });
  });

  it("should skip loading toast if fast", async () => {
    let resolve: (v: any) => void;
    // @ts-expect-error
    const p = new Promise((r) => {
      resolve = r;
    });
    const wrapped = smartToast(p, { loading: "Load", success: "Ok", error: "Err", delay: 500 });

    await vi.advanceTimersByTimeAsync(200);
    expect(toast.loading).not.toHaveBeenCalled();

    // @ts-expect-error
    resolve("Done");
    await wrapped;
    expect(toast.success).toHaveBeenCalledWith("Ok");
  });

  it("should handle error", async () => {
    vi.mocked(toast.loading).mockReturnValue("err-id");
    let reject: (v: any) => void;
    // @ts-expect-error
    const p = new Promise((_, r) => {
      reject = r;
    });

    const wrapped = smartToast(p, { loading: "Load", success: "Ok", error: "Err", delay: 500 });

    await vi.advanceTimersByTimeAsync(600);
    expect(toast.loading).toHaveBeenCalledWith("Load");

    // @ts-expect-error
    reject(new Error("Boom"));
    await expect(wrapped).rejects.toThrow("Boom");
    expect(toast.error).toHaveBeenCalledWith("Err", { id: "err-id" });
  });
});
