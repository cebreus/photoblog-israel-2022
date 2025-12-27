import type { CollageBorder, CollageCrop, CollageTemplateId } from "$lib/types/collage";

export interface LayoutItem {
  id?: string;
  path?: string;
  width: number;
  height: number;
  crop?: CollageCrop;
  [key: string]: unknown;
}

export interface LayoutPlacement<T> {
  x: number;
  y: number;
  width: number;
  height: number;
  item: T;
  crop?: CollageCrop;
}

export interface SharedLayout<T> {
  width: number; // Canvas width
  height: number; // Canvas height
  placements: LayoutPlacement<T>[];
}

export function calculateLayout<T extends LayoutItem>(
  items: T[],
  template: CollageTemplateId,
  options: { border: CollageBorder; cropStrategy?: "smart" | "simple" },
): SharedLayout<T> {
  const borderW = options.border.width || 0;
  const cropStrategy = options.cropStrategy || "smart"; // Default to smart (dynamic)

  if (items.length === 0) {
    return { width: 1000, height: 1000, placements: [] };
  }

  if (template === "row") {
    return calculateRowLayout(items, borderW);
  }

  if (template === "column") {
    return calculateColumnLayout(items, borderW);
  }

  if (template === "grid-2x2") {
    return calculateGrid2x2Layout(items, borderW);
  }

  if (template === "hero-top") {
    return calculateHeroTopLayout(items, borderW);
  }

  if (template === "hero-left") {
    return calculateHeroLeftLayout(items, borderW);
  }

  if (template === "hero-right") {
    return calculateHeroRightLayout(items, borderW);
  }

  if (template === "sidebar-hero") {
    return calculateSidebarHeroLayout(items, borderW);
  }

  if (template === "density-7") {
    return calculateDensity7Layout(items, borderW, cropStrategy);
  }

  if (template === "grid-3x2") {
    return calculateGrid3x2Layout(items, borderW, cropStrategy);
  }

  if (template === "mosaic-6") {
    return calculateMosaic6Layout(items, borderW, cropStrategy);
  }

  // Fallback for empty or unknown
  return { width: 1000, height: 1000, placements: [] };
}

function calculateRowLayout<T extends LayoutItem>(items: T[], borderW: number): SharedLayout<T> {
  const marginX = borderW;
  const marginTop = borderW;
  const marginBottom = borderW;
  const gutter = borderW;

  const heights = items.map(function getHeight(i) {
    return i.height;
  });
  const maxHeight = Math.max(...heights);

  const placements: LayoutPlacement<T>[] = [];
  let currentX = marginX;

  for (const item of items) {
    const scale = maxHeight / item.height;
    const w = Math.round(item.width * scale);
    const h = maxHeight;

    placements.push({
      x: currentX,
      y: marginTop,
      width: w,
      height: h,
      item,
      crop: item.crop,
    });

    currentX += w + gutter;
  }

  const canvasWidth = currentX - gutter + marginX;
  const canvasHeight = marginTop + maxHeight + marginBottom;

  return { width: canvasWidth, height: canvasHeight, placements };
}

function calculateColumnLayout<T extends LayoutItem>(items: T[], borderW: number): SharedLayout<T> {
  const marginX = borderW;
  const marginTop = borderW;
  const marginBottom = borderW;
  const gutter = borderW;

  const widths = items.map(function getWidth(i) {
    return i.width;
  });
  const maxWidth = Math.max(...widths);

  const placements: LayoutPlacement<T>[] = [];
  let currentY = marginTop;

  for (const item of items) {
    const scale = maxWidth / item.width;
    const w = maxWidth;
    const h = Math.round(item.height * scale);

    placements.push({
      x: marginX,
      y: currentY,
      width: w,
      height: h,
      item,
      crop: item.crop,
    });

    currentY += h + gutter;
  }

  const canvasWidth = marginX + maxWidth + marginX;
  const canvasHeight = currentY - gutter + marginBottom;

  return { width: canvasWidth, height: canvasHeight, placements };
}

