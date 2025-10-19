// Bun + TypeScript + Sharp image generator for SvelteKit photoblog
// Requirements fulfilled per spec: CLI, watch, cache, clean, formats, qualities, placeholders, dominant color, deterministic output.

/// <reference types="@types/bun" />

import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import fg from 'fast-glob';
import pc from 'picocolors';
import { SingleBar } from 'cli-progress';
import type { Quality, GifMode, VariantType, VariantConfig, Meta } from '../src/lib/types/images';
import exifr from 'exifr';

type SharpModule = typeof import('sharp');
type SharpInstance = ReturnType<SharpModule>;
let sharp: SharpModule | null = null;

// -----------------------------
// Encoding constants (Fáze 4: magické hodnoty)
// -----------------------------

const ENCODING_CONSTANTS = {
  LQIP_QUALITY: 40,
  LQIP_CHROMA_SUBSAMPLING: '4:2:0' as const,
  AVIF_EFFORT: 5,
  WEBP_EFFORT: 4,
  JPEG_PROGRESSIVE: true,
  JPEG_MOZJPEG: false,
  ICC_PROFILE: 'srgb' as const,
} as const;

const VARIANT_CONFIGS: Record<VariantType, VariantConfig> = {
  'details': {
    folder: 'details',
    width: 1280,
    quality: { jpeg: 90, webp: 75, avif: 65 }
  },
  'previews': {
    folder: 'previews',
    width: 534,
    height: 300,
    crop: true,
    quality: { jpeg: 80, webp: 60, avif: 50 }
  },
  'previews-xl': {
    folder: 'previews-xl',
    width: 370,
    height: 208,
    crop: true,
    quality: { jpeg: 80, webp: 60, avif: 50 }
  },
  'previews-xxs': {
    folder: 'previews-xxs',
    width: 190,
    height: 107,
    crop: true,
    quality: { jpeg: 60, webp: 50, avif: 45 }
  }
};

type BlurFormats = Array<'png' | 'avif' | 'jpeg'>;

type Args = {
  src: string;
  out: string;
  manifest: string;
  variants: VariantType[]; // which variants to generate
  formats: Array<'avif' | 'webp' | 'jpeg'>; // all modern formats
  quality: Quality;
  allowUpscale: boolean;
  keepOriginal: boolean;
  gif: GifMode;
  concurrency: number | 'auto';
  watch: boolean;
  clean: boolean;
  fallback: 'none' | 'copy';
  verbose: boolean;
  quiet: boolean;
  lqipWidth: number;
  limit: number;

  // Blur assets (legacy parity) - standalone file generation (PNG-8/AVIF/JPEG)
  blurEnable: boolean;
  blurOnly: boolean;
  blurSrc: string;
  blurOut: string;
  blurWidth: number;
  blurColors: number;
  blurFormats: BlurFormats;
  blurPngCompression: number; // 0-9
  blurPngQuality: number; // 0-100 (palette quantization quality)
  blurAvifQuality: number; // 1-100
  blurJpegQuality: number; // 1-100
  blurClean: boolean;
};

const DEFAULTS: Args = {
  src: path.resolve(process.cwd(), 'content/israel-2022'),
  out: path.resolve(process.cwd(), 'static/images/israel-2022'),
  manifest: path.resolve(process.cwd(), 'src/lib/images.manifest.json'),
  variants: ['details', 'previews', 'previews-xl', 'previews-xxs'],
  formats: ['avif', 'webp', 'jpeg'],
  quality: { avif: 50, webp: 60, jpeg: 80 },
  allowUpscale: false,
  keepOriginal: false,
  gif: 'copy',
  concurrency: 4,
  watch: false,
  clean: false,
  fallback: 'none',
  verbose: false,
  quiet: false,
  lqipWidth: 24,
  limit: 0,

  // Defaults aligned with legacy gen-blured-images.sh behaviour
  blurEnable: false,
  blurOnly: false,
  // legacy previews-xl source and blurs destination live in parent repo's static/assets/...
  blurSrc: path.resolve(process.cwd(), '../static/assets/israel-2022/previews-xl'),
  blurOut: path.resolve(process.cwd(), '../static/assets/israel-2022/blurs'),
  blurWidth: 24,
  blurColors: 32,
  blurFormats: ['png'],
  blurPngCompression: 9,
  blurPngQuality: 50,
  blurAvifQuality: 50,
  blurJpegQuality: 40,
  blurClean: false,
};

