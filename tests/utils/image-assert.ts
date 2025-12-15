import sharp from "sharp";
import pixelmatch from "pixelmatch";
import { PNG } from "pngjs";

export type PixelCompareOptions = {
  threshold?: number; // 0..1
  maxDiffPixels?: number; // absolutní limit odlišných pixelů
  resizeWidth?: number; // volitelné sjednocení šířky před porovnáním
};

export async function toPngBuffer(inputPath: string, width?: number): Promise<Buffer> {
  const img = sharp(inputPath);
  const resized = width ? img.resize({ width, fit: "inside", withoutEnlargement: true }) : img;
  // Převod do PNG kvůli pixelmatch
  return await resized.png({ compressionLevel: 9 }).toBuffer();
}

/**
 * Porovná dvě bitmapy s tolerancí a volitelně vrátí diff PNG.
 * - threshold: citlivost pixelmatch (0..1)
 * - maxDiffPixels: povolený počet odlišných pixelů (absolutní)
 * - resizeWidth: sjednotí velikost pro porovnání (užitečné u ztrátových enkodérů)
 */
export async function compareImagesWithTolerance(
  aPath: string,
  bPath: string,
  opts: PixelCompareOptions = {},
) {
  const threshold = opts.threshold ?? 0.1;
  const maxDiffPixels = opts.maxDiffPixels ?? 0;

  const [aBuf, bBuf] = await Promise.all([
    toPngBuffer(aPath, opts.resizeWidth),
    toPngBuffer(bPath, opts.resizeWidth),
  ]);
  const aPng = PNG.sync.read(aBuf);
  const bPng = PNG.sync.read(bBuf);

  if (aPng.width !== bPng.width || aPng.height !== bPng.height) {
    throw new Error(
      `Dimension mismatch: ${aPng.width}x${aPng.height} vs ${bPng.width}x${bPng.height}`,
    );
  }

  const diff = new PNG({ width: aPng.width, height: aPng.height });
  const diffCount = pixelmatch(aPng.data, bPng.data, diff.data, aPng.width, aPng.height, {
    threshold,
  });

  if (diffCount > maxDiffPixels) {
    return {
      ok: false,
      diffCount,
      width: aPng.width,
      height: aPng.height,
      diffPngBuffer: PNG.sync.write(diff),
    };
  }
  return { ok: true, diffCount, width: aPng.width, height: aPng.height };
}
