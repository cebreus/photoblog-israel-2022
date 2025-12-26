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
  border: CollageBorder,
): SharedLayout<T> {
  const borderW = border.width || 0;

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

  // Fallback for empty or unknown
  return { width: 1000, height: 1000, placements: [] };
}

function calculateRowLayout<T extends LayoutItem>(items: T[], borderW: number): SharedLayout<T> {
  const marginX = borderW * 2;
  const marginTop = borderW * 2;
  const marginBottom = borderW * 3;
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
  const marginX = borderW * 2;
  const marginTop = borderW * 2;
  const marginBottom = borderW * 3;
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

  const marginX = borderW * 2;
  const marginTop = borderW * 2;
  const marginBottom = borderW * 3;
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