function parseArgs(argv: string[]): Args {
  const out: Args = { ...DEFAULTS };
  for (const arg of argv) {
    if (!arg.startsWith('--')) continue;
    const [k, vRaw] = arg.slice(2).split('=');
    const v = vRaw ?? 'true';
    switch (k) {
      case 'src':
        out.src = path.resolve(process.cwd(), v);
        break;
      case 'out':
        out.out = path.resolve(process.cwd(), v);
        break;
      case 'manifest':
        out.manifest = path.resolve(process.cwd(), v);
        break;
      case 'variants':
        out.variants = v.split(',').map((x) => x.trim() as VariantType).filter((x) => ['details', 'previews', 'previews-xl', 'previews-xxs'].includes(x));
        break;
      case 'formats':
        out.formats = v.split(',').map((x) => x.trim().toLowerCase() as any).filter((x) => ['avif', 'webp', 'jpeg'].includes(x));
        break;
      case 'quality.avif':
        out.quality.avif = parseInt(v, 10);
        break;
      case 'quality.webp':
        out.quality.webp = parseInt(v, 10);
        break;
      case 'quality.jpeg':
        out.quality.jpeg = parseInt(v, 10);
        break;
      case 'allow-upscale':
        out.allowUpscale = v === 'true';
        break;
      case 'keep-original':
        out.keepOriginal = v === 'true';
        break;
      case 'gif':
        out.gif = (v as GifMode) ?? 'copy';
        break;
      case 'concurrency':
        out.concurrency = v === 'auto' ? 'auto' : Math.max(1, parseInt(v, 10) || 1);
        break;
      case 'watch':
        out.watch = v === 'true';
        break;
      case 'clean':
        out.clean = v === 'true';
        break;
      case 'fallback':
        out.fallback = (v as any) === 'copy' ? 'copy' : 'none';
        break;
      case 'verbose':
        out.verbose = v === 'true';
        break;
      case 'quiet':
        out.quiet = v === 'true';
        break;
      case 'lqipWidth':
        out.lqipWidth = parseInt(v, 10);
        break;
      case 'limit':
        out.limit = parseInt(v, 10);
        break;

      // --- Blur CLI group ---
      case 'blur.enable':
        out.blurEnable = v === 'true';
        break;
      case 'blur.only':
        out.blurOnly = v === 'true';
        break;
      case 'blur.src':
        out.blurSrc = path.resolve(process.cwd(), v);
        break;
      case 'blur.out':
        out.blurOut = path.resolve(process.cwd(), v);
        break;
      case 'blur.width':
        out.blurWidth = Math.max(1, parseInt(v, 10) || DEFAULTS.blurWidth);
        break;
      case 'blur.colors':
        out.blurColors = Math.max(2, parseInt(v, 10) || DEFAULTS.blurColors);
        break;
      case 'blur.formats':
        out.blurFormats = v.split(',').map((x) => x.trim().toLowerCase() as any).filter((x) => ['png', 'avif', 'jpeg'].includes(x));
        break;
      case 'blur.pngCompression':
        out.blurPngCompression = Math.max(0, Math.min(9, parseInt(v, 10) || DEFAULTS.blurPngCompression));
        break;
      case 'blur.pngQuality':
        out.blurPngQuality = Math.max(0, Math.min(100, parseInt(v, 10) || DEFAULTS.blurPngQuality));
        break;
      case 'blur.avifQuality':
        out.blurAvifQuality = Math.max(1, Math.min(100, parseInt(v, 10) || DEFAULTS.blurAvifQuality));
        break;
      case 'blur.jpegQuality':
        out.blurJpegQuality = Math.max(1, Math.min(100, parseInt(v, 10) || DEFAULTS.blurJpegQuality));
        break;
      case 'blur.clean':
        out.blurClean = v === 'true';
        break;

      default:
        // ignore unknown flags
        break;
    }
  }
  if (out.concurrency === 'auto') {
    const n = Math.max(1, (os.cpus()?.length || 2) - 1);
    out.concurrency = n;
  }
  return out;
}

const ARGS = parseArgs(process.argv.slice(2));

// -----------------------------
// Logging helpers
// -----------------------------

const log = {
  info: (...msg: any[]) => !ARGS.quiet && console.log(pc.cyan('[images]'), ...msg),
  warn: (...msg: any[]) => !ARGS.quiet && console.warn(pc.yellow('[images]'), ...msg),
  error: (...msg: any[]) => console.error(pc.red('[images]'), ...msg),
  verbose: (...msg: any[]) => ARGS.verbose && !ARGS.quiet && console.log(pc.dim('[images]'), ...msg)
};

// -----------------------------
// Types for manifest and cache
// -----------------------------

type Variant = {
  width: number;
  height: number;
  path: string; // public path e.g. /images/album/photo.w640.webp
  bytes: number;
};

type VariantsByFormat = {
  avif?: Variant[];
  webp?: Variant[];
  jpeg?: Variant[];
};

type Placeholder = {
  base64: string | null; // base64 without data: prefix
  width: number | null;
  height: number | null;
  type: string | null;
};

type ManifestEntry = {
  original: {
    width: number | null;
    height: number | null;
    format: string | null;
    bytes: number;
    path: string | null; // when keepOriginal or copy-only flows
  };
  variants: VariantsByFormat;
  placeholder: Placeholder | null;
  color: string | null; // hex #RRGGBB
  hash: string; // SHA-1 of original
  outputs: string[]; // public paths for cleaning
  meta?: Meta; // EXIF/IPTC metadata for grouping and captions
};

type Manifest = Record<string, ManifestEntry>;

type CacheFileEntry = {
  hash: string;
  width: number | null;
  height: number | null;
  format: string | null;
  mtimeMs: number;
  size: number;
  processedFormats: string[];
  outputs: string[];
};

type Cache = {
  version: number;
  configHash: string;
  files: Record<string, CacheFileEntry>;
};

const CACHE_VERSION = 2;

// -----------------------------
// Utilities
// -----------------------------

function toPosix(p: string) {
  return p.split(path.sep).join('/');
}

async function ensureDir(dir: string) {
  await fsp.mkdir(dir, { recursive: true });
}

function sha1(buf: Buffer | Uint8Array) {
  return crypto.createHash('sha1').update(buf).digest('hex');
}

function hexFromRGB(r: number, g: number, b: number) {
  const clamp = (x: number) => Math.max(0, Math.min(255, Math.round(x)));
  return '#' + [clamp(r), clamp(g), clamp(b)].map((n) => n.toString(16).padStart(2, '0')).join('');
}

function parseExtLower(p: string) {
  return path.extname(p).toLowerCase().replace('.', '');
}

