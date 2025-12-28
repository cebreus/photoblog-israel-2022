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

  if (template === "grid-2-3") {
    return calculateGrid23Layout(items, borderW, cropStrategy);
  }

  if (template === "grid-3-2") {
    return calculateGrid32Layout(items, borderW, cropStrategy);
  }

  if (template === "sidebar-grid") {
    return calculateSidebarGridLayout(items, borderW);
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

// Helper: Calculate a row of items with equal height
function calculateRowForItems<T extends LayoutItem>(
  items: T[],
  gutter: number,
): {
  height: number;
  totalWidth: number;
  contentWidth: number;
  items: { item: T; width: number; height: number; crop?: CollageCrop }[];
} {
  if (items.length === 0) return { height: 0, totalWidth: 0, contentWidth: 0, items: [] };

  const h = 1000; // Reference height
  const calculatedItems = items.map((item) => ({
    item,
    width: Math.round(item.width * (h / item.height)),
    height: h,
    crop: item.crop,
  }));

  let contentW = 0;
  for (const ci of calculatedItems) {
    contentW += ci.width;
  }
  const totalW = contentW + (items.length - 1) * gutter;

  return { height: h, totalWidth: totalW, contentWidth: contentW, items: calculatedItems };
}

// Helper: Calculate a column of items with equal width
function calculateColumnForItems<T extends LayoutItem>(
  items: T[],
  gutter: number,
): {
  width: number;
  totalHeight: number;
  contentHeight: number;
  items: { item: T; width: number; height: number; crop?: CollageCrop }[];
} {
  if (items.length === 0) return { width: 0, totalHeight: 0, contentHeight: 0, items: [] };

  const w = 1000;
  const calculatedItems = items.map((item) => ({
    item,
    width: w,
    height: Math.round(item.height * (w / item.width)),
    crop: item.crop,
  }));

  let contentH = 0;
  for (const ci of calculatedItems) {
    contentH += ci.height;
  }

  const totalH = contentH + (items.length - 1) * gutter;

  return { width: w, totalHeight: totalH, contentHeight: contentH, items: calculatedItems };
}

function calculateGrid2x2Layout<T extends LayoutItem>(
  items: T[],
  borderW: number,
): SharedLayout<T> {
  if (items.length < 4) {
    return { width: 1000, height: 1000, placements: [] };
  }

  const marginX = borderW;
  const marginTop = borderW;
  const marginBottom = borderW;
  const gutter = borderW;

  const row1 = calculateRowForItems([items[0], items[1]], gutter);
  const row2 = calculateRowForItems([items[2], items[3]], gutter);

  // We want to match Row 2 width to Row 1 width.
  // Reference Width = Row 1 Total Width.
  const referenceWidth = row1.totalWidth;

  // For Row 2, we need to scale its CONTENT to fit (ReferenceWidth - Gutters)
  const row2TargetContentW = referenceWidth - (row2.items.length - 1) * gutter;
  const scaleFactor = row2TargetContentW / row2.contentWidth;

  const placements: LayoutPlacement<T>[] = [];

  // Row 1 (Reference)
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

  let remainingW = row2TargetContentW;

  row2.items.forEach((p, idx) => {
    let w = Math.round(p.width * scaleFactor);
    // Fix rounding errors on last item
    if (idx === row2.items.length - 1) {
      w = remainingW;
    } else {
      remainingW -= w;
    }

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
  });

  // Row 2 Height is effectively the scaled height of any item (since they are equal height in row)
  // But due to rounding, let's take the first one or average? They are all `h * scale`.
  const row2Height = Math.round(row2.height * scaleFactor);

  const canvasWidth = marginX + referenceWidth + marginX;
  const canvasHeight = marginTop + row1.height + gutter + row2Height + marginBottom;

  return { width: canvasWidth, height: canvasHeight, placements };
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

  const row1 = calculateRowForItems([items[0]], gutter); // 1 item
  const row2 = calculateRowForItems([items[1], items[2]], gutter); // 2 items

  // Reference Width = Row 2 Total Width (since it has more structure/items)
  const referenceWidth = row2.totalWidth;

  // Scale Row 1 to match Reference
  const row1TargetContentW = referenceWidth - (row1.items.length - 1) * gutter;
  const scale1 = row1TargetContentW / row1.contentWidth;

  const placements: LayoutPlacement<T>[] = [];
  let y = marginTop;
  let x = marginX;

  // Placement Row 1
  const r1Item = row1.items[0];
  const r1H = Math.round(r1Item.height * scale1);
  const r1W = Math.round(r1Item.width * scale1); // Should match row1TargetContentW exactly as it's 1 item

  placements.push({
    x,
    y,
    width: r1W, // or row1TargetContentW to be safe
    height: r1H,
    item: r1Item.item,
    crop: r1Item.crop,
  });

  y += r1H + gutter;

  // Placement Row 2
  x = marginX;
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
    height: marginTop + r1H + gutter + row2.height + marginBottom,
    placements,
  };
}

