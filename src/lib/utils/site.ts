import type { SiteManifest } from "$lib/types/manifest";
import manifest from "$manifests/site.manifest.json" with { type: "json" };

export function getSiteManifest(): SiteManifest {
  return manifest as SiteManifest;
}
