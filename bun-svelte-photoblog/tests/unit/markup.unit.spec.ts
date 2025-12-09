import { describe, it, expect } from "vitest";
import { renderStoryHtml, renderMarkdown } from "../../src/lib/utils/markup";

describe("renderStoryHtml", () => {
  it("returns empty string for missing content", () => {
    // @ts-ignore
    expect(renderStoryHtml(undefined)).toBe("");
  });

  it("renders basic markdown", () => {
    const out = renderStoryHtml("# Hello");
    // should include an <h1> for '# Hello'
    expect(out.includes("<h1") || out.includes("<h1>")).toBe(true);
  });

  it("returns pre-rendered storyHtml when present", () => {
    const pre = "<p>pre-rendered</p>";
    // If pre-rendered content is provided as second arg, it should be returned
    const out = renderStoryHtml("some markdown", pre);

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