function calculateHeroLeftLayout<T extends LayoutItem>(
  items: T[],
  borderW: number,
): SharedLayout<T> {
  if (items.length < 3) return { width: 1000, height: 1000, placements: [] };

  const gutter = borderW;
  const marginX = borderW;
  const marginTop = borderW;
  const marginBottom = borderW;

  const leftItem = items[0];
  const rightStack = calculateColumnForItems([items[1], items[2]], gutter);

  const targetHeight = 2000;

  // Left Scale
  const leftScale = targetHeight / leftItem.height;
  const leftW = Math.round(leftItem.width * leftScale);

  // Right Scale
  const rightTargetContentH = targetHeight - (rightStack.items.length - 1) * gutter;
  const rightScale = rightTargetContentH / rightStack.contentHeight;
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

  let remainingH = rightTargetContentH;

  rightStack.items.forEach((p, idx) => {
    let h = Math.round(p.height * rightScale);
    if (idx === rightStack.items.length - 1) {
      h = remainingH;
    } else {
      remainingH -= h;
    }

    placements.push({
      x: startX,
      y: curY,
      width: rightW,
      height: h,
      item: p.item,
      crop: p.crop,
    });
    curY += h + gutter;
  });

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
  if (items.length < 3) return { width: 1000, height: 1000, placements: [] };

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

  const leftTargetContentH = targetHeight - (leftStack.items.length - 1) * gutter;
  const leftScale = leftTargetContentH / leftStack.contentHeight;
  const leftW = Math.round(leftStack.width * leftScale);

  const placements: LayoutPlacement<T>[] = [];

  // Stack (Left)
  let curY = marginTop;
  let x = marginX;
  let remainingH = leftTargetContentH;

  leftStack.items.forEach((p, idx) => {
    let h = Math.round(p.height * leftScale);
    if (idx === leftStack.items.length - 1) {
      h = remainingH;
    } else {
      remainingH -= h;
    }

    placements.push({
      x: x,
      y: curY,
      width: leftW,
      height: h,
      item: p.item,
      crop: p.crop,
    });
    curY += h + gutter;
  });

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
  if (items.length < 4) return { width: 1000, height: 1000, placements: [] };

  const gutter = borderW;
  const marginX = borderW;
  const marginTop = borderW;
  const marginBottom = borderW;

  const leftItem = items[0];

  // Right Block
  const rightRow1 = calculateRowForItems([items[1], items[2]], gutter);
  const rightRow2 = calculateRowForItems([items[3]], gutter);

  // Normalize Right Block Width (Row 2 matches Row 1)
  const referenceWidth = rightRow1.totalWidth;
  const r2TargetContentW = referenceWidth - (rightRow2.items.length - 1) * gutter;
  const scaleRow2 = r2TargetContentW / rightRow2.contentWidth;

  const rightRow2H_Scaled = Math.round(rightRow2.height * scaleRow2);

  // Right Block structure: Row 1 + gutter + Row 2
  // Unscaled Height components:
  // Row 1 Height (from rightRow1.height)
  // Row 2 Height Scaled (from rightRow2H_Scaled)

  const rightBlockTotalHeight = 2000; // Target total height

  // Left Scaling
  const leftScale = rightBlockTotalHeight / leftItem.height;
  const leftW = Math.round(leftItem.width * leftScale);

  // Right Block Scaling
  // Available Height for Right Content = 2000 - 1*gutter (between rows)
  const rightAvailableH = rightBlockTotalHeight - gutter;

  // Current Content Heights (relative to referenceWidth)
  const currentRightContentH = rightRow1.height + rightRow2H_Scaled;

  const rightScale = rightAvailableH / currentRightContentH;

  const finalRightW = Math.round(referenceWidth * rightScale);

  const placements: LayoutPlacement<T>[] = [];

  // Left
  placements.push({
    x: marginX,
    y: marginTop,
    width: leftW,
    height: rightBlockTotalHeight,
    item: leftItem,
    crop: leftItem.crop,
  });

  // Right
  let startX = marginX + leftW + gutter;
  let curY = marginTop;

  // Right Row 1
  // Scale row1 items to finalRightW
  // We already have rightRow1 items sized for referenceWidth.
  // We just need to apply rightScale to dimensions?
  // Yes, because referenceWidth * rightScale = finalRightW.

  // Height of Row 1 = rightRow1.height * rightScale
  const r1H = Math.round(rightRow1.height * rightScale);

  // Distribute width for Row 1 items
  const r1TargetW = finalRightW - (rightRow1.items.length - 1) * gutter;
  let remainingW = r1TargetW;

  // We need to re-calculate per-item width based on final width to handle rounding
  // The items in rightRow1 are proportional.
  // itemW_in_ref = p.width.
  // itemW_final = p.width * rightScale.

  let x = startX;
  rightRow1.items.forEach((p, idx) => {
    let w = Math.round(p.width * rightScale);
    if (idx === rightRow1.items.length - 1) {
      w = remainingW;
    } else {
      remainingW -= w;
    }

    placements.push({
      x,
      y: curY,
      width: w,
      height: r1H,
      item: p.item,
      crop: p.crop,
    });
    x += w + gutter;
  });

  curY += r1H + gutter;

  // Right Row 2 (Item 3)
  // Height = rightRow2H_Scaled * rightScale
  // Or simply remaining height to ensure alignment?
  const r2H = rightBlockTotalHeight - r1H - gutter;

  // Width = finalRightW (since 1 item)
  const p3 = rightRow2.items[0];
  placements.push({
    x: startX,
    y: curY,
    width: finalRightW,
    height: r2H,
    item: p3.item,
    crop: p3.crop,
  });

  return {
    width: marginX + leftW + gutter + finalRightW + marginX,
    height: marginTop + rightBlockTotalHeight + marginBottom,
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

    // Calculate content target widths
    const r2TargetContentW = refW - (r2.items.length - 1) * gutter;
    const r3TargetContentW = refW - (r3.items.length - 1) * gutter;

    const s2 = r2TargetContentW / r2.contentWidth;
    const s3 = r3TargetContentW / r3.contentWidth;

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
    let remainingW = r2TargetContentW;

    r2.items.forEach((p, idx) => {
      let w = Math.round(p.width * s2);
      if (idx === r2.items.length - 1) {
        w = remainingW;
      } else {
        remainingW -= w;
      }

      const h = Math.round(p.height * s2);
      placements.push({ x, y, width: w, height: h, item: p.item, crop: p.crop });
      x += w + gutter;
    });

    // Add row height (scaled)
    y += Math.round(r2.height * s2) + gutter;

    // R3
    x = marginX;
    remainingW = r3TargetContentW;
    r3.items.forEach((p, idx) => {
      let w = Math.round(p.width * s3);
      if (idx === r3.items.length - 1) {
        w = remainingW;
      } else {
        remainingW -= w;
      }
      const h = Math.round(p.height * s3);
      placements.push({ x, y, width: w, height: h, item: p.item, crop: p.crop });
      x += w + gutter;
    });

    y += Math.round(r3.height * s3);

    return { width: marginX + refW + marginX, height: y + marginBottom, placements };
  }

  // SIMPLE uniform logic (Fixed)
  const avgW = items.reduce((sum, i) => sum + i.width, 0) / items.length;
  const totalW = avgW * 2;
  const contentW = totalW - marginX * 2;
  const cellW = Math.round((contentW - gutter) / 2);
  const cellH = cellW;
  const contentH = cellH * 3 + gutter * 2;
  const totalH = marginTop + contentH + marginBottom;

  const placements: LayoutPlacement<T>[] = [];

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

    // Content targets
    const r2TargetContentW = refW - (r2.items.length - 1) * gutter;
    const r3TargetContentW = refW - (r3.items.length - 1) * gutter;

    const s2 = r2TargetContentW / r2.contentWidth;
    const s3 = r3TargetContentW / r3.contentWidth;

    const placements: LayoutPlacement<T>[] = [];
    let y = marginTop;

    // R1
    let x = marginX;
    for (const p of r1.items) {
      placements.push({ x, y, width: p.width, height: p.height, item: p.item, crop: p.crop });
      x += p.width + gutter;
    }
    y += r1.height + gutter;

    // R2
    x = marginX;
    let remainingW = r2TargetContentW;
    r2.items.forEach((p, idx) => {
      let w = Math.round(p.width * s2);
      if (idx === r2.items.length - 1) {
        w = remainingW;
      } else {
        remainingW -= w;
      }
      const h = Math.round(p.height * s2);
      placements.push({ x, y, width: w, height: h, item: p.item, crop: p.crop });
      x += w + gutter;
    });

    y += Math.round(r2.height * s2) + gutter;

    // R3
    x = marginX;
    remainingW = r3TargetContentW;
    r3.items.forEach((p, idx) => {
      let w = Math.round(p.width * s3);
      if (idx === r3.items.length - 1) {
        w = remainingW;
      } else {
        remainingW -= w;
      }
      const h = Math.round(p.height * s3);
      placements.push({ x, y, width: w, height: h, item: p.item, crop: p.crop });
      x += w + gutter;
    });

    y += Math.round(r3.height * s3);

    return { width: marginX + refW + marginX, height: y + marginBottom, placements };
  }

  // SIMPLE uniform logic
  const avgW = items.reduce((sum, i) => sum + i.width, 0) / items.length;
  const totalW = avgW * 3;
  const contentW = totalW - marginX * 2;
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

    // Scale CONTENT height only
    const c1TargetContentH = targetH - (c1.items.length - 1) * gutter;
    const c2TargetContentH = targetH - (c2.items.length - 1) * gutter;
    const c3TargetContentH = targetH - (c3.items.length - 1) * gutter;

    const s1 = c1TargetContentH / c1.contentHeight;
    const s2 = c2TargetContentH / c2.contentHeight;
    const s3 = c3TargetContentH / c3.contentHeight;

    const w1 = Math.round(c1.width * s1);
    const w2 = Math.round(c2.width * s2);
    const w3 = Math.round(c3.width * s3);

    const placements: LayoutPlacement<T>[] = [];

    // C1
    let x = marginX;
    let y = marginTop;
    let remainingH = c1TargetContentH;

    c1.items.forEach((p, idx) => {
      let h = Math.round(p.height * s1);
      if (idx === c1.items.length - 1) {
        h = remainingH;
      } else {
        remainingH -= h;
      }
      placements.push({ x, y, width: w1, height: h, item: p.item, crop: p.crop });
      y += h + gutter;
    });

    // C2
    x += w1 + gutter;
    y = marginTop;
    remainingH = c2TargetContentH;

    c2.items.forEach((p, idx) => {
      let h = Math.round(p.height * s2);
      if (idx === c2.items.length - 1) {
        h = remainingH;
      } else {
        remainingH -= h;
      }
      placements.push({ x, y, width: w2, height: h, item: p.item, crop: p.crop });
      y += h + gutter;
    });

    // C3
    x += w2 + gutter;
    y = marginTop;
    remainingH = c3TargetContentH;

    c3.items.forEach((p, idx) => {
      let h = Math.round(p.height * s3);
      if (idx === c3.items.length - 1) {
        h = remainingH;
      } else {
        remainingH -= h;
      }
      placements.push({ x, y, width: w3, height: h, item: p.item, crop: p.crop });
      y += h + gutter;
    });

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
  const w1 = Math.round(contentW * 0.3);
  const w2 = Math.round(contentW * 0.4);
  const w3 = contentW - w1 - w2;
  const totalH = Math.round(totalW * 0.66) + marginTop + marginBottom;
  const contentH = totalH - marginTop - marginBottom;

  const placements: LayoutPlacement<T>[] = [];
  let x = marginX;

  // Col 1
  let cellH = Math.round((contentH - gutter) / 2);
  let y = marginTop;
  for (let i = 0; i < 2; i++) {
    placements.push({ x, y, width: w1, height: cellH, item: items[i], crop: items[i].crop });
    y += cellH + gutter;
  }
  x += w1 + gutter;

  // Col 2
  cellH = Math.round((contentH - 2 * gutter) / 3);
  y = marginTop;
  for (let i = 2; i < 5; i++) {
    placements.push({ x, y, width: w2, height: cellH, item: items[i], crop: items[i].crop });
    y += cellH + gutter;
  }
  x += w2 + gutter;

  // Col 3
  cellH = contentH;
  y = marginTop;
  placements.push({ x, y, width: w3, height: cellH, item: items[5], crop: items[5].crop });

  return { width: totalW, height: totalH, placements };
}

