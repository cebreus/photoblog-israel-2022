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

  let cropW: number;
  let cropH: number;

  if (srcAR > targetAR) {
    cropH = srcH;
    cropW = Math.round(srcH * targetAR);
  } else {
    cropW = srcW;
    cropH = Math.round(srcW / targetAR);
  }

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

  const faceCX = (minX + maxX) / 2;
  const faceCY = (minY + maxY) / 2;

  const targetFaceCenterYRatio = 0.4;

  let cropX = Math.round(faceCX - cropW / 2);
  let cropY = Math.round(faceCY - cropH * targetFaceCenterYRatio);

  cropX = Math.max(0, cropX);
  cropY = Math.max(0, cropY);

  if (cropX + cropW > srcW) {
    cropX = Math.max(0, srcW - cropW);
  }
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
