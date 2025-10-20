// Bun + TypeScript + Sharp image generator for SvelteKit photoblog - FINAL REFACTORED VERSION
/// <reference types="@types/bun" />

import fsp from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import fg from 'fast-glob';
import pc from 'picocolors';
import { SingleBar } from 'cli-progress';
import { config } from './config';
import exifr from 'exifr';
import matter from 'gray-matter';
import type { ImageEntry, PhotoDay, Manifest, Cache, CacheFileEntry, ScriptArgs, QualityTypes, ImageSource, StoryDataMap, StoryData, Separator } from '../src/types';
import slugify from 'slugify';

// --- Type Definitions ---
type SharpModule = typeof import('sharp');
type SharpInstance = ReturnType<SharpModule>;
let sharp: SharpModule | null = null;

const CACHE_VERSION = 7; // <-- Incremented cache version due to structure change
const INPUT_EXTS = ['jpg', 'jpeg'];

// --- Utilities ---
function toPosix(p: string) { return p.split(path.sep).join('/'); }
async function fileExists(file: string) { try { await fsp.access(file); return true; } catch { return false; } }
async function ensureDir(dir: string) { await fsp.mkdir(dir, { recursive: true }); }
function sha1(buf: Buffer | Uint8Array) { return crypto.createHash('sha1').update(buf).digest('hex'); }
async function loadJSON<T>(file: string, fallback: T): Promise<T> {
  try { return JSON.parse(await fsp.readFile(file, 'utf8')) as T; } catch { return fallback; }
}
async function saveJSON(file: string, data: any) {
  await ensureDir(path.dirname(file));
  await fsp.writeFile(file, JSON.stringify(data, null, 2) + '\n', 'utf8');
}

function getAspectRatioName(width: number, height: number): string {
  const ratio = width / height;
  if (Math.abs(ratio - 1) < 0.05) return 'square';
  if (ratio > 2.2) return 'panorama';
  if (Math.abs(ratio - 16 / 9) < 0.05) return 'landscape-16-9';
  if (Math.abs(ratio - 3 / 2) < 0.05) return 'landscape-3-2';
  if (Math.abs(ratio - 4 / 3) < 0.05) return 'landscape-4-3';
  if (Math.abs(ratio - 9 / 16) < 0.05) return 'portrait-9-16';
  if (Math.abs(ratio - 2 / 3) < 0.05) return 'portrait-2-3';
  if (Math.abs(ratio - 3 / 4) < 0.05) return 'portrait-3-4';
  return ratio > 1 ? 'landscape' : 'portrait';
}

// --- Concurrency Limiter ---
function createConcurrencyLimiter(limit: number) {
  let running = 0;
  const queue: Array<() => void> = [];

  return function run<T>(fn: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      const execute = async () => {
        running++;
        try {
          const result = await fn();
          resolve(result);
        } catch (error) {
          reject(error);
        } finally {
          running--;
          if (queue.length > 0) {
            const next = queue.shift()!;
            next();
          }
        }
      };

      if (running < limit) {
        execute();
      } else {
        queue.push(execute);
      }
    });
  };
}

// -- Argument Parsing & Logging --
function parseArgs(argv: string[]): ScriptArgs {
  const args = {
    concurrency: config.script.concurrency,
    limit: config.script.limit,
    watch: false,
    clean: false,
    verbose: false,
    quiet: false,
    manifestOnly: false,
  };

  for (const arg of argv) {
    if (!arg.startsWith('--')) continue;
    const [k, vRaw] = arg.slice(2).split('=');
    const v = vRaw ?? 'true';
    switch (k) {
      case 'watch': args.watch = v === 'true'; break;
      case 'clean': args.clean = v === 'true'; break;
      case 'verbose': args.verbose = v === 'true'; break;
      case 'quiet': args.quiet = v === 'true'; break;
      case 'limit': args.limit = parseInt(v, 10); break;
      case 'concurrency': args.concurrency = v === 'auto' ? 'auto' : parseInt(v, 10); break;
      case 'manifest-only':
      case 'manifestOnly':
        args.manifestOnly = v === 'true';
        break;
    }
  }

  let concurrency: number;
  if (args.concurrency === 'auto') {
    concurrency = Math.max(1, (os.cpus()?.length || 2) - 1);
  } else {
    concurrency = Math.max(1, Number(args.concurrency) || 1);
  }

  return { ...args, concurrency };
}