const INPUT_EXTS = ['jpg', 'jpeg', 'png', 'webp', 'avif', 'tiff', 'tif', 'gif', 'svg'];

function normalizeFormat(format: string | null | undefined): string | null {
  if (!format) return null;
  const f = format.toLowerCase();
  if (f === 'jpg') return 'jpeg';
  if (f === 'tif') return 'tiff';
  if (f === 'svg+xml') return 'svg';
  return f;
}


function getProjectStaticRoot(): string {
  // static is at <project>/static
  return path.resolve(process.cwd(), 'static');
}

function publicPathFromOutAbs(outAbs: string): string {
  const staticRoot = getProjectStaticRoot();
  const rel = path.relative(staticRoot, outAbs);
  return '/' + toPosix(rel);
}

async function computeFileHash(absPath: string): Promise<string> {
  const hash = crypto.createHash('sha1');
  const stream = fs.createReadStream(absPath);
  return new Promise((resolve, reject) => {
    stream.on('data', (chunk) => hash.update(chunk));
    stream.on('end', () => resolve(hash.digest('hex')));
    stream.on('error', reject);
  });
}

async function fileBytes(absPath: string): Promise<number> {
  const st = await fsp.stat(absPath);
  return st.size;
}

async function loadJSON<T>(file: string, fallback: T): Promise<T> {
  try {
    const text = await fsp.readFile(file, 'utf8');
    return JSON.parse(text) as T;
  } catch {
    return fallback;
  }
}

async function saveJSON(file: string, data: any) {
  await ensureDir(path.dirname(file));
  const text = JSON.stringify(data, null, 2);
  await fsp.writeFile(file, text + '\n', 'utf8');
}

function isInsideDir(child: string, parent: string): boolean {
  const rel = path.relative(parent, child);
  return !!rel && !rel.startsWith('..') && !path.isAbsolute(rel);
}

// -----------------------------
// Config hash (affects outputs)
// -----------------------------

function computeConfigHash() {
  const data = {
    variants: ARGS.variants,
    quality: ARGS.quality,
    allowUpscale: ARGS.allowUpscale,
    keepOriginal: ARGS.keepOriginal,
    gif: ARGS.gif,
    lqipWidth: ARGS.lqipWidth,
    progressiveJpeg: true,
    icc: 'srgb',
    srcRoot: path.resolve(ARGS.src),
    outRoot: path.resolve(ARGS.out),
    manifestPath: path.resolve(ARGS.manifest)
  };
  return sha1(Buffer.from(JSON.stringify(data)));
}

// -----------------------------
// Sharp loading / fallback policy
// -----------------------------

async function loadSharpOrExplain(): Promise<void> {
  if (ARGS.fallback === 'copy') {
    sharp = null;
    log.warn('Fallback copy mode enabled (--fallback=copy). No image transforms will be performed.');
    return;
  }
  try {
    const mod = await import('sharp');
    sharp = mod.default ?? (mod as any);
  } catch (err) {
    sharp = null;
    const msg = [
      'Knihovna "sharp" není dostupná nebo nelze načíst libvips.',
      'Instalace:',
      '- bun add sharp',
      '- macOS (Homebrew): brew install vips',
      '- Ubuntu/Debian: sudo apt-get update && sudo apt-get install -y libvips',
      'Alternativa: spusťte s --fallback=copy pro prosté kopírování bez transformace.'
    ].join('\n');
    log.error(msg);
    process.exitCode = 1;
  }
}

// -----------------------------
// GIF animation detection
// -----------------------------

async function isAnimatedGif(absPath: string): Promise<boolean> {
  if (!sharp) return true; // conservative: if we can't detect, treat as animated to avoid incorrect conversion
  try {
    const meta = await sharp(absPath).metadata();
    if (typeof meta.pages === 'number' && meta.pages > 1) return true;
    // Some GIFs report pageCount
    if ((meta as any).pageCount && (meta as any).pageCount > 1) return true;
    return false;
  } catch {
    return true;
  }
}

// -----------------------------
// Image processing core
// -----------------------------

type ProcessContext = {
  repoRoot: string;
  staticRoot: string;
  srcRoot: string;
  outRoot: string;
  manifestPath: string;
  configHash: string;
};

const CTX: ProcessContext = {
  repoRoot: path.resolve(process.cwd(), '..'),
  staticRoot: getProjectStaticRoot(),
  srcRoot: path.resolve(ARGS.src),
  outRoot: path.resolve(ARGS.out),
  manifestPath: path.resolve(ARGS.manifest),
  configHash: computeConfigHash()
};

function relKeyFromAbs(abs: string): string {
  return path.relative(CTX.repoRoot, abs).replace(/\\/g, '/');
}

// Or when we need relative to src root:
function relFromSrcRoot(abs: string): string {
  return toPosix(path.relative(CTX.srcRoot, abs)); // e.g. "album/photo.jpg"
}

function baseNameNoExt(file: string): string {
  const ext = path.extname(file);
  return path.basename(file, ext);
}

async function readMetadata(absPath: string): Promise<{ width: number | null; height: number | null; format: string | null; orientation?: number | null }> {
  if (!sharp) return { width: null, height: null, format: normalizeFormat(parseExtLower(absPath)), orientation: null };
  try {
    const meta = await sharp(absPath).metadata();
    return {
      width: meta.width ?? null,
      height: meta.height ?? null,
      format: normalizeFormat(meta.format),
      orientation: meta.orientation ?? null
    };
  } catch {
    return { width: null, height: null, format: normalizeFormat(parseExtLower(absPath)), orientation: null };
  }
}

