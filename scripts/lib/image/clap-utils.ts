import os from "node:os";
import path from "node:path";
import type sharp from "sharp";
import type { CleanApertureData } from "$shared/types/clap";

type SharpModule = typeof sharp;

export async function applyClapExtract(
  sharpModule: SharpModule,
  inputPath: string,
  clap: CleanApertureData,
): Promise<string> {
  const metadata = await sharpModule(inputPath).metadata();
  if (!metadata.width || !metadata.height) {
    throw new Error(`Missing dimensions for ${inputPath}`);
  }
  const nativeWidth = metadata.width;
  const nativeHeight = metadata.height;

  // Calculate top-left based on center offsets
  const centerX = nativeWidth / 2 + clap.horizOffset;
  const centerY = nativeHeight / 2 + clap.vertOffset;

  let left = Math.round(centerX - clap.width / 2);
  let top = Math.round(centerY - clap.height / 2);
  let width = Math.round(clap.width);
  let height = Math.round(clap.height);

  // Bounds clamping
  if (left < 0) left = 0;
  if (top < 0) top = 0;
  if (left + width > nativeWidth) width = nativeWidth - left;
  if (top + height > nativeHeight) height = nativeHeight - top;

  const tempDir = os.tmpdir();
  const tempFile = path.join(tempDir, `clap_${path.basename(inputPath)}_${Date.now()}.png`);

  await sharpModule(inputPath)
    .extract({ left, top, width, height })
    .withMetadata()
    .toFile(tempFile);

  return tempFile;
}
