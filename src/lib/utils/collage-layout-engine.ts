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
  options: {
    border: CollageBorder;
    cropStrategy?: "smart" | "simple";
    aspectRatio?: string;
    maxDimension?: number;
  },
): SharedLayout<T> {
  const borderW = options.border.width || 0;
  const cropStrategy = options.cropStrategy || "smart"; // Default to smart (dynamic)

  if (items.length === 0) {
    return { width: 1000, height: 1000, placements: [] };
  }

  let layout: SharedLayout<T>;

  if (template === "row") {
    layout = calculateRowLayout(items, borderW);
  } else if (template === "column") {
    layout = calculateColumnLayout(items, borderW);
  } else if (template === "grid-2x2") {
    layout = calculateGrid2x2Layout(items, borderW);
  } else if (template === "hero-top") {
    layout = calculateHeroTopLayout(items, borderW);
  } else if (template === "hero-left") {
    layout = calculateHeroLeftLayout(items, borderW);
  } else if (template === "hero-right") {
    layout = calculateHeroRightLayout(items, borderW);
  } else if (template === "sidebar-hero") {
    layout = calculateSidebarHeroLayout(items, borderW);
  } else if (template === "grid-2-3") {
    layout = calculateGrid23Layout(items, borderW, cropStrategy);
  } else if (template === "grid-3-2") {
    layout = calculateGrid32Layout(items, borderW, cropStrategy);
  } else if (template === "sidebar-grid") {
    layout = calculateSidebarGridLayout(items, borderW);
  } else if (template === "density-7") {
    layout = calculateDensity7Layout(items, borderW, cropStrategy);
  } else if (template === "grid-3x2") {
    layout = calculateGrid3x2Layout(items, borderW, cropStrategy);
  } else if (template === "mosaic-6") {
    layout = calculateMosaic6Layout(items, borderW, cropStrategy);
  } else {
    layout = { width: 1000, height: 1000, placements: [] };
  }

  // Chain improvements
  layout = applyQualityScale(layout as SharedLayout<LayoutItem>) as SharedLayout<T>;

  if (options.aspectRatio && options.aspectRatio !== "auto") {
    layout = applyAspectRatio(
      layout as SharedLayout<LayoutItem>,
      options.aspectRatio,
    ) as SharedLayout<T>;
  }

  if (options.maxDimension) {
    layout = applyMaxDimensionLimit(
      layout as SharedLayout<LayoutItem>,
      options.maxDimension,
    ) as SharedLayout<T>;
  }

  return layout;
}

function calculateRowLayout<T extends LayoutItem>(items: T[], borderW: number): SharedLayout<T> {
  const margin = 2 * borderW;
  const gutter = Math.round((2 / 3) * margin);

  const heights = items.map(function getHeight(i) {
    return i.height;
  });
  const maxHeight = Math.max(...heights);

  const placements: LayoutPlacement<T>[] = [];
  let currentX = margin;

  for (const item of items) {
    const scale = maxHeight / item.height;
    const w = Math.round(item.width * scale);
    const h = maxHeight;

    placements.push({
      x: currentX,
      y: margin,
      width: w,
      height: h,
      item,
      crop: item.crop,
    });

    currentX += w + gutter;
  }

  const canvasWidth = currentX - gutter + margin;
  const canvasHeight = margin + maxHeight + margin;

  return { width: canvasWidth, height: canvasHeight, placements };
}

function calculateColumnLayout<T extends LayoutItem>(items: T[], borderW: number): SharedLayout<T> {
  const margin = 2 * borderW;
  const gutter = Math.round((2 / 3) * margin);

  const widths = items.map(function getWidth(i) {
    return i.width;
  });
  const maxWidth = Math.max(...widths);

  const placements: LayoutPlacement<T>[] = [];
  let currentY = margin;

  for (const item of items) {
    const scale = maxWidth / item.width;
    const w = maxWidth;
    const h = Math.round(item.height * scale);

    placements.push({
      x: margin,
      y: currentY,
      width: w,
      height: h,
      item,
      crop: item.crop,
    });

    currentY += h + gutter;
  }

  const canvasWidth = margin + maxWidth + margin;
  const canvasHeight = currentY - gutter + margin;

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

  const margin = 2 * borderW;
  const gutter = Math.round((2 / 3) * margin);

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
  let x = margin;
  let y = margin;
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
  x = margin;
  y = margin + row1.height + gutter;

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

  const canvasWidth = margin + referenceWidth + margin;
  const canvasHeight = margin + row1.height + gutter + row2Height + margin;

  return { width: canvasWidth, height: canvasHeight, placements };
}

