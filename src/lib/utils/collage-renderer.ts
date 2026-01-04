import sharp from "sharp";
import { log } from "$lib/logger";
import type { CollageBackground, CollageBorder } from "$lib/types/collage";
import type { LayoutItem, SharedLayout } from "$lib/utils/collage-layout-engine";
import { COLLAGE_MESSAGES } from "$lib/utils/messages";
import { calculateAmbientCanvasSize, getAmbientPlacementRect } from "./collage";
import { AMBIENT_BACKEND_CONFIG, AMBIENT_SHARED_CONFIG } from "./collage-constants";

/**
 * Render the collage: load, crop/resize each placement and composite onto a canvas.
 *
 * Notes on cropping math:
 * - finalScale = baseScale * userScale determines the working raster size.
 * - We compute the extract area in source pixels by dividing viewport by finalScale.
 * - left/top are derived from user crop percentages and clamped to valid ranges.
 */
export async function renderCollage(
  layout: SharedLayout<LayoutItem>,
  _border?: CollageBorder,
  background?: CollageBackground,
): Promise<Buffer> {
  log.debug(`[Collage] Velikost plátna: ${layout.width}x${layout.height}`);
  log.debug(`[Collage] Zpracování ${layout.placements.length} obrázků`);

  async function processPlacement(p: (typeof layout.placements)[0], _idx: number) {
    const pipeline = sharp(p.item.path).rotate(); // Use item.path and auto-rotate

    if (p.crop) {
      const meta = await pipeline.metadata();
      const inW = meta.width ?? 0;
      const inH = meta.height ?? 0;

      if (inW === 0 || inH === 0) {
        throw new Error(COLLAGE_MESSAGES.INVALID_DIMENSIONS(p.item.path ?? "unknown"));
      }

      // Determine how the source must be scaled to fill the placement.
      const scaleW = p.width / inW;
      const scaleH = p.height / inH;
      const baseScale = Math.max(scaleW, scaleH);

      const userScale = p.crop.scale ?? 1;
      const finalScale = baseScale * userScale;

      const finalW = Math.round(inW * finalScale);
      const finalH = Math.round(inH * finalScale);

      const viewportW = p.width;
      const viewportH = p.height;

      const maxOffsetX = Math.max(0, finalW - viewportW);
      const maxOffsetY = Math.max(0, finalH - viewportH);

      // Translate user crop percentages into source offsets.
      const left = Math.round(maxOffsetX * (p.crop.x / 100));
      const top = Math.round(maxOffsetY * (p.crop.y / 100));

      const extractW = Math.min(inW, Math.round(viewportW / finalScale));
      const extractH = Math.min(inH, Math.round(viewportH / finalScale));
      const extractLeft = Math.min(inW - extractW, Math.round(left / finalScale));
      const extractTop = Math.min(inH - extractH, Math.round(top / finalScale));

      pipeline
        .extract({ left: extractLeft, top: extractTop, width: extractW, height: extractH })
        .resize(p.width, p.height, { fit: "fill" });
    } else {
      pipeline.resize(p.width, p.height, { fit: "cover" });
    }

    const buffer = await pipeline.toBuffer();

    return {
      input: buffer,
      top: p.y,
      left: p.x,
    };
  }

  const resizedInputs = await Promise.all(layout.placements.map(processPlacement));

  async function createAmbientBackground(layout: SharedLayout<LayoutItem>): Promise<Buffer> {
    const { width: blurW, height: blurH } = calculateAmbientCanvasSize(
      layout.width,
      layout.height,
      AMBIENT_SHARED_CONFIG.sampleScale,
    );
    const bleedScale = AMBIENT_SHARED_CONFIG.bleedScale;

    log.info(`[Collage] Generating ambient background base: ${blurW}x${blurH}`);

    // Base color based on mode
    const baseRGB = { r: 0, g: 0, b: 0 };

    const baseBgBuffer = await sharp({
      create: {
        width: blurW,
        height: blurH,
        channels: 3,
        background: baseRGB,
      },
    })
      .png()
      .toBuffer();

    const bgInputs = await Promise.all(
      layout.placements.map(async (p, idx) => {
        const rect = getAmbientPlacementRect(
          { left: p.x, top: p.y, width: p.width, height: p.height },
          blurW,
          blurH,
          AMBIENT_SHARED_CONFIG.sampleScale,
          bleedScale,
        );

        try {
          const b = await sharp(p.item.path)
            .rotate()
            .resize(rect.width, rect.height, { fit: "cover" })
            .removeAlpha()
            .png()
            .toBuffer();

          return {
            input: b,
            left: rect.left,
            top: rect.top,
            blend: "over" as const,
          };
        } catch (err) {
          log.warn(`[Collage] Failed to prepare ambient thumbnail for item ${idx}: ${err}`);
          return null;
        }
      }),
    );

    const validBgInputs = bgInputs.filter((i) => i !== null) as NonNullable<(typeof bgInputs)[0]>[];
    log.info(
      `[Collage] Compositing ${validBgInputs.length} ambient thumbnails on ${blurW}x${blurH} base`,
    );
    const compositeBuffer = await sharp(baseBgBuffer).composite(validBgInputs).png().toBuffer();

    // Apply blur passes (configurable)
    let blurredPipeline = sharp(compositeBuffer);
    for (let i = 0; i < AMBIENT_BACKEND_CONFIG.blurPasses; i++) {
      blurredPipeline = blurredPipeline.blur(AMBIENT_SHARED_CONFIG.blurRadius);
    }

    let blurredBuffer = await blurredPipeline
      .resize(layout.width, layout.height, { fit: "fill" })
      .modulate({
        brightness: AMBIENT_SHARED_CONFIG.brightness,
        saturation: AMBIENT_SHARED_CONFIG.saturation,
      })
      .toBuffer();

    // Invert for white ambient mode

    // Apply opacity by compositing with alpha channel
    const opacity = Math.round(AMBIENT_SHARED_CONFIG.opacity * 255);
    return sharp(blurredBuffer)
      .composite([
        {
          input: Buffer.from([0, 0, 0, opacity]),

          raw: { width: 1, height: 1, channels: 4 },
          tile: true,
          blend: "dest-in",
        },
      ])
      .toBuffer();
  }

  async function createSolidBackground(
    layout: SharedLayout<LayoutItem>,
    color: string,
  ): Promise<Buffer> {
    return sharp({
      create: {
        width: layout.width,
        height: layout.height,
        channels: 3,
        background: color,
      },
    })
      .png()
      .toBuffer();
  }

  // Background Layer
  const backgroundLayer =
    background?.style === "ambient"
      ? await createAmbientBackground(layout)
      : await createSolidBackground(layout, background?.color || "#ffffff");

  // Composite valid inputs on top of the background
  const result = await sharp(backgroundLayer)
    .composite(resizedInputs)
    .jpeg({ quality: 98, chromaSubsampling: "4:4:4" })
    .toBuffer();

  return result;
}
