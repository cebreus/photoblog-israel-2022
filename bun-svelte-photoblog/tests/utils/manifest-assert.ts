/**
 * Normalizace manifestu pro snapshot porovnání.
 * Odstraní nedeterministické položky (bytes, hash, dynamické pořadí výstupů),
 * ponechá strukturu (rozměry, cesty, formáty, placeholder metainformace).
 */

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
} | null;

export type ManifestEntry = {
  original: {
    width: number | null;
    height: number | null;
    format: string | null;
    bytes: number;
    path: string | null;
  };
  variants: VariantsByFormat;
  placeholder: Placeholder;
  color: string | null;
  hash: string;
  outputs: string[];
};

export type Manifest = Record<string, ManifestEntry>;

type NormalizedVariant = { width: number; height: number; path: string };
type NormalizedEntry = {
  original: {
    width: number | null;
    height: number | null;
    format: string | null;
    path: string | null;
  };
  variants: {
    avif?: NormalizedVariant[];
    webp?: NormalizedVariant[];
    jpeg?: NormalizedVariant[];
  };
  placeholder: {
    width: number | null;
    height: number | null;
    type: string | null;
  } | null;
  color: string | null;
  outputs: string[];
};

/**
 * Seřadí a normalizuje varianty (bez bytes), placeholder (bez base64),
 * a outputs (seřazené). Vrátí stabilní JSON-serializovatelnou strukturu.
 */
export function normalizeManifest(
  m: Manifest,
): Record<string, NormalizedEntry> {
  const out: Record<string, NormalizedEntry> = {};
  const keys = Object.keys(m).sort((a, b) => a.localeCompare(b));
  for (const k of keys) {
    const e = m[k];
    const mapV = (arr?: Variant[]) =>
      arr
        ? arr
            .map((v) => ({ height: v.height, path: v.path, width: v.width }))
            .sort((a, b) => a.width - b.width || a.path.localeCompare(b.path))
        : undefined;

    out[k] = {
      original: {
        format: e.original.format,
        height: e.original.height,
        path: e.original.path,
        width: e.original.width,
      },
      variants: {
        avif: mapV(e.variants.avif),
        webp: mapV(e.variants.webp),
        jpeg: mapV(e.variants.jpeg),
      },
      placeholder: e.placeholder
        ? {
            height: e.placeholder.height,
            type: e.placeholder.type,
            width: e.placeholder.width,
          }
        : null,
      color: e.color,
      outputs: [...e.outputs].sort((a, b) => a.localeCompare(b)),
    };
  }
  return out;
}
