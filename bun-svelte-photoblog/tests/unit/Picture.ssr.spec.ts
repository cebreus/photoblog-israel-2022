import { describe, it, expect, vi } from 'vitest';
import {
  type ManifestEntry,
  getSources,
  getImgFallback,
  placeholderBackgroundStyle,
  dominantColorStyle,
} from '$lib/images';

// Manifest import je v $lib/images na úrovni modulu, ale v těchto testech
// nepoužíváme findImage(), takže není nutné manifest podvrhovat.
// Pokud by bylo třeba, lze použít vi.mock('$lib/images.manifest.json', ...)

// Pomocný výrobce ManifestEntry pro testy
function makeEntry(): ManifestEntry {
  return {
    original: {
      width: 2000,
      height: 1333,
      format: 'jpeg',
      bytes: 123456,
      path: '/images/israel-2022/details/sample.jpg',
    },
    variants: {
      avif: [
        { width: 534, height: 300, path: '/images/israel-2022/previews-avif/sample.avif', bytes: 111 },
      ],
      webp: [
        { width: 534, height: 300, path: '/images/israel-2022/previews-webp/sample.webp', bytes: 222 },
      ],
      jpeg: [
        { width: 534, height: 300, path: '/images/israel-2022/previews/sample.jpg', bytes: 333 },
      ],
    },
    placeholder: { base64: 'AAAA', width: 24, height: null, type: 'image/jpeg' },
    color: '#112233',
    hash: 'deadbeef',
    outputs: [
      '/images/israel-2022/previews/sample.jpg',
      '/images/israel-2022/previews-webp/sample.webp',
      '/images/israel-2022/previews-avif/sample.avif',
    ],
  };
}

describe('Picture helpers (bez plného SSR renderu)', () => {
  it('getSources() vrací AVIF/WEBP sources se správnými typy a srcset', () => {
    const entry = makeEntry();
    const sources = getSources(entry, '100vw');
    const avif = sources.find((s) => s.type === 'image/avif');
    const webp = sources.find((s) => s.type === 'image/webp');

    expect(avif).toBeTruthy();
    expect(webp).toBeTruthy();
    expect(avif?.srcset).toContain('.avif');
    expect(webp?.srcset).toContain('.webp');
    expect(avif?.sizes).toBe('100vw');
  });

  it('getImgFallback() preferuje JPEG, vrací správné atributy', () => {
    const entry = makeEntry();
    const fb = getImgFallback(entry, '100vw');
    expect(fb).toBeTruthy();
    expect(fb?.type).toBe('image/jpeg');
    expect(fb?.src).toContain('.jpg');
    expect(fb?.sizes).toBe('100vw');
    expect(fb?.srcset).toContain('534w');
  });

  it('placeholderBackgroundStyle() a dominantColorStyle() generují očekávané CSS', () => {
    const entry = makeEntry();
    const bg = placeholderBackgroundStyle(entry);
    const color = dominantColorStyle(entry);

    expect(bg).toContain("data:image/jpeg;base64,AAAA");
    expect(bg).toContain('background-image');
    expect(color).toBe('background-color:#112233;');
  });
});
