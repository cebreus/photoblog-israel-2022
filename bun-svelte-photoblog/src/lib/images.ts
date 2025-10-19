import manifest from '$lib/images.manifest.json';

// Lightweight runtime types mirroring the d.ts to avoid type import issues in TS tooling
export type Variant = {
  width: number;
  height: number;
  path: string;
  bytes: number;
};
export type VariantsByFormat = {
  avif?: Variant[];
  webp?: Variant[];
  jpeg?: Variant[];
};
export type Placeholder = {
  base64: string | null;
  width: number | null;
  height: number | null;
  type: string | null;
};

/**
 * EXIF/IPTC metadata přítomná v manifestu (volitelná).
 * Slouží k seskupování a popiskům na úrovni runtime.
 */
export type Meta = {
  date: string | null;
  groupBy: string | null;
  city?: string | null;
  where?: string | null;
  country?: string | null;
  keywords?: string[] | string | null;
  objectName?: string | null;
  caption?: string | null;
  type?: string | null;
};

export type ManifestEntry = {
  original: {
    width: number | null;
    height: number | null;
    format: string | null;
    bytes: number;
    path: string | null;
  };
  variants: VariantsByFormat;
  placeholder: Placeholder | null;
  color: string | null;
  hash: string;
  outputs: string[];
  meta?: Meta; // doplněno pro dataset.ts
};
export type Manifest = Record<string, ManifestEntry>;

// Narrow type for the imported JSON
const data: Manifest = manifest as unknown as Manifest;

// Helpers

export function findImage(srcKey: string): ManifestEntry | undefined {
  return data[srcKey];
}

export function buildSrcSet(entry: ManifestEntry, format: keyof VariantsByFormat): string {
  // Obrana proti starším/nekonzistentním manifestům, kde může být variants = undefined
  const list = entry.variants?.[format] ?? [];
  return list.map((v) => `${v.path} ${v.width}w`).join(', ');
}

function pickLargest(variants?: Variant[]): Variant | undefined {
  if (!variants || variants.length === 0) return undefined;
  return variants.reduce((max, v) => (v.width > (max?.width ?? 0) ? v : max), variants[0]);
}

export function pickFallback(entry: ManifestEntry): { src: string; type: string } | null {
  // Prefer JPEG, then WEBP, then original (if kept), else any available
  const largestJpeg = pickLargest(entry.variants?.jpeg);
  if (largestJpeg) return { src: largestJpeg.path, type: 'image/jpeg' };
  const largestWebp = pickLargest(entry.variants?.webp);
  if (largestWebp) return { src: largestWebp.path, type: 'image/webp' };
  if (entry.original && entry.original.path) {
    const fmt = (entry.original.format ?? 'jpeg').toLowerCase();
    const type = fmt === 'jpg' ? 'image/jpeg' : `image/${fmt}`;
    return { src: entry.original.path, type };
  }
  // As a last resort, take any format
  const anyFmt = (['jpeg', 'webp', 'avif'] as const).find((f) => (entry.variants?.[f]?.length ?? 0) > 0);
  if (anyFmt) {
    const v = pickLargest(entry.variants?.[anyFmt]);
    if (v) return { src: v.path, type: `image/${anyFmt}` };
  }
  return null;
}

export function getSources(entry: ManifestEntry, sizes = '100vw'): Array<{ type: string; srcset: string; sizes: string }> {
  const sources: Array<{ type: string; srcset: string; sizes: string }> = [];
  const avif = buildSrcSet(entry, 'avif');
  if (avif) sources.push({ type: 'image/avif', srcset: avif, sizes });
  const webp = buildSrcSet(entry, 'webp');
  if (webp) sources.push({ type: 'image/webp', srcset: webp, sizes });
  return sources;
}

export function getImgFallback(entry: ManifestEntry, sizes = '100vw'): { src: string; srcset?: string; sizes?: string; type: string } | null {
  // Use JPEG srcset if available, otherwise WEBP, finally original
  const jpegSet = buildSrcSet(entry, 'jpeg');
  if (jpegSet) {
    const jpegLargest = pickLargest(entry.variants?.jpeg);
    return { src: jpegLargest?.path ?? jpegSet.split(',')[0].split(' ')[0], srcset: jpegSet, sizes, type: 'image/jpeg' };
  }
  const webpSet = buildSrcSet(entry, 'webp');
  if (webpSet) {
    const webpLargest = pickLargest(entry.variants?.webp);
    return { src: webpLargest?.path ?? webpSet.split(',')[0].split(' ')[0], srcset: webpSet, sizes, type: 'image/webp' };
  }
  const fb = pickFallback(entry);
  if (fb) return { src: fb.src, type: fb.type };
  return null;
}

export function placeholderBackgroundStyle(entry: ManifestEntry | undefined | null): string | undefined {
  const ph = entry?.placeholder;
  if (!ph || !ph.base64 || !ph.type) return undefined;
  const url = `data:${ph.type};base64,${ph.base64}`;
  return `background-image:url('${url}');background-size:cover;background-position:center;background-repeat:no-repeat;`;
}

export function dominantColorStyle(entry: ManifestEntry | undefined | null): string | undefined {
  const c = entry?.color;
  return c ? `background-color:${c};` : undefined;
}

// Convenience export for consumers that want to inspect the whole manifest
export function getManifest(): Manifest {
  return data;
}
