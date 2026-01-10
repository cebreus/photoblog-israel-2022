// Re-export shared image types used across build and runtime
export * from "$shared/types/images";

// Explicit imports for use in app-specific types
import type { VariantsByFormat } from "$shared/types/images";

// ==========================================
// App-Specific Types Below
// ==========================================

export type Placeholder = {
  base64: string | null;
  width: number | null;
  height: number | null;
  type: string | null;
};

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
  meta?: Meta;
};

export type Manifest = Record<string, ManifestEntry>;