export function calculateGrid23Layout<T extends LayoutItem>(
  items: T[],
  borderW: number,
  _cropStrategy: "smart" | "simple" = "smart",
): SharedLayout<T> {
  // 2 Rows: 2 items (top), 3 items (bottom)
  if (items.length < 5) return { width: 1000, height: 1000, placements: [] };

  const gutter = borderW;
  const marginX = borderW;
  const marginTop = borderW;
  const marginBottom = borderW;

  const r1 = calculateRowForItems([items[0], items[1]], gutter);
  const r2 = calculateRowForItems([items[2], items[3], items[4]], gutter);

  const refW = r1.totalWidth;
  const r2TargetContentW = refW - (r2.items.length - 1) * gutter;
  const s2 = r2TargetContentW / r2.contentWidth;

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
  let remainingW = r2TargetContentW;
  r2.items.forEach((p, idx) => {
    let w = Math.round(p.width * s2);
    if (idx === r2.items.length - 1) {
      w = remainingW;
    } else {
      remainingW -= w;
    }

    const h = Math.round(p.height * s2);
    placements.push({ x, y, width: w, height: h, item: p.item, crop: p.crop });
    x += w + gutter;
  });

  const totalH = y + Math.round(r2.height * s2) + marginBottom;
  return { width: marginX + refW + marginX, height: totalH, placements };
}