function orientedDims(width: number | null, height: number | null, orientation: number | null | undefined) {
  if (!width || !height) return { width, height };
  if (orientation === 6 || orientation === 8) {
    return { width: height, height: width };
  }
  return { width, height };
}

async function generatePlaceholder(absPath: string, widthTarget: number): Promise<Placeholder> {
  if (!sharp) return { base64: null, width: null, height: null, type: null };
  try {
    const img = sharp(absPath).rotate();
    const meta = await img.metadata();
    const { width, height } = orientedDims(meta.width ?? null, meta.height ?? null, meta.orientation ?? null);
    const resized = img
      .resize({ width: widthTarget, withoutEnlargement: true, fit: 'inside' })
      .withMetadata({ icc: ENCODING_CONSTANTS.ICC_PROFILE })
      .jpeg({
        quality: ENCODING_CONSTANTS.LQIP_QUALITY,
        chromaSubsampling: ENCODING_CONSTANTS.LQIP_CHROMA_SUBSAMPLING,
        progressive: ENCODING_CONSTANTS.JPEG_PROGRESSIVE
      });
    const buf = await resized.toBuffer();
    return {
      base64: buf.toString('base64'),
      width: Math.min(widthTarget, (width ?? widthTarget)),
      height: null,
      type: 'image/jpeg'
    };
  } catch {
    return { base64: null, width: null, height: null, type: null };
  }
}

async function dominantColorHex(absPath: string): Promise<string | null> {
  if (!sharp) return null;
  try {
    const stats = await sharp(absPath).rotate().stats();
    const dom = stats?.dominant;
    if (!dom) return null;
    return hexFromRGB(dom.r, dom.g, dom.b);
  } catch {
    return null;
  }
}


// Helper: Apply format-specific encoding to Sharp instance (DRY + constants)
function applyFormat(
  img: SharpInstance,
  format: 'avif' | 'webp' | 'jpeg',
  quality: number
): SharpInstance {
  switch (format) {
    case 'avif':
      return img.avif({
        quality,
        effort: ENCODING_CONSTANTS.AVIF_EFFORT,
        chromaSubsampling: ENCODING_CONSTANTS.LQIP_CHROMA_SUBSAMPLING
      });
    case 'webp':
      return img.webp({ quality, effort: ENCODING_CONSTANTS.WEBP_EFFORT });
    case 'jpeg':
      return img.jpeg({
        quality,
        chromaSubsampling: ENCODING_CONSTANTS.LQIP_CHROMA_SUBSAMPLING,
        progressive: ENCODING_CONSTANTS.JPEG_PROGRESSIVE,
        mozjpeg: ENCODING_CONSTANTS.JPEG_MOZJPEG
      });
  }
}

async function transformVariant(
  imgOrSrc: SharpInstance | string,
  outRootAbs: string,
  baseName: string,
  variantType: VariantType,
  format: 'avif' | 'webp' | 'jpeg'
): Promise<{ bytes: number; publicPath: string; width: number; height: number }> {
  if (!sharp) throw new Error('Sharp not loaded');

  const config = VARIANT_CONFIGS[variantType];
  const folderSuffix = format === 'jpeg' ? '' : `-${format}`;
  const outFolder = path.join(outRootAbs, `${config.folder}${folderSuffix}`);
  await ensureDir(outFolder);

  const ext = format === 'jpeg' ? 'jpg' : format;
  const outFile = path.join(outFolder, `${baseName}.${ext}`);

  const img = typeof imgOrSrc === 'string' ? sharp(imgOrSrc).rotate().withMetadata({ icc: ENCODING_CONSTANTS.ICC_PROFILE }) : imgOrSrc;

  // Apply resize based on config
  if (config.crop && config.height) {
    // Crop mode for previews
    img.resize({
      width: config.width,
      height: config.height,
      fit: 'cover',
      position: 'centre'
    });
  } else if (config.width) {
    // Fit mode for details
    img.resize({
      width: config.width,
      fit: 'inside',
      withoutEnlargement: !ARGS.allowUpscale
    });
  }

  // Apply format and quality using helper
  const quality = format === 'avif' ? config.quality.avif : format === 'webp' ? config.quality.webp : config.quality.jpeg;
  applyFormat(img, format, quality);

  // Use toFile() return value to get output info
  const info = await img.toFile(outFile);
  const outW = info.width;
  const outH = info.height;
  const bytes = info.size;

  return { bytes, publicPath: publicPathFromOutAbs(outFile), width: outW, height: outH };
}


// -----------------------------
// Cache handling
// -----------------------------

const CACHE_PATH = path.resolve(process.cwd(), '.images-cache.json');

async function loadCache(): Promise<Cache> {
  return loadJSON<Cache>(CACHE_PATH, { version: CACHE_VERSION, configHash: CTX.configHash, files: {} });
}

async function saveCache(cache: Cache): Promise<void> {
  await saveJSON(CACHE_PATH, cache);
}

// -----------------------------
// Processing per file
// -----------------------------