function calculateGrid2x2Layout<T extends LayoutItem>(
  items: T[],
  borderW: number,
): SharedLayout<T> {
  if (items.length < 4) {
    // Not enough items, return placeholder
    return { width: 1000, height: 1000, placements: [] };
  }

  const marginX = borderW;
  const marginTop = borderW;
  const marginBottom = borderW;
  const gutter = borderW;

  function calculateRow(rowItems: T[]) {
    const h = Math.max(
      ...rowItems.map(function (i) {
        return i.height;
      }),
    );
    const calculatedItems = rowItems.map(function (item) {
      return {
        item,
        width: Math.round(item.width * (h / item.height)),
        height: h,
        crop: item.crop,
      };
    });

    let totalW = (calculatedItems.length - 1) * gutter;
    for (const ci of calculatedItems) {
      totalW += ci.width;
    }

    return { height: h, totalWidth: totalW, items: calculatedItems };
  }

  const row1 = calculateRow([items[0], items[1]]);
  const row2 = calculateRow([items[2], items[3]]);

  const scaleFactor = row1.totalWidth / row2.totalWidth;

  const placements: LayoutPlacement<T>[] = [];

  // Row 1
  let x = marginX;
  let y = marginTop;
  for (const p of row1.items) {
    placements.push({
      x,
      y,
      width: p.width,
      height: p.height,
      item: p.item,
      crop: p.crop,
    });
    x += p.width + gutter;
  }

  // Row 2
  x = marginX;
  y = marginTop + row1.height + gutter;
  for (const p of row2.items) {
    const w = Math.round(p.width * scaleFactor);
    const h = Math.round(p.height * scaleFactor);

    placements.push({
      x,
      y,
      width: w,
      height: h,
      item: p.item,
      crop: p.crop,
    });
    x += w + gutter;
  }

  const canvasWidth = marginX + row1.totalWidth + marginX;
  const canvasHeight =
    marginTop + row1.height + gutter + Math.round(row2.height * scaleFactor) + marginBottom;

  return { width: canvasWidth, height: canvasHeight, placements };
}

// --- New Layouts ---

// Helper: Calculate a row of items with equal height
function calculateRowForItems<T extends LayoutItem>(
  items: T[],
  gutter: number,
): {
  height: number;
  totalWidth: number;
  items: { item: T; width: number; height: number; crop?: CollageCrop }[];
} {
  if (items.length === 0) return { height: 0, totalWidth: 0, items: [] };

  const h = 1000; // Reference height
  const calculatedItems = items.map((item) => ({
    item,
    width: Math.round(item.width * (h / item.height)),
    height: h,
    crop: item.crop,
  }));

  let totalW = (items.length - 1) * gutter;
  for (const ci of calculatedItems) {
    totalW += ci.width;
  }

  return { height: h, totalWidth: totalW, items: calculatedItems };
}

// Helper: Calculate a column of items with equal width
function calculateColumnForItems<T extends LayoutItem>(
  items: T[],
  gutter: number,
): {
  width: number;
  totalHeight: number;
  items: { item: T; width: number; height: number; crop?: CollageCrop }[];
} {
  if (items.length === 0) return { width: 0, totalHeight: 0, items: [] };

  const w = 1000;
  const calculatedItems = items.map((item) => ({
    item,
    width: w,
    height: Math.round(item.height * (w / item.width)),
    crop: item.crop,
  }));

  let totalH = (items.length - 1) * gutter;
  for (const ci of calculatedItems) {
    totalH += ci.height;
  }

  return { width: w, totalHeight: totalH, items: calculatedItems };
}

