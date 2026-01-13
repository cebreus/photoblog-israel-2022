import { cn } from "$lib/utils";
import { renderMarkdown } from "$lib/utils/markup";
import { getMenuItems } from "$lib/utils/menu";
import { loadPage } from "$lib/utils/pages";
import { getSiteManifest } from "$lib/utils/site";
import { formatDateForDisplay, formatDateRange, formatWeekday, toSlug } from "$lib/utils/strings";
import fs from "node:fs/promises";
import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("node:fs/promises");

describe("Basics Utils", function testSuite() {
  describe("cn", function cnSuite() {
    it("should merge class names", function test() {
      expect(cn("a", "b")).toBe("a b");
      expect(cn("px-2 py-1", "px-4")).toBe("py-1 px-4");
    });

    it("should handle conditional classes", function test() {
      expect(cn("a", false && "b", "c")).toBe("a c");
      expect(cn("a", true && "b", "c")).toBe("a b c");
    });
  });

  describe("getSiteManifest", function manifestSuite() {
    it("should return the site manifest", function test() {
      const manifest = getSiteManifest();
      expect(manifest).toBeDefined();
      expect(manifest.seo?.title).toBeDefined();
    });
  });

  describe("getMenuItems", function menuSuite() {
    it("should return menu items", function test() {
      const menu = getMenuItems();
      expect(Array.isArray(menu)).toBe(true);
    });
  });

  describe("loadPage", function pageSuite() {
    beforeEach(function setup() {
      vi.resetAllMocks();
    });

    it("should load a page with front matter and markdown", async function test() {
      const mockMarkdown = `---
title_h1: "Test Title"
excerpt: "Test Excerpt"
jumbo:
  title: "Jumbo Title"
---
# Main Content
This is a test.`;

      vi.mocked(fs.readFile).mockResolvedValue(mockMarkdown);

      const result = await loadPage("test-route");

      expect(result.route).toBe("test-route");
      expect(result.jumbo?.title).toBe("Jumbo Title");
      expect(result.body).toContain("# Main Content");
      expect(result.bodyHtml).toContain("<h1>Main Content</h1>");
      expect(fs.readFile).toHaveBeenCalledWith(
        expect.stringContaining(path.join("content/pages", "test-route", "index.md")),
        "utf-8",
      );
    });

    it("should handle missing jumbo", async function test() {
      const mockMarkdown = `---
title_h1: "No Jumbo"
---
Content`;

      vi.mocked(fs.readFile).mockResolvedValue(mockMarkdown);

      const result = await loadPage("no-jumbo");
      expect(result.jumbo).toBeNull();
    });
  });

  describe("strings", function stringsSuite() {
    it("toSlug", function test() {
      expect(toSlug("Hello World")).toBe("hello-world");
      expect(toSlug("Příliš žluťoučký kůň")).toBe("prilis-zlutoucky-kun");
    });

    it("formatDateForDisplay", function test() {
      expect(formatDateForDisplay("2022-10-25")).toBe("25. října 2022");
    });

    it("formatWeekday", function test() {
      expect(formatWeekday("2022-10-25")).toBe("úterý");
    });

    it("formatDateRange", function test() {
      // Single date
      expect(formatDateRange(["2022-10-25"])).toBe("25. října 2022");

      // Two dates, same month
      expect(formatDateRange(["2022-10-25", "2022-10-26"])).toBe("25. a 26. října 2022");

      // Two dates, different months
      expect(formatDateRange(["2022-10-25", "2022-11-25"])).toBe(
        "25. října 2022 a 25. listopadu 2022",
      );

      // Three dates, same month
      expect(formatDateRange(["2022-10-25", "2022-10-26", "2022-10-27"])).toBe(
        "25.—27. října 2022",
      );

      // Multiple dates, different months
      expect(formatDateRange(["2022-10-25", "2022-11-25", "2022-11-26"])).toBe(
        "25. října 2022 — 26. listopadu 2022",
      );
    });
  });

  describe("markup", function markupSuite() {
    it("renderMarkdown", function test() {
      expect(renderMarkdown("# Test")).toContain("<h1>Test</h1>");
      expect(renderMarkdown(undefined, "<p>Pre-rendered</p>")).toBe("<p>Pre-rendered</p>");
      expect(renderMarkdown()).toBe("");
    });
  });
});
