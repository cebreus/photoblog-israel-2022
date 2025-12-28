/**
 * Runtime utilities for detecting and working with image sequences.
 * Re-exports from shared utilities for use in Svelte components.
 *
 * Uses the $shared path alias for cleaner imports.
 */

export {
  getSequenceMembers,
  isPanorama,
  isRepresentative,
  isSequenceMember,
  parseSequenceSuffix,
  SEQUENCE_REGEX,
  TYPE_MAP,
} from "$shared/utils/sequences";