function calculateHeroTopLayout<T extends LayoutItem>(
  items: T[],
  borderW: number,
): SharedLayout<T> {
  const gutter = borderW;
  const marginX = borderW;
  const marginTop = borderW;
  const marginBottom = borderW;

  if (items.length < 3) return { width: 1000, height: 1000, placements: [] };

  // Row 1: Item 0
  const row1 = calculateRowForItems([items[0]], gutter);
  // Row 2: Items 1, 2
  const row2 = calculateRowForItems([items[1], items[2]], gutter);

  // Scale Row 1 to match Row 2 width (or vice versa? usually match to larger or specific width)
  // Let's normalize to 2000px width for consistency or match Row 1 width to Row 2
  // Visual hierarchy: Hero is full width.
  // Let's take Row 2 as reference width (because it has structure) and scale Row 1 to it?
  // Or just pick a standard width?
  // Let's use Row 2 as reference for width (since it has 2 items).

  const referenceWidth = row2.totalWidth;
  const scale1 = referenceWidth / row1.totalWidth;

  const placements: LayoutPlacement<T>[] = [];
  let y = marginTop;

  // Placement Row 1
  placements.push({
    x: marginX,
    y: y,
    width: Math.round(row1.items[0].width * scale1),
    height: Math.round(row1.items[0].height * scale1),
    item: row1.items[0].item,
    crop: row1.items[0].crop,
  });

  y += Math.round(row1.items[0].height * scale1) + gutter;

  // Placement Row 2
  let x = marginX;
  for (const p of row2.items) {
    placements.push({
      x,
      y,
      width: p.width,
      height: p.height,
      item: p.item,
      crop: p.crop,
    });
    x += p.width + gutter;
  }

  return {
    width: marginX + referenceWidth + marginX,
    height: y + row2.height + marginBottom - gutter - marginTop, // y was incremented
    placements,
  };
}

function calculateHeroLeftLayout<T extends LayoutItem>(
  items: T[],
  borderW: number,
): SharedLayout<T> {
  // 1 (Left), 2+3 (Right Stack)
  if (items.length < 3) return { width: 1000, height: 1000, placements: [] };

  const gutter = borderW;
  const marginX = borderW;
  const marginTop = borderW;
  const marginBottom = borderW;

  const leftItem = items[0];
  const rightStack = calculateColumnForItems([items[1], items[2]], gutter);

  // We have Left Item (W1, H1) and Right Stack (W2, H_stack)
  // We want H1 == H_stack.
  // Left Item Aspect Ratio = W1/H1
  // Right Stack Aspect Ratio = W2/H_stack

  // Let's fix height to X (e.g. 2000).
  const targetHeight = 2000;

  const leftScale = targetHeight / leftItem.height;
  const leftW = Math.round(leftItem.width * leftScale);

  const rightScale = targetHeight / rightStack.totalHeight;
  const rightW = Math.round(rightStack.width * rightScale);

  const placements: LayoutPlacement<T>[] = [];

  // Left
  placements.push({
    x: marginX,
    y: marginTop,
    width: leftW,
    height: targetHeight,
    item: leftItem,
    crop: leftItem.crop,
  });

  // Right
  let curY = marginTop;
  const startX = marginX + leftW + gutter;

  for (const p of rightStack.items) {
    const h = Math.round(p.height * rightScale);
    // Slight adjustment for pixel rounding on last item to ensure exact match?
    // For now simple math.
    placements.push({
      x: startX,
      y: curY,
      width: rightW,
      height: h,
      item: p.item,
      crop: p.crop,
    });
    curY += h + gutter;
  }

  return {
    width: marginX + leftW + gutter + rightW + marginX,
    height: marginTop + targetHeight + marginBottom,
    placements,
  };
}