const ARGS = parseArgs(process.argv.slice(2));
const log = {
  info: (...msg: any[]) => !ARGS.quiet && console.log(pc.cyan('[images]'), ...msg),
  warn: (...msg: any[]) => !ARGS.quiet && console.warn(pc.yellow('[images]'), ...msg),
  error: (...msg: any[]) => console.error(pc.red('[images]'), ...msg),
  verbose: (...msg: any[]) => ARGS.verbose && !ARGS.quiet && console.log(pc.dim('[images]'), ...msg),
};

// --- Global Context ---
const CTX = {
  srcRoot: path.resolve(process.cwd(), config.paths.source),
  contentRoot: path.resolve(process.cwd(), 'content'), // Path to markdown files
  outRoot: path.resolve(process.cwd(), config.paths.output),
  manifestPath: path.resolve(process.cwd(), config.paths.manifest),
  cachePath: path.resolve(process.cwd(), config.paths.cache),
  configHash: sha1(Buffer.from(JSON.stringify(config))),
};

// --- Main Orchestration ---
async function main() {
  await loadSharpOrExplain();
  if (ARGS.clean) await cleanAllOutputs();

  if (ARGS.watch) {
    log.info(`Watch mode enabled. Watching ${toPosix(CTX.srcRoot)} and ${toPosix(CTX.contentRoot)}.`);
    await runIncrementalBuild();
  } else {
    await runIncrementalBuild();
  }
}

