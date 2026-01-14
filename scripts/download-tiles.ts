import { exists, mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
// Use relative import for project logger
import { createLogger } from "./lib/core/cli-logger";

const __dirname = dirname(fileURLToPath(import.meta.url));
const log = createLogger("tiles");

// Configuration
const CONTENT_DIR = process.env.CONTENT_DIR || "egypt-2025";
const MANIFEST_PATH = join(__dirname, `../src/data/${CONTENT_DIR}/map.manifest.json`);
const STATIC_DIR = join(__dirname, `../static-${CONTENT_DIR}`);

// Tile sources
const TILE_SOURCES = {
  street: "https://basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png",
  satellite:
    "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
};

const MAX_ZOOM = 16;
const GLOBAL_MAX_ZOOM = 5; // Download all tiles up to this zoom
const CONCURRENCY = 50; // Higher concurrency since we have fewer tiles
const RETINA = "";

interface Location {
  lat: number;
  lng: number;
}

interface Manifest {
  locations: Location[];
}

function latLonToTile(lat: number, lon: number, zoom: number) {
  const n = 2 ** zoom;
  const x = Math.floor(((lon + 180) / 360) * n);
  const latRad = (lat * Math.PI) / 180;
  const y = Math.floor(((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n);
  return { x, y };
}

async function downloadTile(z: number, x: number, y: number, tileType: "street" | "satellite") {
  const template = TILE_SOURCES[tileType];
  const url = template
    .replace("{z}", z.toString())
    .replace("{x}", x.toString())
    .replace("{y}", y.toString())
    .replace("{r}", RETINA);

  const dir = join(STATIC_DIR, `map-tiles-${tileType}`, z.toString(), x.toString());
  const file = join(dir, `${y}.png`);

  if (await exists(file)) {
    return false; // Skipped
  }

  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": "Photoblog-Tile-Downloader/1.0",
      },
    });

    if (!response.ok) {
      if (response.status === 404) return false; // Not found on server
      throw new Error(`Failed: ${response.status}`);
    }

    const buffer = await response.arrayBuffer();
    await mkdir(dir, { recursive: true });
    await writeFile(file, Buffer.from(buffer));
    return true; // Downloaded
  } catch (err) {
    if (String(err).includes("404")) return false;
    log.debug({ url, err }, "Error downloading tile");
    return false; // Failed
  }
}

async function main() {
  log.info({ path: MANIFEST_PATH }, `Reading manifest from ${MANIFEST_PATH}`);
  const content = await readFile(MANIFEST_PATH, "utf-8");
  const manifest = JSON.parse(content) as Manifest;

  const locations = manifest.locations;
  if (!locations.length) {
    log.error({}, "No locations found in manifest");
    return;
  }

  const keysToDownload = new Set<string>();

  // Strategy 1: Global tiles (Zoom 0 to GLOBAL_MAX_ZOOM)
  log.info(
    { minZ: 0, maxZ: GLOBAL_MAX_ZOOM },
    `Calculating global tiles (Z0-${GLOBAL_MAX_ZOOM})...`,
  );
  for (let z = 0; z <= GLOBAL_MAX_ZOOM; z++) {
    const max = 2 ** z;
    for (let x = 0; x < max; x++) {
      for (let y = 0; y < max; y++) {
        keysToDownload.add(`${z}/${x}/${y}`);
      }
    }
  }

  // Strategy 2: Around locations (Zoom GLOBAL_MAX_ZOOM+1 to MAX_ZOOM)
  log.info(
    { minZ: GLOBAL_MAX_ZOOM + 1, maxZ: MAX_ZOOM },
    `Calculating location-based tiles (Z${GLOBAL_MAX_ZOOM + 1}-${MAX_ZOOM})...`,
  );
  for (let z = GLOBAL_MAX_ZOOM + 1; z <= MAX_ZOOM; z++) {
    const radius = z <= 10 ? 1 : z <= 13 ? 2 : 3; // Adaptive radius

    for (const loc of locations) {
      const center = latLonToTile(loc.lat, loc.lng, z);
      for (let x = center.x - radius; x <= center.x + radius; x++) {
        for (let y = center.y - radius; y <= center.y + radius; y++) {
          // Validate bounds
          if (x >= 0 && x < 2 ** z && y >= 0 && y < 2 ** z) {
            keysToDownload.add(`${z}/${x}/${y}`);
          }
        }
      }
    }
  }

  const total = keysToDownload.size;
  const totalTiles = total * 2; // street + satellite
  log.info(
    { total, totalTiles },
    `Identified ${total} unique tiles × 2 sources = ${totalTiles} downloads.`,
  );

  let processed = 0;
  let downloaded = 0;

  // Download both street and satellite tiles
  for (const tileType of ["street", "satellite"] as const) {
    log.info({ tileType }, `Downloading ${tileType} tiles...`);

    const queue = Array.from(keysToDownload).map((key) => {
      const [z, x, y] = key.split("/").map(Number);
      return async () => {
        const res = await downloadTile(z, x, y, tileType);
        if (res) downloaded++;
        processed++;
        if (processed % 100 === 0) {
          log.raw(
            `\rProgress: ${processed}/${totalTiles} (${Math.round((processed / totalTiles) * 100)}%), New: ${downloaded}`,
          );
        }
      };
    });

    // Simple concurrency loop
    const results = [];
    while (queue.length > 0) {
      const batch = queue.splice(0, CONCURRENCY);
      results.push(Promise.all(batch.map((fn) => fn())));
      await results[results.length - 1];
    }
  }

  log.info({ downloaded, total: totalTiles }, `Done! Downloaded ${downloaded} new tiles.`);
}

main().catch((err) => log.error({ err }, "Fatal error"));