function calculateHeroRightLayout<T extends LayoutItem>(
  items: T[],
  borderW: number,
): SharedLayout<T> {
  // Mirror of Hero Left
  if (items.length < 3) return { width: 1000, height: 1000, placements: [] };

  const _base = calculateHeroLeftLayout([items[0], items[1], items[2]], borderW); // Calc as if 0 is left, 1-2 right
  // But we want 0 to be Right, and 1-2 to be Left.
  // Actually the input for Hero Right implies item 0 is the Hero.
  // So: [1][0]
  //     [2]
  // Let's recalculate properly.

  const gutter = borderW;
  const marginX = borderW;
  const marginTop = borderW;
  const marginBottom = borderW;

  // Hero is items[0] (Right)
  // Stack is items[1], items[2] (Left)
  const rightItem = items[0];
  const leftStack = calculateColumnForItems([items[1], items[2]], gutter);

  const targetHeight = 2000;

  const rightScale = targetHeight / rightItem.height;
  const rightW = Math.round(rightItem.width * rightScale);

  const leftScale = targetHeight / leftStack.totalHeight;
  const leftW = Math.round(leftStack.width * leftScale);

  const placements: LayoutPlacement<T>[] = [];

  // Stack (Left)
  let curY = marginTop;
  let x = marginX;
  for (const p of leftStack.items) {
    const h = Math.round(p.height * leftScale);
    placements.push({
      x: x,
      y: curY,
      width: leftW,
      height: h,
      item: p.item,
      crop: p.crop,
    });
    curY += h + gutter;
  }

  // Hero (Right)
  placements.push({
    x: marginX + leftW + gutter,
    y: marginTop,
    width: rightW,
    height: targetHeight,
    item: rightItem,
    crop: rightItem.crop,
  });

  return {
    width: marginX + leftW + gutter + rightW + marginX,
    height: marginTop + targetHeight + marginBottom,
    placements,
  };
}

function calculateSidebarHeroLayout<T extends LayoutItem>(
  items: T[],
  borderW: number,
): SharedLayout<T> {
  // 1 Left (Hero), Right: [2][3] (Top), [4] (Bottom)
  // Structure: Left Column (1 item), Right Column (2 rows: Row 1 has 2 items, Row 2 has 1 item)
  if (items.length < 4) return { width: 1000, height: 1000, placements: [] };

  const gutter = borderW;
  const marginX = borderW;
  const marginTop = borderW;
  const marginBottom = borderW;

  const leftItem = items[0];

  // Right Block
  // Row 1: items[1], items[2]
  const rightRow1 = calculateRowForItems([items[1], items[2]], gutter);
  // Row 2: items[3]
  const rightRow2 = calculateRowForItems([items[3]], gutter);

  // Normalize Right Block Width
  // Let's make Row 2 match Row 1 width
  const rightWidth = rightRow1.totalWidth;
  const scaleRow2 = rightWidth / rightRow2.totalWidth;

  const rightDate = {
    row1H: rightRow1.height,
    row2H: Math.round(rightRow2.height * scaleRow2),
    totalH: rightRow1.height + gutter + Math.round(rightRow2.height * scaleRow2),
  };

  // Now match Left Item Height to Right Block Height
  const _targetHeight = rightDate.totalH;
  // Actually, we can just use the target height logic again

  // Let's pick a target height for the whole collage body
  const totalH = 2000;

  const leftScale = totalH / leftItem.height;
  const leftW = Math.round(leftItem.width * leftScale);

  const rightScale = totalH / rightDate.totalH;
  const finalRightW = Math.round(rightWidth * rightScale);

  const placements: LayoutPlacement<T>[] = [];

  // Left
  placements.push({
    x: marginX,
    y: marginTop,
    width: leftW,
    height: totalH,
    item: leftItem,
    crop: leftItem.crop,
  });

  // Right
  let startX = marginX + leftW + gutter;
  let curY = marginTop;

  // Right Row 1
  // We need to scale the pre-calculated row items to the finalRightW
  const finalScaleRow1 = finalRightW / rightRow1.totalWidth; // combined scale

  let r1x = startX;
  for (const p of rightRow1.items) {
    const _w = Math.round(p.width * finalScaleRow1);
    const _h = Math.round(p.height * finalScaleRow1); // This should be (p.height * (finalRightW / rightWidth)) but rightWidth==rightRow1.width
    // Actually: rightRow1.height is the height of the strip.
    // We need to scale height by rightScale.
    // Wait. rightDate.totalH is the Unscaled height sum.
    // rightScale scales that sum to totalH.
    // So individual heights just need to be scaled by rightScale?
    // NO. rightRow1 elements have a width/height ratio.
    // If we scale width, we scale height.
    // Logic check:
    // Right Block Aspect Ratio = rightWidth / rightDate.totalH
    // New Right Block Height = totalH
    // New Right Block Width = totalH * (rightWidth / rightDate.totalH) = finalRightW. Correct.
    // So we just scale everything by rightScale?
    // Yes, because rightDate construction did not scale Row 1 (it kept original size).

    // RE-VERIFY:
    // RightRow2 was scaled to match RightRow1 width.
    // So Row 2 height is `rightRow2.height * scaleRow2`.
    // Row 1 height is `rightRow1.height`.
    // So yes, we just apply `rightScale` to these heights.

    placements.push({
      x: r1x,
      y: curY,
      width: Math.round(p.width * rightScale), // correct? No.
      // p.width comes from `calculateRowForItems` which uses h=1000.
      // We know `row1.totalWidth` corresponds to `row1.height` (1000).
      // We want to scale specific item.
      height: Math.round(rightRow1.height * rightScale),
      item: p.item,
      crop: p.crop,
    });
    // Wait, calculateRowForItems returns items with calculated widths.
    // placements.push... width.
    placements[placements.length - 1].width = Math.round(p.width * rightScale);

    r1x += Math.round(p.width * rightScale) + gutter;
  }

  curY += Math.round(rightRow1.height * rightScale) + gutter;

  // Right Row 2
  // Item 3
  const p3 = rightRow2.items[0];
  // It was scaled by `scaleRow2` initially to match width.
  // Now we apply `rightScale`.
  const h3_intermediate = p3.height * scaleRow2;
  const w3_intermediate = p3.width * scaleRow2;

  placements.push({
    x: startX,
    y: curY,
    width: Math.round(w3_intermediate * rightScale),
    height: Math.round(h3_intermediate * rightScale),
    item: p3.item,
    crop: p3.crop,
  });

  return {
    width: marginX + leftW + gutter + finalRightW + marginX,
    height: marginTop + totalH + marginBottom,
    placements,
  };
}

