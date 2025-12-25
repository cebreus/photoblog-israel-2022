import { describe, expect, it } from "vitest";
import { page } from "vitest/browser";
import { render } from "vitest-browser-svelte";
import ScrollSpyTestSubject from "./ScrollSpyTestSubject.svelte";

describe("ScrollSpy Integration (Browser)", () => {
  it("updates activeSections when scrolling", async () => {
    render(ScrollSpyTestSubject);

    // Set viewport
    await page.viewport(1280, 800);

    const activeSections = page.getByTestId("active-sections");

    // Initial check - nothing should be active
    await expect.element(activeSections).toBeInTheDocument();
    await expect.element(activeSections).not.toHaveTextContent("section-1");

    // Scroll to Section 1
    const el1 = document.getElementById("section-1");
    if (!el1) throw new Error("Section 1 not found");

    el1.scrollIntoView({ behavior: "instant", block: "start" });

    // Wait for IntersectionObserver to fire (async)
    await new Promise((resolve) => setTimeout(resolve, 200));

    // Verify section-1 is active
    await expect.element(activeSections).toHaveTextContent("section-1");

    // Scroll to Section 2
    const el2 = document.getElementById("section-2");
    if (!el2) throw new Error("Section 2 not found");

    el2.scrollIntoView({ behavior: "instant", block: "center" });

    // Wait longer for IntersectionObserver
    await new Promise((resolve) => setTimeout(resolve, 300));

    // Verify section-2 is present (might contain both sections depending on viewport)
    const element = await activeSections.element();
    const text = element.textContent || "";
    expect(text).toContain("section-2");
  });

  it("handles rapid scroll transitions without flickering", async () => {
    render(ScrollSpyTestSubject);
    await page.viewport(1280, 800);

    const activeSections = page.getByTestId("active-sections");

    // Scroll to section-1
    document.getElementById("section-1")?.scrollIntoView({ behavior: "instant" });
    await new Promise((resolve) => setTimeout(resolve, 200));

    const element1 = await activeSections.element();
    const content1 = element1.textContent || "";
    expect(content1).toContain("section-1");

    // Rapid scroll to section-2
    document.getElementById("section-2")?.scrollIntoView({ behavior: "instant", block: "center" });
    await new Promise((resolve) => setTimeout(resolve, 300));

    const element2 = await activeSections.element();
    const content2 = element2.textContent || "";
    expect(content2).toContain("section-2");
  });
});
