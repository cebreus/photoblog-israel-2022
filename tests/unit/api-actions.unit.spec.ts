import { toast } from "svelte-sonner";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { invalidateAll } from "$app/navigation";
import { performImageAction } from "$lib/utils/api-actions";

vi.mock("svelte-sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
  },
}));

vi.mock("$app/navigation", () => ({
  invalidateAll: vi.fn(),
}));

describe("api-actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn();
  });

  it("should do nothing if images are empty", async () => {
    await performImageAction({ action: "delete", images: [] });
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("should perform delete action successfully", async () => {
    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, deleted: ["img1"] }),
    });

    const onStart = vi.fn();
    const onFinish = vi.fn();
    const onSuccess = vi.fn();

    await performImageAction({
      action: "delete",
      images: [{ id: "i1", src: "img1" }],
      onStart,
      onFinish,
      onSuccess,
    });

    expect(global.fetch).toHaveBeenCalledWith(
      "/api/images",
      expect.objectContaining({ method: "DELETE" }),
    );
    expect(toast.success).toHaveBeenCalledWith(expect.stringContaining("smazáno"));
    expect(invalidateAll).toHaveBeenCalled();
    expect(onStart).toHaveBeenCalled();
    expect(onFinish).toHaveBeenCalled();
    expect(onSuccess).toHaveBeenCalled();
  });

  it("should handle server errors", async () => {
    (global.fetch as any).mockResolvedValue({
      ok: false,
      json: async () => ({ message: "Server Error" }),
    });

    const onError = vi.fn();

    await performImageAction({
      action: "archive",
      images: [{ id: "i1", src: "img1" }],
      onError,
    });

    expect(toast.error).toHaveBeenCalledWith(expect.stringContaining("Server Error"));
    expect(onError).toHaveBeenCalled();
  });

  it("should handle partial errors (result.errors)", async () => {
    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        deleted: ["img1"],
        errors: ["Missing file"],
      }),
    });

    await performImageAction({
      action: "delete",
      images: [{ id: "i1", src: "img1" }],
    });

    expect(toast.warning).toHaveBeenCalledWith("Missing file");
  });
});
