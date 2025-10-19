/**
 * CLI argument parsing with map-based approach for better maintainability.
 * Refactored from monolithic switch statement to handler map (OCP principle).
 */

import path from 'node:path';
import os from 'node:os';
import type { Quality, GifMode, VariantType } from '../../src/lib/types/images';

type BlurFormats = Array<'png' | 'avif' | 'jpeg'>;

export type Args = {
  // Main pipeline
  src: string;
  out: string;
  manifest: string;
  variants: VariantType[];
  formats: Array<'avif' | 'webp' | 'jpeg'>;
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

  // Blur assets
  blurEnable: boolean;
  blurOnly: boolean;
  blurSrc: string;
  blurOut: string;
  blurWidth: number;
  blurColors: number;
  blurFormats: BlurFormats;
  blurPngCompression: number;
  blurPngQuality: number;
  blurAvifQuality: number;
  blurJpegQuality: number;
  blurClean: boolean;
};

export const DEFAULTS: Args = {
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

  blurEnable: false,
  blurOnly: false,
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

type ArgHandler = (value: string, args: Args) => void;

const ARG_HANDLERS: Record<string, ArgHandler> = {
  'src': (v, a) => { a.src = path.resolve(process.cwd(), v); },
  'out': (v, a) => { a.out = path.resolve(process.cwd(), v); },
  'manifest': (v, a) => { a.manifest = path.resolve(process.cwd(), v); },
  'variants': (v, a) => {
    a.variants = v.split(',')
      .map(x => x.trim() as VariantType)
      .filter(x => ['details', 'previews', 'previews-xl', 'previews-xxs'].includes(x));
  },
  'formats': (v, a) => {
    a.formats = v.split(',')
      .map(x => x.trim().toLowerCase() as any)
      .filter(x => ['avif', 'webp', 'jpeg'].includes(x));
  },
  'quality.avif': (v, a) => { a.quality.avif = parseInt(v, 10); },
  'quality.webp': (v, a) => { a.quality.webp = parseInt(v, 10); },
  'quality.jpeg': (v, a) => { a.quality.jpeg = parseInt(v, 10); },
  'allow-upscale': (v, a) => { a.allowUpscale = v === 'true'; },
  'keep-original': (v, a) => { a.keepOriginal = v === 'true'; },
  'gif': (v, a) => { a.gif = (v as GifMode) ?? 'copy'; },
  'concurrency': (v, a) => { a.concurrency = v === 'auto' ? 'auto' : Math.max(1, parseInt(v, 10) || 1); },
  'watch': (v, a) => { a.watch = v === 'true'; },
  'clean': (v, a) => { a.clean = v === 'true'; },
  'fallback': (v, a) => { a.fallback = v === 'copy' ? 'copy' : 'none'; },
  'verbose': (v, a) => { a.verbose = v === 'true'; },
  'quiet': (v, a) => { a.quiet = v === 'true'; },
  'lqipWidth': (v, a) => { a.lqipWidth = parseInt(v, 10); },
  'limit': (v, a) => { a.limit = parseInt(v, 10); },

  // Blur group
  'blur.enable': (v, a) => { a.blurEnable = v === 'true'; },
  'blur.only': (v, a) => { a.blurOnly = v === 'true'; },
  'blur.src': (v, a) => { a.blurSrc = path.resolve(process.cwd(), v); },
  'blur.out': (v, a) => { a.blurOut = path.resolve(process.cwd(), v); },
  'blur.width': (v, a) => { a.blurWidth = Math.max(1, parseInt(v, 10) || DEFAULTS.blurWidth); },
  'blur.colors': (v, a) => { a.blurColors = Math.max(2, parseInt(v, 10) || DEFAULTS.blurColors); },
  'blur.formats': (v, a) => {
    a.blurFormats = v.split(',')
      .map(x => x.trim().toLowerCase() as any)
      .filter(x => ['png', 'avif', 'jpeg'].includes(x));
  },
  'blur.pngCompression': (v, a) => { a.blurPngCompression = Math.max(0, Math.min(9, parseInt(v, 10) || DEFAULTS.blurPngCompression)); },
  'blur.pngQuality': (v, a) => { a.blurPngQuality = Math.max(0, Math.min(100, parseInt(v, 10) || DEFAULTS.blurPngQuality)); },
  'blur.avifQuality': (v, a) => { a.blurAvifQuality = Math.max(1, Math.min(100, parseInt(v, 10) || DEFAULTS.blurAvifQuality)); },
  'blur.jpegQuality': (v, a) => { a.blurJpegQuality = Math.max(1, Math.min(100, parseInt(v, 10) || DEFAULTS.blurJpegQuality)); },
  'blur.clean': (v, a) => { a.blurClean = v === 'true'; },
};

export function parseArgs(argv: string[]): Args {
  const out: Args = { ...DEFAULTS };

  for (const arg of argv) {
    if (!arg.startsWith('--')) continue;
    const [k, vRaw] = arg.slice(2).split('=');
    const v = vRaw ?? 'true';

    const handler = ARG_HANDLERS[k];
    if (handler) {
      handler(v, out);
    }
    // Unknown flags are silently ignored
  }

  // Post-processing
  if (out.concurrency === 'auto') {
    out.concurrency = Math.max(1, (os.cpus()?.length || 2) - 1);
  }

  return out;
}