async function processSourceFile(absSrc: string, cache: Cache): Promise<{ key: string; entry: ManifestEntry | null; changed: boolean; error?: string }> {
  const startTime = performance.now();
  const key = relKeyFromAbs(absSrc); // e.g. "content/images/album/photo.jpg"
  log.verbose('Starting processing:', key);
  const relWithinSrc = relFromSrcRoot(absSrc); // e.g. "album/photo.jpg"
  const outDirAbs = path.join(CTX.outRoot, path.dirname(relWithinSrc));
  const staticRelDir = toPosix(path.relative(CTX.staticRoot, outDirAbs)); // "images/album"
  const base = baseNameNoExt(absSrc);
  const ext = parseExtLower(absSrc);
  const extNorm = normalizeFormat(ext) || ext;

  try {
    const st = await fsp.stat(absSrc);
    if (!st.isFile()) return { key, entry: null, changed: false };

    // Fast check: can we skip based on expected outputs?
    const isSvg = extNorm === 'svg';
    const isGif = extNorm === 'gif';
    const copyOnly = ARGS.fallback === 'copy' || isSvg || (isGif && ARGS.gif === 'copy');

    if (!copyOnly && sharp) {
      // Build list of expected output files for current CLI args (Gulp structure)
      const expectedOutputs: string[] = [];

      for (const variant of ARGS.variants) {
        const config = VARIANT_CONFIGS[variant];
        for (const fmt of ARGS.formats) {
          const folderSuffix = fmt === 'jpeg' ? '' : `-${fmt}`;
          const folder = `${config.folder}${folderSuffix}`;
          const ext = fmt === 'jpeg' ? 'jpg' : fmt;
          const outFile = path.join(CTX.outRoot, folder, `${base}.${ext}`);
          expectedOutputs.push(outFile);
        }
      }

      if (expectedOutputs.length > 0) {
        // Check if all expected outputs exist (fast: only stat, no reading)
        const existenceChecks = await Promise.all(expectedOutputs.map(async (outFile) => {
          try {
            const s = await fsp.stat(outFile);
            return s.isFile();
          } catch {
            return false;
          }
        }));

        const allExist = existenceChecks.every(Boolean);

        if (allExist) {
          // Additionally verify hash hasn't changed
          const hash = await computeFileHash(absSrc);
          const prev = cache.files[key];

          if (prev && prev.hash === hash) {
            log.verbose('Skip unchanged:', key);
            return { key, entry: null, changed: false };
          } else if (!prev || prev.hash !== hash) {
            // Outputs exist but no cache entry or hash changed - update cache without regenerating
            const st = await fsp.stat(absSrc);
            const meta = await readMetadata(absSrc);
            cache.files[key] = {
              hash,
              width: meta.width ?? null,
              height: meta.height ?? null,
              format: meta.format,
              mtimeMs: st.mtimeMs,
              size: st.size,
              processedFormats: ARGS.formats,
              outputs: expectedOutputs.map(f => publicPathFromOutAbs(f))
            };
            log.verbose('Skip (cache update):', key);
            return { key, entry: null, changed: false };
          }
        }
      }
    }

    // If we get here, need to process
    log.verbose(`File size: ${st.size} bytes for ${key}`);
    const hash = await computeFileHash(absSrc);
    const meta2 = await readMetadata(absSrc);
    const { width: oW2, height: oH2 } = orientedDims(meta2.width, meta2.height, (meta2 as any).orientation ?? null);

    // --- EXIF/IPTC extrakce pro manifest.meta ---
    let exif: any = null;
    try {
      exif = await exifr.parse(absSrc, { tiff: false, xmp: true, exif: true, iptc: true });
    } catch {
      // ignore EXIF failures
    }
    const dateIso =
      exif?.CreateDate instanceof Date
        ? exif.CreateDate.toISOString()
        : exif?.DateTimeOriginal instanceof Date
          ? exif.DateTimeOriginal.toISOString()
          : null;
    const groupBy = dateIso ? dateIso.substring(0, 10) : null;
    const where = exif?.Headline || exif?.Location || exif?.Sublocation || '';
    const city = exif?.City || '';
    const country = exif?.Country || '';
    const keywordsRaw = (exif?.Keywords ?? null) as string[] | string | null;
    const keywords = Array.isArray(keywordsRaw)
      ? keywordsRaw
      : typeof keywordsRaw === 'string'
        ? keywordsRaw.split(/[,;]\s*/).filter(Boolean)
        : null;
    const objectName = exif?.Headline || '';
    const caption = exif?.Caption || exif?.ImageDescription || '';
    let typeHint: string | null = null;
    if (base.includes('.pano')) {
      typeHint = 'pano';
    } else if (oW2 && oH2) {
      typeHint = oW2 > oH2 ? 'landscape' : oW2 < oH2 ? 'portrait' : null;
    }
    const metaObj = {
      date: dateIso,
      groupBy,
      city,
      where,
      country,
      keywords,
      objectName,
      caption,
      type: typeHint,
    };

    const outputsList: string[] = [];

    // Decide processing mode
    log.verbose('Generating variants for:', key);
    const animatedGif = isGif ? await isAnimatedGif(absSrc) : false;

    const copyOnlyFinal = copyOnly || (isGif && animatedGif);

    let variants: VariantsByFormat = {};
    let placeholder: Placeholder | null = null;
    let color: string | null = null;
    let originalPublicPath: string | null = null;
    let originalBytes = st.size;

    if (copyOnlyFinal || !sharp) {
      // Mirror copy to out keeping original name
      const dest = path.join(outDirAbs, path.basename(absSrc));
      await ensureDir(path.dirname(dest));
      await fsp.copyFile(absSrc, dest);
      originalBytes = await fileBytes(dest);
      originalPublicPath = publicPathFromOutAbs(dest);
      placeholder = { base64: null, width: null, height: null, type: null };
      color = null;
      variants = {}; // none
      outputsList.push(originalPublicPath);
    } else {
      // With sharp transforms - generate Gulp-style variants
      const tasks: Array<Promise<void>> = [];

      // Load image once
      const baseImg = sharp(absSrc).rotate().withMetadata({ icc: ENCODING_CONSTANTS.ICC_PROFILE });

      // placeholder + color
      const phPromise = generatePlaceholder(absSrc, ARGS.lqipWidth).then((ph) => { placeholder = ph; });
      const colorPromise = dominantColorHex(absSrc).then((c) => { color = c; });
      tasks.push(phPromise, colorPromise);

      // variants by type and format
      variants = {};
      for (const variant of ARGS.variants) {
        for (const fmt of ARGS.formats) {
          if (!variants[fmt]) variants[fmt] = [];
          const list = variants[fmt] as Variant[];

          tasks.push(
            (async () => {
              const { bytes, publicPath, width: outW, height: outH } = await transformVariant(baseImg.clone(), CTX.outRoot, base, variant, fmt);
              list.push({ width: outW, height: outH, path: publicPath, bytes });
              outputsList.push(publicPath);
            })()
          );
        }
      }

      // keep original (optional)
      if (ARGS.keepOriginal) {
        const dest = path.join(outDirAbs, path.basename(absSrc));
        await ensureDir(path.dirname(dest));
        await fsp.copyFile(absSrc, dest);
        originalBytes = await fileBytes(dest);
        originalPublicPath = publicPathFromOutAbs(dest);
        outputsList.push(originalPublicPath);
      } else {
        originalPublicPath = null;
      }

      // Execute with concurrency limit
      await runWithConcurrency(tasks, ARGS.concurrency as number);

      // Sort variants deterministically
      for (const fmt of Object.keys(variants) as Array<keyof VariantsByFormat>) {
        (variants[fmt] as Variant[]).sort((a, b) => a.width - b.width);
      }
    }

    const entry: ManifestEntry = {
      original: {
        width: oW2,
        height: oH2,
        format: meta2.format,
        bytes: originalBytes,
        path: originalPublicPath
      },
      variants,
      placeholder: placeholder,
      color,
      hash,
      outputs: outputsList.sort(),
      meta: metaObj,
    };

    // Update cache
    cache.files[key] = {
      hash,
      width: oW2,
      height: oH2,
      format: meta2.format,
      mtimeMs: st.mtimeMs,
      size: st.size,
      processedFormats: Object.keys(variants),
      outputs: outputsList
    };

    log.verbose(`Processed ${key} in ${(performance.now() - startTime).toFixed(2)}ms`);
    log.verbose('Finished processing:', key);
    return { key, entry, changed: true };
  } catch (err: any) {
    log.verbose(`Failed ${key} in ${(performance.now() - startTime).toFixed(2)}ms`);
    log.warn('Chyba při zpracování:', key, '-', err?.message || String(err));
    return { key, entry: null, changed: false, error: err?.message || String(err) };
  }
}

