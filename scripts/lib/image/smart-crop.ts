import { config } from "../../build.config";

export interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface CropRect {
  left: number;
  top: number;
  width: number;
  height: number;
}
export function calculateSmartCrop(
  srcW: number,
  srcH: number,
  faces: Box[],
  targetW: number,
  targetH: number,
): CropRect | null {
  if (!faces || faces.length === 0) {
    return null;
  }

  const targetAR = targetW / targetH;
  const srcAR = srcW / srcH;

  // 1. Determine the bounding box of all faces
  let minX = faces[0].x;
  let minY = faces[0].y;
  let maxX = faces[0].x + faces[0].width;
  let maxY = faces[0].y + faces[0].height;

  for (let i = 1; i < faces.length; i++) {
    const f = faces[i];
    minX = Math.min(minX, f.x);
    minY = Math.min(minY, f.y);
    maxX = Math.max(maxX, f.x + f.width);
    maxY = Math.max(maxY, f.y + f.height);
  }

  const groupW = maxX - minX;
  const groupH = maxY - minY;
  const faceCX = (minX + maxX) / 2;
  const faceCY = (minY + maxY) / 2;

  // 2. Calculate initial crop dimensions based on target aspect ratio and zoom
  const zoom = config.script.cropFaceZoom || 1.0;

  let cropW: number;
  let cropH: number;

  if (srcAR > targetAR) {
    // Source is wider than target
    cropH = srcH / zoom;
    cropW = cropH * targetAR;
  } else {
    // Source is taller than target
    cropW = srcW / zoom;
    cropH = cropW / targetAR;
  }

  // 3. Safety: Ensure crop window is large enough to contain the face group (with 20% padding)
  const padding = 1.2;
  const minRequiredW = groupW * padding;
  const minRequiredH = groupH * padding;

  if (cropW < minRequiredW || cropH < minRequiredH) {
    const scale = Math.max(minRequiredW / cropW, minRequiredH / cropH);
    cropW *= scale;
    cropH *= scale;
  }

  // 4. Final safety: Don't exceed source dimensions
  if (cropW > srcW) {
    cropW = srcW;
    cropH = cropW / targetAR;
  }
  if (cropH > srcH) {
    cropH = srcH;
    cropW = cropH * targetAR;
  }

  // 5. Calculate top-left based on face center and optical centering (default 40% from top)
  const targetFaceCenterYRatio = config.script.cropFaceCenterRatio;

  let cropX = Math.round(faceCX - cropW / 2);
  let cropY = Math.round(faceCY - cropH * targetFaceCenterYRatio);

  // 6. Clamp to image boundaries
  cropX = Math.max(0, Math.min(cropX, srcW - cropW));
  cropY = Math.max(0, Math.min(cropY, srcH - cropH));

  return {
    left: Math.round(cropX),
    top: Math.round(cropY),
    width: Math.round(cropW),
    height: Math.round(cropH),
  };
}
