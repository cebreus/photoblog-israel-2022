import { describe, it, expect } from "vitest";
import { renderStoryHtml, renderMarkdown } from "../../src/lib/utils/markup";

describe("renderStoryHtml", () => {
  it("returns empty string for missing content", () => {
    expect(
      renderStoryHtml({ type: "separator", id: "s", location: "L" } as any),
    ).toBe("");
  });

  it("renders basic markdown", () => {
    const out = renderStoryHtml({
      type: "separator",
      id: "s",
      location: "L",
      storyContent: "# Hello",
    } as any);
    // should include an <h1> for '# Hello'
    expect(out.includes("<h1") || out.includes("<h1>")).toBe(true);
  });

  it("returns pre-rendered storyHtml when present", () => {
    const pre = "<p>pre-rendered</p>";
    const out = renderStoryHtml({
      type: "separator",
      id: "s",
      location: "L",
      storyHtml: pre,
    } as any);

    expect(out).toBe(pre);
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