// -----------------------------
// Concurrency helper
// -----------------------------

async function runWithConcurrency<T>(promises: Promise<T>[], concurrency: number): Promise<T[]> {
  const results: T[] = [];
  let index = 0;
  let active = 0;
  return new Promise((resolve, reject) => {
    const next = () => {
      if (index >= promises.length && active === 0) {
        resolve(results);
        return;
      }
      while (active < concurrency && index < promises.length) {
        const i = index++;
        active++;
        promises[i]
          .then((res) => {
            results[i] = res;
          })
          .catch((e) => reject(e))
          .finally(() => {
            active--;
            next();
          });
      }
    };
    next();
  });
}

// -----------------------------
// Discovery and build
// -----------------------------

async function discoverSources(): Promise<string[]> {
  const patterns = INPUT_EXTS.map((e) => `**/*.${e}`);
  const entries = await fg(patterns, { cwd: CTX.srcRoot, dot: false, absolute: true, caseSensitiveMatch: false, followSymbolicLinks: true });
  entries.sort();
  return entries;
}

async function buildAll(): Promise<{ manifest: Manifest; errors: number }> {
  const cache = await loadCache();
  const sources = await discoverSources();
  const originalCount = sources.length;
  const limitedSources = ARGS.limit > 0 ? sources.slice(0, ARGS.limit) : sources;
  log.info(`Nalezeno zdrojů: ${limitedSources.length}${ARGS.limit > 0 ? ` (limit ${ARGS.limit} z ${originalCount})` : ''} (${toPosix(path.relative(process.cwd(), CTX.srcRoot))})`);

  const manifest: Manifest = await loadJSON<Manifest>(CTX.manifestPath, {});
  let errors = 0;
  let processed = 0;

  const bar = ARGS.quiet ? null : new SingleBar({
    format: 'Zpracováno [{bar}] {percentage}% | {value}/{total} | ETA: {eta}s',
    barCompleteChar: '\u2588',
    barIncompleteChar: '\u2591',
    hideCursor: true
  });

  if (bar) bar.start(limitedSources.length, 0);

  const tasks: Array<Promise<void>> = [];
  for (const abs of limitedSources) {
    tasks.push((async () => {
      const res = await processSourceFile(abs, cache);
      processed++;
      if (bar) {
        bar.update(processed);
        bar.render();
      }
      if (res.entry) {
        manifest[res.key] = res.entry;
        log.verbose('Zapsán do manifestu:', res.key);
      } else if (res.changed === false && !res.error) {
        // unchanged: do nothing (keep existing manifest entry)
      } else if (res.error) {
        errors++;
      }
    })());
  }

  await runWithConcurrency(tasks, ARGS.concurrency as number);

  if (bar) bar.stop();

  if (!ARGS.quiet) {
    process.stdout.write('\n');
  }

  if (!ARGS.quiet) {
    log.info(`Zpracováno: ${processed}/${sources.length}`);
  }

  // Sort manifest keys deterministically
  const ordered: Manifest = {};
  Object.keys(manifest).sort().forEach((k) => { ordered[k] = manifest[k]; });

  await ensureDir(path.dirname(CTX.manifestPath));
  await saveJSON(CTX.manifestPath, ordered);

  // Save cache with current config hash
  cache.version = CACHE_VERSION;
  cache.configHash = CTX.configHash;
  await saveCache(cache);

  return { manifest: ordered, errors };
}

