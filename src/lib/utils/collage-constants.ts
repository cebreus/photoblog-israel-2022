/**
 * Centralized Ambient Background Configuration
 *
 * SHARED (FE + BE):
 * - sampleScale: Downscaling factor (0.1 = 10% for performance)
 * - blurRadius: Gaussian blur sigma
 * - brightness: Multiplier (1.0 = no change, <1.0 = darker)
 * - saturation: Multiplier (1.2 = +20% vibrance)
 * - opacity: Layer transparency (0.3 = 30%)
 * - bleedScale: Overlap factor (1.1 = 10% bleed)
 *
 * FRONTEND:
 * - backdropBlur: CSS backdrop-filter blur
 *
 * BACKEND:
 * - blurPasses: Number of blur iterations (2 = smoother)
 */

export const AMBIENT_SHARED_CONFIG = {
  sampleScale: 0.1,
  blurRadius: 40,
  brightness: 1.0,
  saturation: 1.2,
  opacity: 0.3,
  bleedScale: 1.1,
} as const;

export const AMBIENT_FRONTEND_CONFIG = {
  ...AMBIENT_SHARED_CONFIG,
  backdropBlur: "40px",
} as const;

export const AMBIENT_BACKEND_CONFIG = {
  blurPasses: 2,
} as const;
