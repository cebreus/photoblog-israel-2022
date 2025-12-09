import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

/**
 * Malý 2x2 animovaný GIF (2 snímky), base64.
 * Zdroj: ručně připravený minimální GIF; slouží pouze k detekci animace v testech.
 */
const TINY_ANIM_GIF_BASE64 =
  "R0lGODlhAgACAPEAAAAAAP///wAAACH5BAEAAAIALAAAAAACAAIAAAIEhI+py+0Po5yUFADs=";

/**
 * Vytvoří kurátorovanou sadu fixtur ve složce dir.
 * - alpha.png (40x30, s alfou)
 * - big.jpeg (4000x3000) – pro downscale testy
 * - portrait.jpeg (600x900) – pro crop/cover testy
 * - square.webp (300x300) – vstup v moderním formátu
 * - anim.gif (2x2 animovaný) – test gif režimu
 * - exif-orient-6.jpeg (600x400 s EXIF Orientation=6) – test orientace
 */
export async function buildInputSet(dir: string) {
  fs.mkdirSync(dir, { recursive: true });

  // 1) PNG s průhledností 40x30
  const pngAlpha = path.join(dir, "alpha.png");
  await sharp({
    create: {
      width: 40,
      height: 30,
      channels: 4,
      background: { r: 0, g: 255, b: 0, alpha: 0.25 },
    },
  })
    .png({ compressionLevel: 9 })
    .toFile(pngAlpha);

  // 2) Velký JPEG 4000x3000 pro downscale
  const bigJpeg = path.join(dir, "big.jpeg");
  await sharp({
    create: {
      width: 4000,
      height: 3000,
      channels: 3,
      background: { r: 120, g: 50, b: 180 },
    },
  })
    .jpeg({ quality: 85 })
    .toFile(bigJpeg);

  // 3) Malý JPEG (portrait) 600x900
  const portraitJpeg = path.join(dir, "portrait.jpeg");
  await sharp({
    create: {
      width: 600,
      height: 900,
      channels: 3,
      background: { r: 30, g: 60, b: 240 },
    },
  })
    .jpeg({ quality: 80 })
    .toFile(portraitJpeg);

  // 4) WEBP 300x300
  const webpImg = path.join(dir, "square.webp");
  await sharp({
    create: {
      width: 300,
      height: 300,
      channels: 3,
      background: { r: 255, g: 200, b: 0 },
    },
  })
    .webp({ quality: 80 })
    .toFile(webpImg);

  // 5) Malý animovaný GIF (2 snímky)
  const animGif = path.join(dir, "anim.gif");
  fs.writeFileSync(animGif, Buffer.from(TINY_ANIM_GIF_BASE64, "base64"));

  // 6) JPEG s EXIF orientací = 6
  // Pozn.: Sharp podporuje zapsání EXIF Orientation přes withMetadata({ orientation }).
  const exifOrient6 = path.join(dir, "exif-orient-6.jpeg");
  await sharp({
    create: {
      width: 600,
      height: 400,
      channels: 3,
      background: { r: 200, g: 30, b: 60 },
    },
  })
    .withMetadata({ orientation: 6 })
    .jpeg({ quality: 82 })
    .toFile(exifOrient6);

  return {
    pngAlpha,
    bigJpeg,
    portraitJpeg,
    webpImg,
    animGif,
    exifOrient6,
    dir,
  };
}
