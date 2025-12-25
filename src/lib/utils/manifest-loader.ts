import type { AnalysisManifest, FacesManifest, Manifest, PeopleManifest } from "../types/manifest";

/**
 * Merges split manifests into a unified structure.
 * This is the runtime equivalent of the "Link" step in "Split & Link".
 */
export function mergeManifests(
  manifest: Manifest,
  faces: FacesManifest | null,
  analysis: AnalysisManifest | null,
  _people: PeopleManifest | null,
): Manifest {
  // Deep clone to avoid mutating the original manifest if it's imported JSON
  // In a real app we might optimize this, but for safety clone first
  const merged = structuredClone(manifest);

  merged.photoDays.forEach((day) => {
    day.items.forEach((item) => {
      if (item.type !== "image") return;

      // 1. Merge Faces (Critical for smart cropping)
      if (faces?.[item.id]) {
        const faceData = faces[item.id];
        item.analysis = item.analysis || {
          sharpness: 0,
          phash: "",
        };

        item.analysis.facesDetected = faceData.facesDetected;
        item.analysis.faces = faceData.faces;

        // Link people IDs if available (legacy support on image object)
        if (faceData.peopleIds && faceData.peopleIds.length > 0) {
          item.people = Array.from(new Set([...(item.people || []), ...faceData.peopleIds]));
        }
      }

      // 2. Merge Analysis (AI scores)
      if (analysis?.[item.id]) {
        const analysisData = analysis[item.id];
        item.analysis = item.analysis || {
          sharpness: 0,
          phash: "",
        };

        // Only overwrite if value exists in source
        if (analysisData.aestheticScore !== undefined) {
          item.analysis.aestheticScore = analysisData.aestheticScore;
        }
        if (analysisData.sharpness !== undefined) {
          item.analysis.sharpness = analysisData.sharpness;
        }
        if (analysisData.phash) {
          item.analysis.phash = analysisData.phash;
        }
        if (analysisData.qualityBucket) {
          item.analysis.qualityBucket = analysisData.qualityBucket;
        }
      }
    });
  });

  return merged;
}