export function calculateGrid32Layout<T extends LayoutItem>(
  items: T[],
  borderW: number,
  _cropStrategy: "smart" | "simple" = "smart",
): SharedLayout<T> {
  // 2 Rows: 3 items (top), 2 items (bottom)
  if (items.length < 5) return { width: 1000, height: 1000, placements: [] };

  const gutter = borderW;
  const marginX = borderW;
  const marginTop = borderW;
  const marginBottom = borderW;

  const r1 = calculateRowForItems([items[0], items[1], items[2]], gutter);
  const r2 = calculateRowForItems([items[3], items[4]], gutter);

  const refW = r1.totalWidth;
  const r2TargetContentW = refW - (r2.items.length - 1) * gutter;
  const s2 = r2TargetContentW / r2.contentWidth;

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
  let remainingW = r2TargetContentW;
  r2.items.forEach((p, idx) => {
    let w = Math.round(p.width * s2);
    if (idx === r2.items.length - 1) {
      w = remainingW;
    } else {
      remainingW -= w;
    }

    const h = Math.round(p.height * s2);
    placements.push({ x, y, width: w, height: h, item: p.item, crop: p.crop });
    x += w + gutter;
  });

  const totalH = y + Math.round(r2.height * s2) + marginBottom;
  return { width: marginX + refW + marginX, height: totalH, placements };
}