function calculateGrid3x2Layout<T extends LayoutItem>(
  items: T[],
  borderW: number,
  cropStrategy: "smart" | "simple" = "smart",
): SharedLayout<T> {
  // 3 Rows x 2 items
  const gutter = borderW;
  const marginX = borderW;
  const marginTop = borderW;
  const marginBottom = borderW;

  if (items.length < 6) return { width: 1000, height: 1000, placements: [] };

  if (cropStrategy === "smart") {
    // Legacy "Smart" Logic (Respects Aspect Ratios)
    const r1 = calculateRowForItems([items[0], items[1]], gutter);
    const r2 = calculateRowForItems([items[2], items[3]], gutter);
    const r3 = calculateRowForItems([items[4], items[5]], gutter);

    const refW = r1.totalWidth;
    const s2 = refW / r2.totalWidth;
    const s3 = refW / r3.totalWidth;

    const placements: LayoutPlacement<T>[] = [];
    let y = marginTop;
    let x = marginX;

    // R1
    for (const p of r1.items) {
      placements.push({ x, y, width: p.width, height: p.height, item: p.item, crop: p.crop });
      x += p.width + gutter;
    }
    y += r1.height + gutter;

    // R2
    x = marginX;
    for (const p of r2.items) {
      const w = Math.round(p.width * s2);
      const h = Math.round(p.height * s2);
      placements.push({ x, y, width: w, height: h, item: p.item, crop: p.crop });
      x += w + gutter;
    }
    y += Math.round(r2.height * s2) + gutter;

    // R3
    x = marginX;
    for (const p of r3.items) {
      const w = Math.round(p.width * s3);
      const h = Math.round(p.height * s3);
      placements.push({ x, y, width: w, height: h, item: p.item, crop: p.crop });
      x += w + gutter;
    }
    y += Math.round(r3.height * s3);

    return { width: marginX + refW + marginX, height: y + marginBottom, placements };
  }

  // SIMPLE / RIGID LOGIC (Original "Fixed")
  const avgW = items.reduce((sum, i) => sum + i.width, 0) / items.length;
  const totalW = avgW * 2;

  // Calculate available width for content
  const contentW = totalW - marginX * 2;
  // Cell width (2 cols -> 1 gutter)
  const cellW = Math.round((contentW - gutter) / 2);

  // Calculate height. If we want square cells by default in a "natural" layout,
  // we'd use cellW. But here we just stack 3 rows.
  // Let's make rows equal height.
  const cellH = cellW; // Defaults to square cells conceptually in standard view
  const contentH = cellH * 3 + gutter * 2;
  const totalH = marginTop + contentH + marginBottom;

  const placements: LayoutPlacement<T>[] = [];

  // Grid generation
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 2; col++) {
      const idx = row * 2 + col;
      if (idx >= items.length) break;

      placements.push({
        x: marginX + col * (cellW + gutter),
        y: marginTop + row * (cellH + gutter),
        width: cellW,
        height: cellH,
        item: items[idx],
        crop: items[idx].crop,
      });
    }
  }

  return { width: totalW, height: totalH, placements };
}

