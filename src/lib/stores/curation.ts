import { writable } from "svelte/store";
import type { CurationManifest, CurationGroup } from "$lib/types/manifest";

function createCurationStore() {
  const { subscribe, set, update } = writable<{
    manifest: CurationManifest | null;
    currentGroupIndex: number;
    decisions: Record<string, "keep" | "delete" | "separate">; // imageId -> decision
  }>({
    manifest: null,
    currentGroupIndex: 0,
    decisions: {},
  });

  return {
    subscribe,
    init: (manifest: CurationManifest) => {
      // Initialize decisions based on the recommendation inside the manifest
      const initialDecisions: Record<string, "keep" | "delete" | "separate"> = {};

      manifest.groups.forEach((group) => {
        Object.entries(group.recommendations).forEach(([imageId, rec]) => {
          initialDecisions[imageId] = rec.action; // 'keep' or 'delete'
        });
      });

      set({
        manifest,
        currentGroupIndex: 0,
        decisions: initialDecisions,
      });
    },
    nextGroup: () =>
      update((s) => {
        if (!s.manifest) return s;
        const next = s.currentGroupIndex + 1;
        return {
          ...s,
          currentGroupIndex: Math.min(next, s.manifest.groups.length - 1),
        };
      }),
    prevGroup: () =>
      update((s) => {
        const prev = s.currentGroupIndex - 1;
        return { ...s, currentGroupIndex: Math.max(0, prev) };
      }),
    setDecision: (imageId: string, decision: "keep" | "delete" | "separate") =>
      update((s) => {
        return {
          ...s,
          decisions: { ...s.decisions, [imageId]: decision },
        };
      }),
  };
}

export const curationStore = createCurationStore();