// -----------------------------
// Clean orphaned outputs
// -----------------------------

async function cleanOrphans(manifest: Manifest): Promise<{ removed: number }> {
  const allowedExts = new Set(['.avif', '.webp', '.jpeg', '.jpg', '.png', '.gif', '.svg', '.tiff', '.tif']);
  const keepSet = new Set<string>();
  for (const entry of Object.values(manifest)) {
    for (const p of entry.outputs) keepSet.add(p);
  }

  // List all files under outRoot
  const all = await fg(['**/*'], { cwd: CTX.outRoot, absolute: true, dot: false, onlyFiles: true, followSymbolicLinks: true });
  let removed = 0;
  for (const abs of all) {
    const ext = path.extname(abs).toLowerCase();
    if (!allowedExts.has(ext)) continue;

    // Only remove files that map to some public path under /images
    const pub = publicPathFromOutAbs(abs);
    if (!keepSet.has(pub)) {
      // safety: ensure it's inside outRoot
      if (!isInsideDir(abs, CTX.outRoot)) continue;
      await fsp.unlink(abs);
      removed++;
      log.verbose('Removed orphan:', pub);
    }
  }
  if (removed > 0) {
    log.info(`Clean: odstraněno ${removed} sirotků`);
  } else {
    log.info('Clean: žádné sirotky nenalezeny');
  }
  return { removed };
}

// -----------------------------
// Blur assets (legacy parity) generator
// -----------------------------

async function discoverBlurSources(srcDir: string): Promise<string[]> {
  // Allow nested structure, common photo extensions used by legacy step
  const patterns = ['**/*.jpg', '**/*.jpeg', '**/*.png'];
  const entries = await fg(patterns, { cwd: srcDir, dot: false, absolute: true, onlyFiles: true, followSymbolicLinks: true });
  entries.sort();
  return entries;
}


async function cleanBlurOutDir(outDir: string) {
  const all = await fg(['**/*'], { cwd: outDir, absolute: true, onlyFiles: true, followSymbolicLinks: true });
  let removed = 0;
  for (const abs of all) {
    if (!isInsideDir(abs, outDir)) continue;
    await fsp.unlink(abs).catch(() => { });
    removed++;
  }
  if (removed > 0) {
    log.info(`Clean blur: odstraněno ${removed} souborů z ${toPosix(path.relative(process.cwd(), outDir))}`);
  }
}

async function generateBlurAssets(): Promise<{ processed: number; outputs: number; errors: number }> {
  if (!sharp) {
    log.error('Blur generování vyžaduje knihovnu "sharp". Spusťte instalaci nebo použijte --fallback=copy (bez efektu blur).');
    return { processed: 0, outputs: 0, errors: 1 };
  }

  const srcDir = ARGS.blurSrc;
  const outDir = ARGS.blurOut;

  await ensureDir(outDir);

  if (ARGS.blurClean) {
    await cleanBlurOutDir(outDir);
  }

  const sources = await discoverBlurSources(srcDir);
  const originalCount = sources.length;
  const limited = ARGS.limit > 0 ? sources.slice(0, ARGS.limit) : sources;

  log.info(`Blur: nalezeno zdrojů: ${limited.length}${ARGS.limit > 0 ? ` (limit ${ARGS.limit} z ${originalCount})` : ''} (${toPosix(path.relative(process.cwd(), srcDir))})`);
  log.verbose('Blur formáty:', ARGS.blurFormats.join(', '), '| width =', ARGS.blurWidth, '| colors =', ARGS.blurColors);

  const bar = ARGS.quiet ? null : new SingleBar({
    format: 'Blur [{bar}] {percentage}% | {value}/{total} | ETA: {eta}s',
    barCompleteChar: '\u2588',
    barIncompleteChar: '\u2591',
    hideCursor: true
  });
  if (bar) bar.start(limited.length, 0);

  let processed = 0;
  let outputs = 0;
  let errors = 0;

  const tasks: Array<Promise<void>> = [];

  for (const abs of limited) {
    tasks.push((async () => {
      try {
        const base = path.basename(abs, path.extname(abs));
        // Prepare target file names per format
        const targets: Array<{ fmt: 'png' | 'avif' | 'jpeg'; outFile: string }> = [];

        for (const fmt of ARGS.blurFormats) {
          let outFile = path.join(outDir, `${base}.${fmt === 'jpeg' ? 'jpg' : fmt}`);
          targets.push({ fmt: fmt as any, outFile });
        }

        // Process once and fork by format using clone()
        const img = sharp!(abs).rotate().resize({
          width: ARGS.blurWidth,
          fit: 'inside',
          withoutEnlargement: true
          // kernel default is Lanczos3 which aligns with legacy '-filter Lanczos'
        });

        for (const t of targets) {
          const dir = path.dirname(t.outFile);
          await ensureDir(dir);

          const clone = img.clone();
          if (t.fmt === 'png') {
            clone.png({
              palette: true,
              colors: ARGS.blurColors,
              quality: ARGS.blurPngQuality,
              compressionLevel: ARGS.blurPngCompression,
              effort: 4
            });
          } else if (t.fmt === 'avif') {
            clone.avif({
              quality: ARGS.blurAvifQuality,
              effort: 5,
              chromaSubsampling: '4:2:0'
            });
          } else {
            clone.jpeg({
              quality: ARGS.blurJpegQuality,
              chromaSubsampling: '4:2:0',
              progressive: true,
              mozjpeg: false
            });
          }

          await clone.toFile(t.outFile);
          outputs++;
        }

      } catch (e: any) {
        errors++;
        log.warn('Blur chyba:', e?.message || String(e));
      } finally {
        processed++;
        if (bar) {
          bar.update(processed);
          bar.render();
        }
      }
    })());
  }

  await runWithConcurrency(tasks, ARGS.concurrency as number);
  if (bar) bar.stop();
  if (!ARGS.quiet) process.stdout.write('\n');

  if (errors > 0) {
    log.warn(`Blur dokončeno s chybami: ${errors} položek`);
  } else {
    log.info(`Blur dokončeno. Vstupy: ${processed}, výstupy: ${outputs}`);
  }

  return { processed, outputs, errors };
}