async function runIncrementalBuild() {
  const startTime = performance.now();
  log.info('Starting incremental build...');
  if (ARGS.manifestOnly) {
    log.info('Manifest-only mode enabled. Skipping writes for generated images.');
  }

  let cache = await loadJSON<Cache>(CTX.cachePath, { version: CACHE_VERSION, configHash: CTX.configHash, files: {} });
  if (cache.configHash !== CTX.configHash || cache.version !== CACHE_VERSION) {
    log.warn('Config or cache version change detected. Forcing full rebuild.');
    await cleanAllOutputs();
    cache = { version: CACHE_VERSION, configHash: CTX.configHash, files: {} };
  }

  const storyData = await loadStoryData();
  const sourceFiles = await fg(`**/*.{${INPUT_EXTS.join(',')}}`, { cwd: CTX.srcRoot, absolute: true, dot: false });
  if (ARGS.limit > 0) sourceFiles.splice(ARGS.limit);

  const { toProcess, toDelete } = await detectChanges(sourceFiles, cache);
  log.info(`Found: ${toProcess.length} new/modified, ${toDelete.length} deleted.`);
  log.info(`Using concurrency: ${ARGS.concurrency}`);

  if (toDelete.length > 0) {
    for (const key of toDelete) {
      const outputs = cache.files[key]?.outputs || [];
      for (const p of outputs) await fsp.unlink(path.join(CTX.outRoot, p)).catch(() => { });
      delete cache.files[key];
    }
  }

  const bar = ARGS.quiet ? null : new SingleBar({ format: 'Processing [{bar}] {percentage}% | {value}/{total}' });
  if (bar) bar.start(toProcess.length, 0);

  const limiter = createConcurrencyLimiter(ARGS.concurrency);

  const results = (await Promise.all(toProcess.map(async file => {
    return limiter(async () => {
      const result = await processImage(file);
      if (bar) bar.increment();
      return result;
    });
  }))).filter((r): r is NonNullable<typeof r> => r !== null);

  if (bar) bar.stop();

  const finalManifest = await updateManifest(results, toDelete, storyData);
  for (const res of results) {
    cache.files[res.key] = { hash: res.hash, mtimeMs: res.mtimeMs, outputs: res.outputs };
  }

  cache.configHash = CTX.configHash;
  await saveJSON(CTX.cachePath, cache);
  await saveJSON(CTX.manifestPath, finalManifest);

  // Also generate a lightweight menu JSON for the header/menu component.
  try {
    const menu = finalManifest.photoDays.map((d: any) => {
      const rawDayId = d.id || d.date;
      const dayId = String(rawDayId).startsWith('day-') ? String(rawDayId) : 'day-' + String(rawDayId);
      const label = new Date(d.date).toLocaleDateString('cs-CZ', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
      const locations = (d.items || []).filter((it: any) => it.type === 'separator').map((s: any) => {
        const rawLocId = s.id || slugify(s.location || 'unknown', { lower: true, strict: true });
        const locId = String(rawLocId).startsWith('loc-') ? String(rawLocId) : 'loc-' + String(rawLocId);
        return { id: locId, label: s.location };
      });
      return { id: dayId, date: d.date, label, locations };
    });

    await saveJSON(path.join(process.cwd(), 'src/lib/menu.json'), menu);
    log.info('Generated lightweight menu JSON at src/lib/menu.json');
  } catch (e: any) {
    log.warn('Could not generate menu JSON:', e?.message ?? e);
  }

  log.info(`Build finished in ${(performance.now() - startTime).toFixed(2)}ms.`);
}

async function detectChanges(sourceFiles: string[], cache: Cache) {
  const toProcess: string[] = [];
  const knownKeys = new Set(Object.keys(cache.files));

  for (const file of sourceFiles) {
    const key = toPosix(path.relative(CTX.srcRoot, file));
    knownKeys.delete(key);
    const stats = await fsp.stat(file);
    const cached = cache.files[key];

    if (!cached || cached.mtimeMs !== stats.mtimeMs) {
      toProcess.push(file);
      continue;
    }

    // Verify that all output files exist
    const outputsExist = await Promise.all(cached.outputs.map(p => fileExists(path.join(CTX.outRoot, p))));
    if (outputsExist.some(exists => !exists)) {
      log.verbose(`Output file missing for ${key}, reprocessing.`);
      toProcess.push(file);
    }
  }
  return { toProcess, toDelete: Array.from(knownKeys) };
}

async function loadStoryData(): Promise<StoryDataMap> {
  const storyFiles = await fg('**/*.md', { cwd: CTX.contentRoot, absolute: true });
  const storyDataMap: StoryDataMap = {};
  for (const file of storyFiles) {
    try {
      const fileContent = await fsp.readFile(file, 'utf8');
      const { data, content: bodyContent } = matter(fileContent);
      if (data.location) {
        // Prioritize content from frontmatter, use body as fallback.
        data.content = data.content || bodyContent.trim();
        storyDataMap[data.location] = data as StoryData;
      }
    } catch (e: any) {
      log.warn(`Could not parse story file ${file}: ${e.message}`);
    }
  }
  log.verbose(`Loaded ${Object.keys(storyDataMap).length} story entries from Markdown.`);
  return storyDataMap;
}

async function processImage(absPath: string) {
  if (!sharp) return null;
  const key = toPosix(path.relative(CTX.srcRoot, absPath));
  const baseName = path.basename(absPath, path.extname(absPath));

  try {
    const fileBuffer = await fsp.readFile(absPath);
    const stats = await fsp.stat(absPath);
    const hash = sha1(fileBuffer); // Re-introduce hash calculation
    const sharpInstance = sharp(fileBuffer);
    const [imageStats, exif, originalMeta] = await Promise.all([
      sharpInstance.stats(),
      exifr.parse(fileBuffer, { exif: true, iptc: true, xmp: true, multiSegment: true }),
      sharpInstance.metadata()
    ]);

    const { r, g, b } = imageStats.dominant;
    const placeholderColor = `rgb(${r},${g},${b})`;

    const locations = [exif.Sublocation, exif.Location].filter(Boolean) as string[];
    const city = exif.City || '';
    const titleParts = [...locations, city].filter(Boolean);

    const outputs: string[] = [];
    const sources: ImageSource[] = [];

    const imageEntry: Partial<ImageEntry> = {
      type: 'image',
      src: path.basename(absPath),
      alt: locations.join(', ') || exif.ImageDescription || exif.ObjectName || 'Photoblog image',
      title: titleParts.join(', ') || exif.ObjectName || exif.ImageDescription || '',
      width: originalMeta.width,
      height: originalMeta.height,
      aspectRatio: getAspectRatioName(originalMeta.width || 1, originalMeta.height || 1),
      placeholderColor,
      exif: {
        date: (exif.DateTimeOriginal || exif.CreateDate)?.toISOString(),
        location: exif.Location,
        city: exif.City,
        sublocation: exif.Sublocation,
        latitude: exif.latitude,
        longitude: exif.longitude,
        orientation: exif.Orientation,
      }
    };

    for (const [variantKey, variantConfig] of Object.entries(config.variants)) {
      for (const format of config.encoding.formats) {
        const typedFormat = format as QualityTypes;
        const folderSuffix = typedFormat === 'jpeg' ? '' : `-${typedFormat}`;
        const fullFolderName = variantConfig.folderName + folderSuffix;
        const outPath = toPosix(path.join(fullFolderName, `${baseName}.${typedFormat}`));
        const fullPath = `/images/israel-2022/${outPath}`;
        outputs.push(outPath);

        const fullOutPath = path.join(CTX.outRoot, outPath);
        let info;
        if (!ARGS.manifestOnly) {
          await ensureDir(path.dirname(fullOutPath));
          const resizedInstance = sharp(fileBuffer).resize(variantConfig.resize);
          applyFormat(resizedInstance, typedFormat, config.encoding.quality[typedFormat]);
          info = await resizedInstance.toFile(fullOutPath);
        } else {
          const resizedInstance = sharp(fileBuffer).resize(variantConfig.resize);
          applyFormat(resizedInstance, typedFormat, config.encoding.quality[typedFormat]);
          info = (await resizedInstance.toBuffer({ resolveWithObject: true })).info;
        }

        sources.push({ variant: variantKey, type: `image/${typedFormat}`, path: fullPath, width: info.width });
      }
    }

    for (const [outputKey, outputConfig] of Object.entries(config.otherOutputs)) {
      const format = 'format' in outputConfig ? outputConfig.format : 'jpeg';
      const typedFormat = format as 'jpeg' | 'png';
      const outPath = toPosix(path.join(outputConfig.folderName, `${baseName}.${typedFormat}`));
      outputs.push(outPath);

      const fullOutPath = path.join(CTX.outRoot, outPath);
      let info;
      if (!ARGS.manifestOnly) {
        await ensureDir(path.dirname(fullOutPath));
        const resizedInstance = sharp(fileBuffer).resize(outputConfig.resize);
        if ('blur' in outputConfig && outputConfig.blur) {
          resizedInstance.blur(10).png(config.encoding.sharp.blur.png);
        } else if (typedFormat !== 'png') {
          applyFormat(resizedInstance, 'jpeg', config.encoding.quality.jpeg);
        }
        info = await resizedInstance.toFile(fullOutPath);
      } else {
        const resizedInstance = sharp(fileBuffer).resize(outputConfig.resize);
        if ('blur' in outputConfig && outputConfig.blur) {
          resizedInstance.blur(10).png(config.encoding.sharp.blur.png);
        } else if (typedFormat !== 'png') {
          applyFormat(resizedInstance, 'jpeg', config.encoding.quality.jpeg);
        }
        info = (await resizedInstance.toBuffer({ resolveWithObject: true })).info;
      }

      if (outputKey === 'placeholder') {
        imageEntry.placeholder = outPath;
      } else {
        sources.push({
          variant: outputKey,
          type: `image/${typedFormat}`,
          path: `/images/israel-2022/${outPath}`,
          width: info.width,
          height: info.height,
        } as ImageSource);
      }
    }

    imageEntry.sources = sources;

    return {
      key, hash, mtimeMs: stats.mtimeMs, outputs,
      image: imageEntry as ImageEntry,
    };

  } catch (e: any) {
    log.error(`Failed to process ${key}:`, e.message);
    return null;
  }
}

function applyFormat(instance: SharpInstance, format: QualityTypes, quality: number) {
  if (format === 'jpeg') instance.jpeg({ quality, ...config.encoding.sharp.jpeg });
  else if (format === 'webp') instance.webp({ quality, ...config.encoding.sharp.webp });
  else if (format === 'avif') instance.avif({ quality, ...config.encoding.sharp.avif });
}

async function updateManifest(results: any[], deletedKeys: string[], storyData: StoryDataMap): Promise<Manifest> {
  const manifest: Manifest = await loadJSON(CTX.manifestPath, { photoDays: [] });

  // Process deletions - robustly handle old and new structures
  manifest.photoDays.forEach((day: any) => {
    const items = day.items || day.images || [];
    day.items = items.filter((item: any) => item.type === 'separator' || !deletedKeys.some(key => item.src.startsWith(path.basename(key, path.extname(key)))));
    delete day.images; // remove old property if it exists
  });
  manifest.photoDays = manifest.photoDays.filter((day: PhotoDay) => day.items.length > 0);

  // Group results by date
  const resultsByDate: { [date: string]: any[] } = {};
  for (const result of results) {
    const date = result.image.exif.date?.substring(0, 10);
    if (!date) continue;
    if (!resultsByDate[date]) resultsByDate[date] = [];
    resultsByDate[date].push(result);
  }

  // Process additions/updates
  for (const date of Object.keys(resultsByDate)) {
    const dayResults = resultsByDate[date];
    let day: PhotoDay | undefined = manifest.photoDays.find(d => d.date === date);

    if (!day) {
      const newDay: any = { date, items: [], id: 'day-' + date };
      manifest.photoDays.push(newDay);
      day = newDay;
    }

    // Add/update images
    if (!day) continue;
    for (const result of dayResults) {
      day.items = day.items.filter(item => item.type === 'separator' || !item.src.startsWith(path.basename(result.key, path.extname(result.key))));
      day.items.push(result.image);
    }

    // Rebuild the entire day's items with separators
    const imagesForDay = day.items.filter(item => item.type === 'image') as ImageEntry[];
    imagesForDay.sort((a, b) => a.src.localeCompare(b.src));

    const itemsWithSeparators: (ImageEntry | Separator)[] = [];
    const imagesByLocation: Record<string, ImageEntry[]> = {};

    // Group images by location
    for (const image of imagesForDay) {
      const location = image.exif?.location || 'Unknown';
      if (!imagesByLocation[location]) {
        imagesByLocation[location] = [];
      }
      imagesByLocation[location].push(image);
    }

    // Create new items array with separators
    for (const location of Object.keys(imagesByLocation).sort()) {
      const group = imagesByLocation[location];
      if (group.length > 2) {
        const story = storyData[location];
        const separator: Separator = {
          type: 'separator',
          location: location,
          city: group[0].exif?.city || '',
          ...(story && { storyTitle: story.title, storyContent: story.content })
        };
        // attach an id for linking
        (separator as any).id = 'loc-' + slugify(location, { lower: true, strict: true });
        itemsWithSeparators.push(separator);
      }
      itemsWithSeparators.push(...group);
    }

    day.items = itemsWithSeparators;
  }

  manifest.photoDays.sort((a, b) => a.date.localeCompare(b.date));
  return manifest;
}

async function loadSharpOrExplain() {
  if (sharp) return;
  try { sharp = (await import('sharp')).default; } catch (err) {
    log.error('Sharp library not found, please install it: bun add sharp');
    process.exit(1);
  }
}
async function cleanAllOutputs() {
  log.warn(`Cleaning all generated files in ${toPosix(CTX.outRoot)} and the cache...`);
  await fsp.rm(CTX.outRoot, { recursive: true, force: true }).catch(() => { });
  await fsp.rm(CTX.cachePath, { force: true }).catch(() => { });
  await fsp.mkdir(CTX.outRoot, { recursive: true });
}

main().catch((e) => {
  log.error('Unexpected error:', e);
  process.exit(1);
});
