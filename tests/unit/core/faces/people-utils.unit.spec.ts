import fsp from "node:fs/promises";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { refreshPersonThumbnail } from "../../../../scripts/lib/faces/people";
import type { Person } from "../../../../shared/types/manifest";

// Mock dependencies
vi.mock("node:fs/promises");
vi.mock("node:path", () => ({
  default: {
    resolve: (...args: string[]) => args.join("/"),
    basename: (p: string) => p.split("/").pop() || "",
  },
}));

describe("people utils", () => {
  const facesDir = "/mock/faces";

  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe("refreshPersonThumbnail", () => {
    it("should do nothing if current thumbnail exists", async () => {
      const person: Person = {
        id: "person1",
        name: "Test",
        faceCount: 5,
        thumbnail: "faces/person1/img1.jpg",
        faceDescriptor: [],
        clusters: [],
        createdAt: "",
        lastSeenAt: "",
        hidden: false,
        junk: false,
        category: "person",
      };

      // Mock access to succeed (file exists)
      vi.mocked(fsp.access).mockResolvedValue(undefined);

      await refreshPersonThumbnail(person, facesDir);

      expect(fsp.access).toHaveBeenCalledWith("/mock/faces/person1/img1.jpg");
      expect(person.thumbnail).toBe("faces/person1/img1.jpg");
    });

    it("should find new thumbnail if current one is missing", async () => {
      const person: Person = {
        id: "person1",
        name: "Test",
        faceCount: 5,
        thumbnail: "faces/person1/missing.jpg",
        faceDescriptor: [],
        clusters: [],
        createdAt: "",
        lastSeenAt: "",
        hidden: false,
        junk: false,
        category: "person",
      };

      // Mock access to fail (file missing)
      vi.mocked(fsp.access).mockRejectedValue(new Error("ENOENT"));

      // Mock readdir for findAvailableThumbnail
      vi.mocked(fsp.readdir).mockResolvedValue([
        "img2.jpg" as any,
        "img3.jpg" as any,
        ".DS_Store" as any,
      ]);

      await refreshPersonThumbnail(person, facesDir);

      expect(fsp.access).toHaveBeenCalled();
      expect(fsp.readdir).toHaveBeenCalledWith("/mock/faces/person1");
      expect(person.thumbnail).toBe("faces/person1/img2.jpg");
    });

    it("should set thumbnail to empty string if no images available", async () => {
      const person: Person = {
        id: "person1",
        name: "Test",
        faceCount: 5, // Face count exists, but maybe files are gone
        thumbnail: "faces/person1/missing.jpg",
        faceDescriptor: [],
        clusters: [],
        createdAt: "",
        lastSeenAt: "",
        hidden: false,
        junk: false,
        category: "person",
      };

      vi.mocked(fsp.access).mockRejectedValue(new Error("ENOENT"));
      vi.mocked(fsp.readdir).mockResolvedValue([]);

      await refreshPersonThumbnail(person, facesDir);

      expect(person.thumbnail).toBe("");
    });
  });
});
