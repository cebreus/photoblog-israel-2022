export type CollageTemplateId =
  | "row"
  | "column"
  | "grid-2x2"
  | "hero-top"
  | "hero-left"
  | "hero-right"
  | "density-7"
  | "grid-3x2"
  | "mosaic-6"
  | "sidebar-hero";

export interface CollageBorder {
  width: number;
  userSetting?: number; // Original input value (before normalization)
}

export interface CollageBackground {
  style: "ambient" | "color";
  color?: string; // Only used when style="color"
}

export interface CollageCrop {
  x: number; // 0-100 (percentage)
  y: number; // 0-100 (percentage)
  scale: number; // >= 1
}

export interface CollageItemConfig {
  imageId: string; // File path for backend processing
  id?: string; // Image ID from manifest (for re-edit correlation)
  crop?: CollageCrop;
  originalPath?: string; // Path before move (for re-edit reference)
  movedPath?: string; // Path after move to collage-sources
}

export interface CollageMetadata {
  name: string; // Output filename
  created: string; // ISO timestamp
  canvasWidth: number; // Final canvas dimensions
  canvasHeight: number;
}

export interface CollageRequest {
  items: CollageItemConfig[];
  template: CollageTemplateId;
  border?: CollageBorder;
  background?: CollageBackground;
  aspectRatio?: string; // Selected ratio preset (e.g., "auto", "16:9", "4:3")
  metadata?: CollageMetadata; // Added by backend when saving
}

export interface CollageResponse {
  success: boolean;
  outputPath?: string; // Relative to CONTENT_DIR
  error?: string;
}
