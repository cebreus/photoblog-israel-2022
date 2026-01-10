/**
 * @fileoverview Component tests for SequenceBadge.
 *
 * Tests the sequence badge component that displays type icons and counts
 * on sequence items in the photo grid.
 */

import { page } from "@vitest/browser/context";
import { describe, expect, it } from "vitest";
import type { SequenceInfo } from "$shared/types/manifest";
import SequenceBadge from "../../../src/lib/components/SequenceBadge.svelte";
import { renderComponent } from "$tests/utils/render-helpers";

function createSequenceInfo(
  type: SequenceInfo["type"],
  total: number,
  index?: number,
): SequenceInfo {
  return {
    type,
    total,
    index: index ?? total,
    baseId: "test-base-id",
  };
}

describe("SequenceBadge Component", () => {
  it("renders with correct testid", async () => {
    const info = createSequenceInfo("zoom", 3);
    renderComponent(SequenceBadge, { info });

    const badge = page.getByTestId("sequence-badge");
    await expect.element(badge).toBeInTheDocument();
  });

  it("displays zoom icon with multiplier format", async () => {
    const info = createSequenceInfo("zoom", 5);
    renderComponent(SequenceBadge, { info });

    const badge = page.getByTestId("sequence-badge");
    await expect.element(badge).toBeInTheDocument();

    const element = badge.element();
    const text = element?.textContent || "";

    expect(text).toContain("🔍");
    expect(text).toContain("5×");
  });

  it("displays pan icon without multiplier", async () => {
    const info = createSequenceInfo("pan", 4);
    renderComponent(SequenceBadge, { info });

    const badge = page.getByTestId("sequence-badge");
    await expect.element(badge).toBeInTheDocument();

    const element = badge.element();
    const text = element?.textContent || "";

    expect(text).toContain("↔️");
    expect(text).toContain("4");
    expect(text).not.toContain("×");
  });

  it("displays burst icon for burst sequences", async () => {
    const info = createSequenceInfo("burst", 8);
    renderComponent(SequenceBadge, { info });

    const badge = page.getByTestId("sequence-badge");
    await expect.element(badge).toBeInTheDocument();

    const element = badge.element();
    const text = element?.textContent || "";

    expect(text).toContain("📸");
  });

  it("displays timelapse icon", async () => {
    const info = createSequenceInfo("timelapse", 24);
    renderComponent(SequenceBadge, { info });

    const badge = page.getByTestId("sequence-badge");
    await expect.element(badge).toBeInTheDocument();

    const element = badge.element();
    const text = element?.textContent || "";

    expect(text).toContain("⏱️");
    expect(text).toContain("24");
  });

  it("displays focus-stack icon", async () => {
    const info = createSequenceInfo("focus-stack", 3);
    renderComponent(SequenceBadge, { info });

    const badge = page.getByTestId("sequence-badge");
    await expect.element(badge).toBeInTheDocument();

    const element = badge.element();
    const text = element?.textContent || "";

    expect(text).toContain("🎯");
  });

  it("displays pano icon for panoramas", async () => {
    const info = createSequenceInfo("pano", 1);
    renderComponent(SequenceBadge, { info });

    const badge = page.getByTestId("sequence-badge");
    await expect.element(badge).toBeInTheDocument();

    const element = badge.element();
    const text = element?.textContent || "";

    expect(text).toContain("🌄");
  });

  it("has correct styling classes", async () => {
    const info = createSequenceInfo("zoom", 3);
    renderComponent(SequenceBadge, { info });

    const badge = page.getByTestId("sequence-badge");
    await expect.element(badge).toBeInTheDocument();

    const element = badge.element();
    const className = element?.className || "";

    expect(className).toContain("absolute");
    expect(className).toContain("rounded");
    expect(className).toContain("backdrop-blur");
  });
});