function calculateDensity7Layout<T extends LayoutItem>(
  items: T[],
  borderW: number,
  cropStrategy: "smart" | "simple" = "smart",
): SharedLayout<T> {
  // 3 Rows: 2, 3, 2
  if (items.length < 7) return { width: 1000, height: 1000, placements: [] };

  const gutter = borderW;
  const marginX = borderW;
  const marginTop = borderW;
  const marginBottom = borderW;

  if (cropStrategy === "smart") {
    const r1 = calculateRowForItems([items[0], items[1]], gutter);
    const r2 = calculateRowForItems([items[2], items[3], items[4]], gutter);
    const r3 = calculateRowForItems([items[5], items[6]], gutter);

    const refW = r1.totalWidth;
    const s2 = refW / r2.totalWidth;
    const s3 = refW / r3.totalWidth;

    const placements: LayoutPlacement<T>[] = [];
    let y = marginTop;

    let x = marginX;
    for (const p of r1.items) {
      placements.push({ x, y, width: p.width, height: p.height, item: p.item, crop: p.crop });
      x += p.width + gutter;
    }
    y += r1.height + gutter;

    x = marginX;
    for (const p of r2.items) {
      const w = Math.round(p.width * s2);
      const h = Math.round(p.height * s2);
      placements.push({ x, y, width: w, height: h, item: p.item, crop: p.crop });
      x += w + gutter;
    }
    y += Math.round(r2.height * s2) + gutter;

    x = marginX;
    for (const p of r3.items) {
      const w = Math.round(p.width * s3);
      const h = Math.round(p.height * s3);
      placements.push({ x, y, width: w, height: h, item: p.item, crop: p.crop });
      x += w + gutter;
    }
    y += Math.round(r3.height * s3);

    return { width: marginX + refW + marginX, height: y + marginBottom, placements };
  }

  // SIMPLE uniform logic
  const avgW = items.reduce((sum, i) => sum + i.width, 0) / items.length;
  const totalW = avgW * 3;
  const contentW = totalW - marginX * 2;

  // Row Height defaults (Uniform)
  const rowH = Math.round(contentW / 3);

  const placements: LayoutPlacement<T>[] = [];
  let y = marginTop;

  // Row 1 (2 items, 50-50)
  let cellW = Math.round((contentW - gutter) / 2);
  let x = marginX;
  for (let i = 0; i < 2; i++) {
    placements.push({ x, y, width: cellW, height: rowH, item: items[i], crop: items[i].crop });
    x += cellW + gutter;
  }
  y += rowH + gutter;

  // Row 2 (3 items, 33-33-33)
  cellW = Math.round((contentW - 2 * gutter) / 3);
  x = marginX;
  for (let i = 2; i < 5; i++) {
    placements.push({ x, y, width: cellW, height: rowH, item: items[i], crop: items[i].crop });
    x += cellW + gutter;
  }
  y += rowH + gutter;

  // Row 3 (2 items, 50-50)
  cellW = Math.round((contentW - gutter) / 2);
  x = marginX;
  for (let i = 5; i < 7; i++) {
    placements.push({ x, y, width: cellW, height: rowH, item: items[i], crop: items[i].crop });
    x += cellW + gutter;
  }
  y += rowH;

  return { width: totalW, height: y + marginBottom, placements };
}

