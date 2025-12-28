/**
 * Sequence-related constants and configuration.
 * Centralized configuration for all sequence types.
 */

import type { SequenceType } from "../types/manifest";

/**
 * Playback configuration per sequence type.
 */
export type SequencePlaybackConfig = {
    delay: number;
    transitionClass: string;
};

/**
 * Playback timing and transition configuration for each sequence type.
 */
export const SEQUENCE_PLAYBACK_CONFIG: Record<SequenceType, SequencePlaybackConfig> = {
    zoom: { delay: 2000, transitionClass: "zoom-mode" },
    timelapse: { delay: 100, transitionClass: "" },
    "focus-stack": { delay: 500, transitionClass: "" },
    pan: { delay: 600, transitionClass: "" },
    burst: { delay: 300, transitionClass: "" },
    pano: { delay: 0, transitionClass: "is-pano" },
} as const;

/**
 * Default frame delay when sequence type is unknown.
 */
export const DEFAULT_FRAME_DELAY_MS = 300;

/**
 * Panorama-specific timing constants.
 */
export const PANO_UPDATE_INTERVAL_MS = 20;
export const PANO_STEP_PER_TICK = 0.05;
export const PANO_START_DELAY_MS = 1000;
export const PANO_PROGRESS_MIN = 0;
export const PANO_PROGRESS_MAX = 100;

/**
 * Badge icons for each sequence type.
 */
export const SEQUENCE_BADGE_ICONS: Record<SequenceType, string> = {
    zoom: "🔍",
    pan: "↔️",
    burst: "📸",
    timelapse: "⏱️",
    "focus-stack": "🎯",
    pano: "🌄",
} as const;

/**
 * Default badge icon for unknown sequence types.
 */
export const DEFAULT_BADGE_ICON = "📷";
