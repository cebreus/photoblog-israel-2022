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

/**
 * Calculates a crop rectangle that maximizes usage of the source image
 * while satisfying the target aspect ratio and centering on the detected faces.
 *
 * It effectively implements a "smart object-fit: cover".
 *
 * @param srcW - Width of the source image
 * @param srcH - Height of the source image
 * @param faces - Array of detected face bounding boxes
 * @param targetW - Desired output width (defines aspect ratio)
 * @param targetH - Desired output height (defines aspect ratio)
 * @returns The calculated crop rectangle or null if no faces are provided (fallback to center)
 */
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

  // 1. Calculate the dimensions of the "cover" crop on the source image.
  // We want the largest possible rectangle with the target aspect ratio.
  const targetAR = targetW / targetH;
  const srcAR = srcW / srcH;

  let cropW: number;
  let cropH: number;

  if (srcAR > targetAR) {
    // Source is wider than target.
    // Height is the limiting factor (use full source height).
    cropH = srcH;
    cropW = Math.round(srcH * targetAR);
  } else {
    // Source is taller than target (or equal).
    // Width is the limiting factor (use full source width).
    cropW = srcW;
    cropH = Math.round(srcW / targetAR);
  }

  // 2. Calculate the bounding box of all faces (Union)
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

  // Center of the face union
  const faceCX = (minX + maxX) / 2;
  const faceCY = (minY + maxY) / 2;

  // 3. Center the crop rectangle on the face center
  // Adjust vertical positioning to target "optical center" rather than geometric center.
  // We want the faces to be roughly at 40% of the crop height from the top, to avoid
  // "falling down" composition.
  const targetFaceCenterYRatio = 0.4;

  let cropX = Math.round(faceCX - cropW / 2);
  let cropY = Math.round(faceCY - cropH * targetFaceCenterYRatio);

  // 4. Clamp to image boundaries
  // Ensure we don't go outside the left/top edges
  cropX = Math.max(0, cropX);
  cropY = Math.max(0, cropY);

  // Ensure we don't go outside the right/bottom edges
  // (cropX + cropW) <= srcW
  if (cropX + cropW > srcW) {
    cropX = Math.max(0, srcW - cropW);
  }
  // (cropY + cropH) <= srcH
  if (cropY + cropH > srcH) {
    cropY = Math.max(0, srcH - cropH);
  }

  return {
    left: cropX,
    top: cropY,
    width: cropW,
    height: cropH,
  };
}
