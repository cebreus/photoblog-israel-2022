import { describe, expect, it } from "vitest";
import { getNewBasename } from "../../scripts/rename-images";

describe("getNewBasename", () => {
  it("should format date and author from valid EXIF", () => {
    const mockDate = {
      toDate: () => new Date("2023-10-25T14:30:00"),
      getSeconds: () => 0,
    };
    const tags = {
      DateTimeOriginal: mockDate,
      Artist: "John Doe",
    };
    const result = getNewBasename(tags, "default");
    // 2023-10-25-143000-john-doe
    expect(result).toBe("2023-10-25-143000-john-doe");
  });

  it("should use CreateDate if DateTimeOriginal is missing", () => {
    const mockDate = {
      toDate: () => new Date("2022-01-01T09:00:00"),
    };
    const tags = {
      CreateDate: mockDate,
      Creator: "Jane Doe",
    };
    const result = getNewBasename(tags, "default");
    expect(result).toBe("2022-01-01-090000-jane-doe");
  });

  it("should fall back to default author if missing in EXIF", () => {
    const mockDate = {
      toDate: () => new Date("2022-01-01T09:00:00"),
    };
    const tags = {
      DateTimeOriginal: mockDate,
    };
    const result = getNewBasename(tags, "fallback-author");
    expect(result).toBe("2022-01-01-090000-fallback-author");
  });

  it("should use original basename as author fallback if missing in EXIF", () => {
    const mockDate = {
      toDate: () => new Date("2022-01-01T09:00:00"),
      getSeconds: () => 0,
    };
    const tags = {
      DateTimeOriginal: mockDate,
    };
    const result = getNewBasename(tags, "", "img_1234");
    // 2022-01-01-090000-img1234
    expect(result).toBe("2022-01-01-090000-img1234");
  });

  it("should omit author if missing and no original basename provided", () => {
    const mockDate = {
      toDate: () => new Date("2022-01-01T09:00:00"),
      getSeconds: () => 0,
    };
    const tags = { DateTimeOriginal: mockDate };
    const result = getNewBasename(tags, "");
    expect(result).toBe("2022-01-01-090000");
  });

  it("should handle date strings if toDate is missing", () => {
    const tags = {
      DateTimeOriginal: "2021-12-31T23:59:59",
      Author: "Test Bot",
    };
    const result = getNewBasename(tags, "default");
    expect(result).toBe("2021-12-31-235959-test-bot");
  });

  it("should sanitize author names", () => {
    const mockDate = { toDate: () => new Date("2023-01-01T12:00:00") };
    const tags = {
      DateTimeOriginal: mockDate,
      Artist: "Héllo Wörld",
    };
    const result = getNewBasename(tags, "def");
    expect(result).toBe("2023-01-01-120000-hello-world");
  });

  it("should handle array authors", () => {
    const mockDate = { toDate: () => new Date("2023-01-01T12:00:00") };
    const tags = {
      DateTimeOriginal: mockDate,
      "dc:creator": ["First Guy", "Second Guy"],
    };
    const tagsCreator = {
      DateTimeOriginal: mockDate,
      Creator: ["First Guy", "Second Guy"],
    };
    const result = getNewBasename(tagsCreator, "def");
    expect(result).toBe("2023-01-01-120000-first-guy");
  });
});
