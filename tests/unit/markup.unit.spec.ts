import { describe, it, expect } from "vitest";
import { renderStoryHtml, renderMarkdown } from "../../src/lib/markup";
import type { Separator } from "../../src/lib/types/manifest";

describe("renderStoryHtml", () => {
  it("returns empty string when separator.story is missing", () => {
    const separator: Separator = {
      type: "separator",
      id: "sep-1",
      location: "Location",
      city: "City",
      story: undefined,
    };
    expect(renderStoryHtml(separator)).toBe("");
  });

  it("returns the pre-rendered HTML story from the separator object", () => {
    const htmlStory = "<h1>Hello</h1><p>This is a story.</p>";
    const separator: Separator = {
      type: "separator",
      id: "sep-2",
      location: "Location",
      city: "City",
      story: htmlStory,
    };
    expect(renderStoryHtml(separator)).toBe(htmlStory);
  });
});

describe("renderMarkdown", () => {
  it("returns pre-rendered html when provided", () => {
    const pre = "<p>PRE</p>";
    expect(renderMarkdown("# Hello", pre)).toBe(pre);
  });

  it("renders basic markdown when no pre-rendered html present", () => {
    const out = renderMarkdown("# Hi");
    expect(out.includes("<h1")).toBe(true);
  });
});
