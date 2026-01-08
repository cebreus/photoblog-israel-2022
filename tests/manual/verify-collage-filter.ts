/**
 * Manual test script to verify collage filtering in the actual manifest
 * Run: bun run tests/manual/verify-collage-filter.ts
 */

import manifest from "../../src/data/egypt-2025/images.manifest.json" with { type: "json" };

console.log("\n=== VERIFIKACE KOLÁŽNÍCH FILTRŮ ===\n");

// Count different types
let totalImages = 0;
let typeCollage = 0;
let typeImage = 0;
let aspectRatioCollage = 0;
let idContainsCollage = 0;

for (const day of manifest.photoDays) {
  for (const rawItem of day.items) {
    const item = rawItem as any;
    if (item.type === "separator") continue;

    totalImages++;

    if (item.type === "collage") {
      typeCollage++;
      console.log(`✅ TYPE=collage: ${item.id}`);
    }

    if (item.type === "image") {
      typeImage++;
    }

    if (item.aspectRatio === "collage") {
      aspectRatioCollage++;
      if (item.type !== "collage") {
        console.log(`⚠️  ASPECTRATIO=collage but TYPE=${item.type}: ${item.id}`);
      }
    }

    if (item.id?.includes("--collage")) {
      idContainsCollage++;
      if (item.type !== "collage" && item.aspectRatio !== "collage") {
        console.log(
          `❌ ID contains --collage but TYPE=${item.type}, ASPECT=${item.aspectRatio}: ${item.id}`,
        );
      }
    }
  }
}

console.log("\n--- SOUHRN ---");
console.log(`Celkem obrázků: ${totalImages}`);
console.log(`type=collage: ${typeCollage}`);
console.log(`type=image: ${typeImage}`);
console.log(`aspectRatio=collage: ${aspectRatioCollage}`);
console.log(`ID obsahuje --collage: ${idContainsCollage}`);

// Simulate filtering logic
console.log("\n--- SIMULACE FILTRU ---");

function wouldBeFilteredAsCollage(item: any): boolean {
  let effectiveType = item.type;

  if (effectiveType === "image" && item.aspectRatio === "panorama") {
    effectiveType = "panorama";
  }

  if (
    effectiveType === "image" &&
    (item.aspectRatio === "collage" || item.id?.includes("--collage"))
  ) {
    effectiveType = "collage";
  }

  return effectiveType === "collage";
}

let wouldBeShown = 0;
for (const day of manifest.photoDays) {
  for (const rawItem of day.items) {
    const item = rawItem as any;
    if (item.type === "separator") continue;
    if (wouldBeFilteredAsCollage(item)) {
      wouldBeShown++;
    }
  }
}

console.log(`Při filtru "mediaTypes=collage" by se zobrazilo: ${wouldBeShown} položek`);

if (wouldBeShown === 0) {
  console.log("\n❌ PROBLÉM: Filtr by nezobrazil žádné koláže!");
} else {
  console.log(`\n✅ Filtr by zobrazil ${wouldBeShown} kolážní položek`);
}

console.log("\n");
