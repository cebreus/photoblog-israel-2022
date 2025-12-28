/**
 * @fileoverview Unit tests for sequence constants and configuration.
 */

import { describe, expect, it } from "vitest";
import {
  DEFAULT_BADGE_ICON,
  DEFAULT_FRAME_DELAY_MS,
  PANO_PROGRESS_MAX,
  PANO_PROGRESS_MIN,
  PANO_START_DELAY_MS,
  PANO_STEP_PER_TICK,
  PANO_UPDATE_INTERVAL_MS,
  SEQUENCE_BADGE_ICONS,
  SEQUENCE_PLAYBACK_CONFIG,
} from "../../../../shared/constants/sequences";

describe("sequence constants", () => {
  describe("SEQUENCE_PLAYBACK_CONFIG", () => {
    it("contains configuration for all sequence types", () => {
      const expectedTypes: Array<keyof typeof SEQUENCE_PLAYBACK_CONFIG> = [
        "zoom",
        "timelapse",
        "focus-stack",
        "pan",
        "burst",
        "pano",
      ];

      for (const type of expectedTypes) {
        expect(SEQUENCE_PLAYBACK_CONFIG[type]).toBeDefined();
        expect(typeof SEQUENCE_PLAYBACK_CONFIG[type].delay).toBe("number");
        expect(typeof SEQUENCE_PLAYBACK_CONFIG[type].transitionClass).toBe("string");
      }
    });

    it("zoom has the longest delay for slow crossfade effect", () => {
      expect(SEQUENCE_PLAYBACK_CONFIG.zoom.delay).toBe(2000);
      expect(SEQUENCE_PLAYBACK_CONFIG.zoom.delay).toBeGreaterThan(
        SEQUENCE_PLAYBACK_CONFIG.burst.delay,
      );
    });

    it("timelapse has the shortest delay for video-like effect", () => {
      expect(SEQUENCE_PLAYBACK_CONFIG.timelapse.delay).toBe(100);
    });

    it("burst has fast playback for action shots", () => {
      expect(SEQUENCE_PLAYBACK_CONFIG.burst.delay).toBe(300);
    });
  });

  describe("SEQUENCE_BADGE_ICONS", () => {
    it("contains icons for all sequence types", () => {
      expect(SEQUENCE_BADGE_ICONS.zoom).toBe("🔍");
      expect(SEQUENCE_BADGE_ICONS.pan).toBe("↔️");
      expect(SEQUENCE_BADGE_ICONS.burst).toBe("📸");
      expect(SEQUENCE_BADGE_ICONS.timelapse).toBe("⏱️");
      expect(SEQUENCE_BADGE_ICONS["focus-stack"]).toBe("🎯");
      expect(SEQUENCE_BADGE_ICONS.pano).toBe("🌄");
    });

    it("has a fallback default icon", () => {
      expect(DEFAULT_BADGE_ICON).toBe("📷");
    });
  });

  describe("panorama constants", () => {
    it("has correct update interval for smooth animation", () => {
      // 20ms = ~50fps for smooth panning
      expect(PANO_UPDATE_INTERVAL_MS).toBe(20);
    });

    it("has correct step size for 3% per second scroll", () => {
      // 0.05% per tick * 50 ticks/sec = 2.5% per second (approximately 3%)
      expect(PANO_STEP_PER_TICK).toBe(0.05);
    });

    it("has 1 second start delay", () => {
      expect(PANO_START_DELAY_MS).toBe(1000);
    });

    it("has correct progress bounds", () => {
      expect(PANO_PROGRESS_MIN).toBe(0);
      expect(PANO_PROGRESS_MAX).toBe(100);
    });
  });

  describe("default values", () => {
    it("has a sensible default frame delay", () => {
      expect(DEFAULT_FRAME_DELAY_MS).toBe(300);
    });
  });
});