function calculateMosaic6Layout<T extends LayoutItem>(
  items: T[],
  borderW: number,
  cropStrategy: "smart" | "simple" = "smart",
): SharedLayout<T> {
  const gutter = borderW;
  const marginX = borderW;
  const marginTop = borderW;
  const marginBottom = borderW;

  if (items.length < 6) return { width: 1000, height: 1000, placements: [] };

  if (cropStrategy === "smart") {
    const c1 = calculateColumnForItems([items[0], items[1]], gutter);
    const c2 = calculateColumnForItems([items[2], items[3], items[4]], gutter);
    const c3 = calculateColumnForItems([items[5]], gutter);

    const targetH = 2000;
    const s1 = targetH / c1.totalHeight;
    const s2 = targetH / c2.totalHeight;
    const s3 = targetH / c3.totalHeight;

    const w1 = Math.round(c1.width * s1);
    const w2 = Math.round(c2.width * s2);
    const w3 = Math.round(c3.width * s3);

    const placements: LayoutPlacement<T>[] = [];
    let x = marginX;
    let y = marginTop;
    for (const p of c1.items) {
      const h = Math.round(p.height * s1);
      placements.push({ x, y, width: w1, height: h, item: p.item, crop: p.crop });
      y += h + gutter;
    }

    x += w1 + gutter;
    y = marginTop;
    for (const p of c2.items) {
      const h = Math.round(p.height * s2);
      placements.push({ x, y, width: w2, height: h, item: p.item, crop: p.crop });
      y += h + gutter;
    }

    x += w2 + gutter;
    y = marginTop;
    for (const p of c3.items) {
      const h = Math.round(p.height * s3);
      placements.push({ x, y, width: w3, height: h, item: p.item, crop: p.crop });
      y += h + gutter;
    }

    return {
      width: marginX + w1 + gutter + w2 + gutter + w3 + marginX,
      height: marginTop + targetH + marginBottom,
      placements,
    };
  }

  // SIMPLE logic
  const avgW = items.reduce((sum, i) => sum + i.width, 0) / items.length;
  const totalW = avgW * 3;
  const contentW = totalW - marginX * 2 - gutter * 2;
  // Fixed ratios
  const w1 = Math.round(contentW * 0.3);
  const w2 = Math.round(contentW * 0.4);
  const w3 = contentW - w1 - w2;

  // Use typical aspect ratio ~3:2 for total sizing
  const totalH = Math.round(totalW * 0.66) + marginTop + marginBottom;
  const contentH = totalH - marginTop - marginBottom;

  const placements: LayoutPlacement<T>[] = [];
  let x = marginX;

  // Col 1 (2 items, 50-50 height)
  let cellH = Math.round((contentH - gutter) / 2);
  let y = marginTop;
  for (let i = 0; i < 2; i++) {
    placements.push({ x, y, width: w1, height: cellH, item: items[i], crop: items[i].crop });
    y += cellH + gutter;
  }
  x += w1 + gutter;

  // Col 2 (3 items, 33-33-33 height)
  cellH = Math.round((contentH - 2 * gutter) / 3);
  y = marginTop;
  for (let i = 2; i < 5; i++) {
    placements.push({ x, y, width: w2, height: cellH, item: items[i], crop: items[i].crop });
    y += cellH + gutter;
  }
  x += w2 + gutter;

  // Col 3 (1 item, 100 height)
  cellH = contentH;
  y = marginTop;
  placements.push({ x, y, width: w3, height: cellH, item: items[5], crop: items[5].crop });

  return { width: totalW, height: totalH, placements };
}