export function calculateSidebarGridLayout<T extends LayoutItem>(
  items: T[],
  borderW: number,
): SharedLayout<T> {
  // 1 Left (Hero), Right: [1][2] (Top), [3][4] (Bottom)
  if (items.length < 5) return { width: 1000, height: 1000, placements: [] };

  const gutter = borderW;
  const marginX = borderW;
  const marginTop = borderW;
  const marginBottom = borderW;

  const leftItem = items[0];

  const rightRow1 = calculateRowForItems([items[1], items[2]], gutter);
  const rightRow2 = calculateRowForItems([items[3], items[4]], gutter);

  const referenceWidth = rightRow1.totalWidth;
  const r2TargetContentW = referenceWidth - (rightRow2.items.length - 1) * gutter;
  const scaleRow2 = r2TargetContentW / rightRow2.contentWidth;
  const rightRow2H_Scaled = Math.round(rightRow2.height * scaleRow2);

  const rightBlockTotalHeight = 2000;
  const leftScale = rightBlockTotalHeight / leftItem.height;
  const leftW = Math.round(leftItem.width * leftScale);

  const rightAvailableH = rightBlockTotalHeight - gutter;
  const currentRightContentH = rightRow1.height + rightRow2H_Scaled;
  const rightScale = rightAvailableH / currentRightContentH;
  const finalRightW = Math.round(referenceWidth * rightScale);

  const placements: LayoutPlacement<T>[] = [];

  placements.push({
    x: marginX,
    y: marginTop,
    width: leftW,
    height: rightBlockTotalHeight,
    item: leftItem,
    crop: leftItem.crop,
  });

  let startX = marginX + leftW + gutter;
  let curY = marginTop;

  const r1H = Math.round(rightRow1.height * rightScale);
  const r1TargetW = finalRightW - (rightRow1.items.length - 1) * gutter;
  let remainingW = r1TargetW;

  let x = startX;
  rightRow1.items.forEach((p, idx) => {
    let w = Math.round(p.width * rightScale);
    if (idx === rightRow1.items.length - 1) {
      w = remainingW;
    } else {
      remainingW -= w;
    }
    placements.push({ x, y: curY, width: w, height: r1H, item: p.item, crop: p.crop });
    x += w + gutter;
  });

  curY += r1H + gutter;

  const r2H = rightBlockTotalHeight - r1H - gutter;
  const r2TargetW = finalRightW - (rightRow2.items.length - 1) * gutter;
  remainingW = r2TargetW;

  x = startX;
  rightRow2.items.forEach((p, idx) => {
    const effectiveScale = scaleRow2 * rightScale;
    let w = Math.round(p.width * effectiveScale);
    if (idx === rightRow2.items.length - 1) {
      w = remainingW;
    } else {
      remainingW -= w;
    }
    placements.push({ x, y: curY, width: w, height: r2H, item: p.item, crop: p.crop });
    x += w + gutter;
  });

  return {
    width: marginX + leftW + gutter + finalRightW + marginX,
    height: marginTop + rightBlockTotalHeight + marginBottom,
    placements,
  };
}
