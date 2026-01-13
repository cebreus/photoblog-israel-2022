/**
 * @fileoverview Unit tests for message proxy utility
 */

import { COLLAGE_MESSAGES, EMPTY_MESSAGES, IMAGE_MESSAGES } from "$lib/utils/messages";
import { describe, expect, it, vi } from "vitest";

// Mock Paraglide messages
vi.mock("$lib/paraglide/messages", () => {
  return {
    collage_title: vi.fn(() => "Collage Title"),
    image_delete: vi.fn(() => "Delete Image"),
    empty_no_data: vi.fn(() => "No Data Found"),
  };
});

describe("Message Proxies", () => {
  describe("COLLAGE_MESSAGES", () => {
    it("returns correct message for existing key", () => {
      // collage_title exists in mock
      expect(COLLAGE_MESSAGES.TITLE()).toBe("Collage Title");
    });

    it("returns key as fallback for non-existent key", () => {
      // collage_nonexistent does not exist
      expect(COLLAGE_MESSAGES.NON_EXISTENT()).toBe("NON_EXISTENT");
    });
  });

  describe("IMAGE_MESSAGES", () => {
    it("returns correct message for existing key", () => {
      expect(IMAGE_MESSAGES.DELETE()).toBe("Delete Image");
    });
  });

  describe("EMPTY_MESSAGES", () => {
    it("returns correct message for existing key", () => {
      expect(EMPTY_MESSAGES.NO_DATA()).toBe("No Data Found");
    });
  });
});