function calculateHeroTopLayout<T extends LayoutItem>(
  items: T[],
  borderW: number,
): SharedLayout<T> {
  const margin = 2 * borderW;
  const gutter = Math.round((2 / 3) * margin);

  if (items.length < 3) return { width: 1000, height: 1000, placements: [] };

  const row1 = calculateRowForItems([items[0]], gutter); // 1 item
  const row2 = calculateRowForItems([items[1], items[2]], gutter); // 2 items

  // Reference Width = Row 2 Total Width (since it has more structure/items)
  const referenceWidth = row2.totalWidth;

  // Scale Row 1 to match Reference
  const row1TargetContentW = referenceWidth - (row1.items.length - 1) * gutter;
  const scale1 = row1TargetContentW / row1.contentWidth;

  const placements: LayoutPlacement<T>[] = [];
  let y = margin;
  let x = margin;

  // Placement Row 1
  const r1Item = row1.items[0];
  const r1H = Math.round(r1Item.height * scale1);
  const r1W = referenceWidth; // Ensure perfect alignment with Row 2

  placements.push({
    x,
    y,
    width: r1W,
    height: r1H,
    item: r1Item.item,
    crop: r1Item.crop,
  });

  y += r1H + gutter;

  // Placement Row 2
  x = margin;
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
    width: margin + referenceWidth + margin,
    height: margin + r1H + gutter + row2.height + margin,
    placements,
  };
}

function calculateHeroLeftLayout<T extends LayoutItem>(
  items: T[],
  borderW: number,
): SharedLayout<T> {
  if (items.length < 3) return { width: 1000, height: 1000, placements: [] };

  const margin = 2 * borderW;
  const gutter = Math.round((2 / 3) * margin);

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
    x: margin,
    y: margin,
    width: leftW,
    height: targetHeight,
    item: leftItem,
    crop: leftItem.crop,
  });

  // Right
  let curY = margin;
  const startX = margin + leftW + gutter;

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
    width: margin + leftW + gutter + rightW + margin,
    height: margin + targetHeight + margin,
    placements,
  };
}

function calculateHeroRightLayout<T extends LayoutItem>(
  items: T[],
  borderW: number,
): SharedLayout<T> {
  if (items.length < 3) return { width: 1000, height: 1000, placements: [] };

  const margin = 2 * borderW;
  const gutter = Math.round((2 / 3) * margin);

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
  let curY = margin;
  let x = margin;
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
    x: margin + leftW + gutter,
    y: margin,
    width: rightW,
    height: targetHeight,
    item: rightItem,
    crop: rightItem.crop,
  });

  return {
    width: margin + leftW + gutter + rightW + margin,
    height: margin + targetHeight + margin,
    placements,
  };
}

function calculateSidebarHeroLayout<T extends LayoutItem>(
  items: T[],
  borderW: number,
): SharedLayout<T> {
  // 1 Left (Hero), Right: [2][3] (Top), [4] (Bottom)
  if (items.length < 4) return { width: 1000, height: 1000, placements: [] };

  const margin = 2 * borderW;
  const gutter = Math.round((2 / 3) * margin);

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
    x: margin,
    y: margin,
    width: leftW,
    height: rightBlockTotalHeight,
    item: leftItem,
    crop: leftItem.crop,
  });

  // Right
  let startX = margin + leftW + gutter;
  let curY = margin;

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
    width: margin + leftW + gutter + finalRightW + margin,
    height: margin + rightBlockTotalHeight + margin,
    placements,
  };
}

