import type { CurationManifest } from "$lib/types/manifest";

export class CurationState {
  manifest = $state<CurationManifest | null>(null);
  currentGroupIndex = $state(0);
  decisions = $state<Record<string, "keep" | "delete" | "separate">>({});

  init(manifest: CurationManifest) {
    const initialDecisions: Record<string, "keep" | "delete" | "separate"> = {};

    for (const group of manifest.groups) {
      for (const [imageId, rec] of Object.entries(group.recommendations)) {
        initialDecisions[imageId] = rec.action; // 'keep' or 'delete'
      }
    }

    this.manifest = manifest;
    this.currentGroupIndex = 0;
    this.decisions = initialDecisions;
  }

  nextGroup() {
    if (!this.manifest) return;
    const next = this.currentGroupIndex + 1;
    this.currentGroupIndex = Math.min(next, this.manifest.groups.length - 1);
  }

  prevGroup() {
    const prev = this.currentGroupIndex - 1;
    this.currentGroupIndex = Math.max(0, prev);
  }

  setDecision(imageId: string, decision: "keep" | "delete" | "separate") {
    this.decisions[imageId] = decision;
  }
}

export const curation = new CurationState();
