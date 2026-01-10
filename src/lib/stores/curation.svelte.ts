import type { CurationManifest } from "$lib/types/manifest";

function createCurationState() {
  let manifest = $state<CurationManifest | null>(null);
  let currentGroupIndex = $state(0);
  let decisions = $state<Record<string, "keep" | "delete" | "separate">>({});

  function init(manifestData: CurationManifest) {
    const initialDecisions: Record<string, "keep" | "delete" | "separate"> = {};

    for (const group of manifestData.groups) {
      for (const [imageId, rec] of Object.entries(group.recommendations)) {
        initialDecisions[imageId] = rec.action; // 'keep' or 'delete'
      }
    }

    manifest = manifestData;
    currentGroupIndex = 0;
    decisions = initialDecisions;
  }

  function nextGroup() {
    if (!manifest) return;
    const next = currentGroupIndex + 1;
    currentGroupIndex = Math.min(next, manifest.groups.length - 1);
  }

  function prevGroup() {
    const prev = currentGroupIndex - 1;
    currentGroupIndex = Math.max(0, prev);
  }

  function setDecision(imageId: string, decision: "keep" | "delete" | "separate") {
    decisions[imageId] = decision;
  }

  return {
    get manifest() {
      return manifest;
    },
    set manifest(v) {
      manifest = v;
    },
    get currentGroupIndex() {
      return currentGroupIndex;
    },
    set currentGroupIndex(v) {
      currentGroupIndex = v;
    },
    get decisions() {
      return decisions;
    },
    set decisions(v) {
      decisions = v;
    },
    init,
    nextGroup,
    prevGroup,
    setDecision,
  };
}

export const curation = createCurationState();