function calculateGrid3x2Layout<T extends LayoutItem>(
  items: T[],
  borderW: number,
  cropStrategy: "smart" | "simple" = "smart",
): SharedLayout<T> {
  // 3 Rows x 2 items
  const margin = 2 * borderW;
  const gutter = Math.round((2 / 3) * margin);

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
    let y = margin;
    let x = margin;

    // R1
    for (const p of r1.items) {
      placements.push({ x, y, width: p.width, height: p.height, item: p.item, crop: p.crop });
      x += p.width + gutter;
    }
    y += r1.height + gutter;

    // R2
    x = margin;
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
    x = margin;
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

    return { width: margin + refW + margin, height: y + margin, placements };
  }

  // SIMPLE uniform logic (Fixed)
  const avgW = items.reduce((sum, i) => sum + i.width, 0) / items.length;
  const totalW = avgW * 2;
  const contentW = totalW - margin * 2;
  const cellW = Math.round((contentW - gutter) / 2);
  const cellH = cellW;
  const contentH = cellH * 3 + gutter * 2;
  const totalH = margin + contentH + margin;

  const placements: LayoutPlacement<T>[] = [];

  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 2; col++) {
      const idx = row * 2 + col;
      if (idx >= items.length) break;

      placements.push({
        x: margin + col * (cellW + gutter),
        y: margin + row * (cellH + gutter),
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

  const margin = 2 * borderW;
  const gutter = Math.round((2 / 3) * margin);

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
    let y = margin;

    // R1
    let x = margin;
    for (const p of r1.items) {
      placements.push({ x, y, width: p.width, height: p.height, item: p.item, crop: p.crop });
      x += p.width + gutter;
    }
    y += r1.height + gutter;

    // R2
    x = margin;
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
    x = margin;
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

    return { width: margin + refW + margin, height: y + margin, placements };
  }

  // SIMPLE uniform logic
  const avgW = items.reduce((sum, i) => sum + i.width, 0) / items.length;
  const totalW = avgW * 3;
  const contentW = totalW - margin * 2;
  const rowH = Math.round(contentW / 3);

  const placements: LayoutPlacement<T>[] = [];
  let y = margin;

  // Row 1 (2 items, 50-50)
  let cellW = Math.round((contentW - gutter) / 2);
  let x = margin;
  for (let i = 0; i < 2; i++) {
    placements.push({ x, y, width: cellW, height: rowH, item: items[i], crop: items[i].crop });
    x += cellW + gutter;
  }
  y += rowH + gutter;

  // Row 2 (3 items, 33-33-33)
  cellW = Math.round((contentW - 2 * gutter) / 3);
  x = margin;
  for (let i = 2; i < 5; i++) {
    placements.push({ x, y, width: cellW, height: rowH, item: items[i], crop: items[i].crop });
    x += cellW + gutter;
  }
  y += rowH + gutter;

  // Row 3 (2 items, 50-50)
  cellW = Math.round((contentW - gutter) / 2);
  x = margin;
  for (let i = 5; i < 7; i++) {
    placements.push({ x, y, width: cellW, height: rowH, item: items[i], crop: items[i].crop });
    x += cellW + gutter;
  }
  y += rowH;

  return { width: totalW, height: y + margin, placements };
}

function calculateMosaic6Layout<T extends LayoutItem>(
  items: T[],
  borderW: number,
  cropStrategy: "smart" | "simple" = "smart",
): SharedLayout<T> {
  const margin = 2 * borderW;
  const gutter = Math.round((2 / 3) * margin);

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
    let x = margin;
    let y = margin;
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
    y = margin;
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
    y = margin;
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
      width: margin + w1 + gutter + w2 + gutter + w3 + margin,
      height: margin + targetH + margin,
      placements,
    };
  }

  // SIMPLE logic
  const avgW = items.reduce((sum, i) => sum + i.width, 0) / items.length;
  const totalW = avgW * 3;
  const contentW = totalW - margin * 2 - gutter * 2;
  const w1 = Math.round(contentW * 0.3);
  const w2 = Math.round(contentW * 0.4);
  const w3 = contentW - w1 - w2;
  const totalH = Math.round(totalW * 0.66) + margin + margin;
  const contentH = totalH - margin - margin;

  const placements: LayoutPlacement<T>[] = [];
  let x = margin;

  // Col 1
  let cellH = Math.round((contentH - gutter) / 2);
  let y = margin;
  for (let i = 0; i < 2; i++) {
    placements.push({ x, y, width: w1, height: cellH, item: items[i], crop: items[i].crop });
    y += cellH + gutter;
  }
  x += w1 + gutter;

  // Col 2
  cellH = Math.round((contentH - 2 * gutter) / 3);
  y = margin;
  for (let i = 2; i < 5; i++) {
    placements.push({ x, y, width: w2, height: cellH, item: items[i], crop: items[i].crop });
    y += cellH + gutter;
  }
  x += w2 + gutter;

  // Col 3
  cellH = contentH;
  y = margin;
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

  const margin = 2 * borderW;
  const gutter = Math.round((2 / 3) * margin);

  const r1 = calculateRowForItems([items[0], items[1]], gutter);
  const r2 = calculateRowForItems([items[2], items[3], items[4]], gutter);

  const refW = r1.totalWidth;
  const r2TargetContentW = refW - (r2.items.length - 1) * gutter;
  const s2 = r2TargetContentW / r2.contentWidth;

  const placements: LayoutPlacement<T>[] = [];
  let y = margin;
  let x = margin;

  // R1
  for (const p of r1.items) {
    placements.push({ x, y, width: p.width, height: p.height, item: p.item, crop: p.crop });
    x += p.width + gutter;
  }
  y += r1.height + gutter;

  // R2
  x = margin;
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

  const totalH = y + Math.round(r2.height * s2) + margin;
  return { width: margin + refW + margin, height: totalH, placements };
}