// -----------------------------
// Watch mode
// -----------------------------

async function handleFileEvent(fileAbs: string, type: 'create' | 'update' | 'delete') {
  const cache = await loadCache();
  const manifest = await loadJSON<Manifest>(CTX.manifestPath, {});
  const key = relKeyFromAbs(fileAbs);

  if (type === 'delete') {
    const prev = manifest[key];
    if (prev) {
      // remove outputs
      for (const p of prev.outputs) {
        const abs = path.join(CTX.staticRoot, p.replace(/^\//, ''));
        try {
          await fsp.unlink(abs);
        } catch { }
      }
      delete manifest[key];
      delete cache.files[key];
      await saveJSON(CTX.manifestPath, Object.fromEntries(Object.entries(manifest).sort(([a], [b]) => a.localeCompare(b))));
      await saveCache(cache);
      log.info('Smazán z manifestu (delete):', key);
    }
    return;
  }

  const res = await processSourceFile(fileAbs, cache);
  if (res.entry) {
    manifest[key] = res.entry;
    await saveJSON(CTX.manifestPath, Object.fromEntries(Object.entries(manifest).sort(([a], [b]) => a.localeCompare(b))));
    await saveCache(cache);
    log.info(`${type === 'create' ? 'Vytvořeno' : 'Aktualizováno'}:`, key);
  } else if (res.error) {
    log.warn('Chyba ve watch běhu:', res.error);
  }
}

// -----------------------------
// Main
// -----------------------------

async function main() {
  // Validate dirs for main pipeline
  await ensureDir(CTX.outRoot);
  await ensureDir(path.dirname(CTX.manifestPath));

  // Load sharp or setup fallback (needed for both main and blur)
  await loadSharpOrExplain();
  if (process.exitCode === 1 && ARGS.fallback !== 'copy') {
    // sharp missing and no fallback -> terminate
    process.exit(1);
    return;
  }

  // Standalone BLUR mode (no main build)
  if (ARGS.blurEnable && ARGS.blurOnly) {
    const { errors } = await generateBlurAssets();
    if (errors > 0) {
      process.exit(1);
    }
    return;
  }

  if (ARGS.watch) {
    log.info('Watch mód: sleduji', toPosix(CTX.srcRoot));
    // initial build
    const { manifest, errors } = await buildAll();
    if (ARGS.clean) await cleanOrphans(manifest);
    if (errors > 0) {
      log.warn(`Dokončeno s chybami: ${errors} položek`);
    } else {
      log.info('Dokončeno');
    }

    // @ts-ignore
    const watcher = Bun.watch(CTX.srcRoot, {
      ignore: [/\.DS_Store$/],
      recursive: true,
      onAll: async (event: 'create' | 'update' | 'delete' | 'rename', file: string) => {
        try {
          const abs = path.resolve(file);
          if (!INPUT_EXTS.includes(parseExtLower(abs))) return;
          if (event === 'create') await handleFileEvent(abs, 'create');
          else if (event === 'update') await handleFileEvent(abs, 'update');
          else if (event === 'delete') await handleFileEvent(abs, 'delete');
        } catch (e: any) {
          log.warn('Watch error:', e?.message || String(e));
        }
      }
    });

    // Keep process alive
    await new Promise<void>(() => { });
    watcher.stop();
  } else {
    const { manifest, errors } = await buildAll();
    if (ARGS.clean) await cleanOrphans(manifest);

    // Optional blur pass after main build
    if (ARGS.blurEnable) {
      const blurRes = await generateBlurAssets();
      if (errors === 0 && blurRes.errors === 0) {
        log.info('Dokončeno bez chyb (včetně blur).');
      } else {
        log.error(`Dokončeno s chybami: main=${errors}, blur=${blurRes.errors}`);
        process.exit(1);
      }
    } else {
      if (errors > 0) {
        log.error(`Dokončeno s chybami: ${errors} položek`);
        process.exit(1);
      } else {
        log.info('Dokončeno bez chyb.');
      }
    }
  }
}

main().catch((e) => {
  log.error('Neočekávaná chyba:', e?.stack || e?.message || String(e));
  process.exit(1);
});
