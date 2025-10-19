// Typová deklarace pro statický import JSON manifestu obrázků
// Umožní: import manifest from '$lib/images.manifest.json';

export type Variant = {
  width: number;
  height: number;
  path: string; // public path e.g. /images/album/photo.w640.webp
  bytes: number;
};

export type VariantsByFormat = {
  avif?: Variant[];
  webp?: Variant[];
  jpeg?: Variant[];
};

export type Placeholder = {
  base64: string | null; // base64 bez "data:" prefixu
  width: number | null;
  height: number | null;
  type: string | null; // např. "image/jpeg"
};

export type ManifestEntry = {
  original: {
    width: number | null;
    height: number | null;
    format: string | null;
    bytes: number;
    path: string | null; // pokud --keep-original nebo v fallback režimu copy
  };
  variants: VariantsByFormat;
  placeholder: Placeholder | null;
  color: string | null; // hex "#RRGGBB"
  hash: string; // SHA-1 originálu
  outputs: string[]; // public cesty všech výstupů pro čištění
};

export type Manifest = Record<string, ManifestEntry>;

declare module '$lib/images.manifest.json' {
  const manifest: Manifest;
  export default manifest;
}