export function calculateGrid32Layout<T extends LayoutItem>(
  items: T[],
  borderW: number,
  _cropStrategy: "smart" | "simple" = "smart",
): SharedLayout<T> {
  // 2 Rows: 3 items (top), 2 items (bottom)
  if (items.length < 5) return { width: 1000, height: 1000, placements: [] };

  const margin = 2 * borderW;
  const gutter = Math.round((2 / 3) * margin);

  const r1 = calculateRowForItems([items[0], items[1], items[2]], gutter);
  const r2 = calculateRowForItems([items[3], items[4]], gutter);

  const refW = r1.totalWidth;
  const r2TargetContentW = refW - (r2.items.length - 1) * gutter;
  const s2 = r2TargetContentW / r2.contentWidth;

  const placements: LayoutPlacement<T>[] = [];
  let y = margin;
  let x = margin;

  // R1
  for (const p of r1.items) {
    placements.push({ x, y, width: p.width, height: p.height, item: p.item, crop: p.crop });
    x += p.width + gutter;
  }
  y += r1.height + gutter;

  // R2
  x = margin;
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

  const totalH = y + Math.round(r2.height * s2) + margin;
  return { width: margin + refW + margin, height: totalH, placements };
}

export function calculateSidebarGridLayout<T extends LayoutItem>(
  items: T[],
  borderW: number,
): SharedLayout<T> {
  // 1 Left (Hero), Right: [1][2] (Top), [3][4] (Bottom)
  if (items.length < 5) return { width: 1000, height: 1000, placements: [] };

  const margin = 2 * borderW;
  const gutter = Math.round((2 / 3) * margin);

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
    x: margin,
    y: margin,
    width: leftW,
    height: rightBlockTotalHeight,
    item: leftItem,
    crop: leftItem.crop,
  });

  let startX = margin + leftW + gutter;
  let curY = margin;

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
    width: margin + leftW + gutter + finalRightW + margin,
    height: margin + rightBlockTotalHeight + margin,
    placements,
  };
}

/**
 * Scale the entire layout down if any placement would cause an upscaling of its source.
 * This preserves source-image quality by avoiding upscaling.
 */
function applyQualityScale(layout: SharedLayout<LayoutItem>): SharedLayout<LayoutItem> {
  let minScaleFactor = 1.0;

  for (const p of layout.placements) {
    if (!p.crop?.scale) continue;

    const userZoom = p.crop.scale;
    if (userZoom <= 1.0) continue;

    const scaleW = p.width / (p.item.width || 1);
    const scaleH = p.height / (p.item.height || 1);
    const baseScale = Math.max(scaleW, scaleH);
    const finalScale = baseScale * userZoom;

    if (finalScale > 1.0) {
      const requiredShrink = 1.0 / finalScale;
      minScaleFactor = Math.min(minScaleFactor, requiredShrink);
    }
  }

  if (minScaleFactor >= 1.0) return layout;

  const targetW = getTargetDimension(layout, "x", minScaleFactor);
  const targetH = getTargetDimension(layout, "y", minScaleFactor);

  stretchDimension(layout, "x", targetW);
  stretchDimension(layout, "y", targetH);

  return layout;
}

function getTargetDimension(layout: SharedLayout<LayoutItem>, axis: "x" | "y", scale: number) {
  const posKey = axis === "x" ? "x" : "y";
  const dimKey = axis === "x" ? "width" : "height";

  const rawIntervals = layout.placements.map((p) => [p[posKey], p[posKey] + p[dimKey]]);
  rawIntervals.sort((a, b) => a[0] - b[0]);
  const merged: [number, number][] = [];
  if (rawIntervals.length > 0) {
    let curr = rawIntervals[0];
    for (let i = 1; i < rawIntervals.length; i++) {
      if (rawIntervals[i][0] <= curr[1] + 0.1) {
        curr[1] = Math.max(curr[1], rawIntervals[i][1]);
      } else {
        merged.push([curr[0], curr[1]]);
        curr = rawIntervals[i];
      }
    }
    merged.push([curr[0], curr[1]]);
  }
  const contentSum = merged.reduce((sum, [s, e]) => sum + (e - s), 0);
  const gapsSum = layout[dimKey] - contentSum;
  return Math.round(contentSum * scale + gapsSum);
}

/**
 * Reduce layout to fit within a maximum dimension (8K), scaling placements accordingly.
 */
function applyMaxDimensionLimit(
  layout: SharedLayout<LayoutItem>,
  maxDimension: number,
): SharedLayout<LayoutItem> {
  if (layout.width <= maxDimension && layout.height <= maxDimension) {
    return layout;
  }

  const scale = maxDimension / Math.max(layout.width, layout.height);

  const targetW = getTargetDimension(layout, "x", scale);
  const targetH = getTargetDimension(layout, "y", scale);

  stretchDimension(layout, "x", targetW);
  stretchDimension(layout, "y", targetH);

  return layout;
}

/**
 * Adjust layout dimensions to match a target aspect ratio by stretching images.
 * Unlike simple scaling, this logic preserves fixed borders and gutters (no dynamics).
 */
function applyAspectRatio(
  layout: SharedLayout<LayoutItem>,
  ratioId: string,
): SharedLayout<LayoutItem> {
  const [wRatio, hRatio] = ratioId.split(":").map(Number);
  if (!wRatio || !hRatio) return layout;

  const targetRatio = wRatio / hRatio;
  const currentRatio = layout.width / layout.height;

  if (Math.abs(currentRatio - targetRatio) < 0.01) return layout;

  // Clone layout and placements to avoid side-effects
  const newLayout: SharedLayout<LayoutItem> = {
    ...layout,
    placements: layout.placements.map((p) => ({ ...p })),
  };

  if (currentRatio > targetRatio) {
    // Current is wider than target -> Increase Height (Stretch Y)
    const newTotalHeight = Math.round(layout.width / targetRatio);
    stretchDimension(newLayout, "y", newTotalHeight);
  } else {
    // Current is taller than target -> Increase Width (Stretch X)
    const newTotalWidth = Math.round(layout.height * targetRatio);
    stretchDimension(newLayout, "x", newTotalWidth);
  }

  return newLayout;
}

/**
 * Stretches a layout along one axis while keepings gaps (gutters/margins) fixed.
 * Only segments of the axis occupied by image content are scaled.
 */
function stretchDimension(layout: SharedLayout<LayoutItem>, axis: "x" | "y", targetTotal: number) {
  const posKey = axis === "x" ? "x" : "y";
  const dimKey = axis === "x" ? "width" : "height";
  const oldTotal = layout[dimKey];
  if (oldTotal === targetTotal) return;

  // 1. Identify Content Intervals along the axis
  const rawIntervals = layout.placements.map((p) => [p[posKey], p[posKey] + p[dimKey]]);
  rawIntervals.sort((a, b) => a[0] - b[0]);

  const merged: [number, number][] = [];
  if (rawIntervals.length > 0) {
    let curr = rawIntervals[0];
    for (let i = 1; i < rawIntervals.length; i++) {
      // Tiny epsilon to bridge sub-pixel rounding gaps if any
      if (rawIntervals[i][0] <= curr[1] + 0.1) {
        curr[1] = Math.max(curr[1], rawIntervals[i][1]);
      } else {
        merged.push([curr[0], curr[1]]);
        curr = rawIntervals[i];
      }
    }
    merged.push([curr[0], curr[1]]);
  }

  const oldContentSum = merged.reduce((sum, [s, e]) => sum + (e - s), 0);
  const totalChange = targetTotal - oldTotal;

  if (oldContentSum <= 0) {
    layout[dimKey] = targetTotal;
    return;
  }

  const scale = (oldContentSum + totalChange) / oldContentSum;

  /**
   * Transforms a coordinate by scaling only the parts that fall within content intervals.
   */
  const transform = (v: number) => {
    let newV = 0;
    let lastE = 0;
    let contentProcessed = 0;

    for (const [s, e] of merged) {
      // Add the gap before this interval (unscaled)
      newV += s - lastE;
      if (v <= s) return newV - (s - v);

      const segmentLen = e - s;
      const progressInSegment = Math.min(v - s, segmentLen);

      // Add scaled progress
      const scaledSegmentStart = contentProcessed * scale;
      const scaledProgress = (contentProcessed + progressInSegment) * scale - scaledSegmentStart;

      if (v <= e) {
        return newV + scaledProgress;
      }

      newV += segmentLen * scale;
      contentProcessed += segmentLen;
      lastE = e;
    }

    // Add final gap (unscaled)
    newV += oldTotal - lastE;
    return newV - (oldTotal - v);
  };

  for (const p of layout.placements) {
    const s = p[posKey];
    const e = p[posKey] + p[dimKey];
    const newS = transform(s);
    const newE = transform(e);

    p[posKey] = Math.round(newS);
    p[dimKey] = Math.round(newE - newS);
  }

  layout[dimKey] = targetTotal;
}
