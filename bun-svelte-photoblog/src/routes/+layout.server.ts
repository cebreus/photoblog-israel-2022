import days from '$lib/images.manifest.json';

/**
 * Server load that exposes the days-only manifest. Generator writes an array of day groups.
 */
export async function load() {
  try {
    // `days` may be either the array we generate or an object with a `days`
    // property depending on how the JSON was imported / transformed. Cast to
    // unknown and normalize safely.
    const raw: unknown = days as unknown;
    const ds: any = Array.isArray(raw) ? raw : ((raw && (raw as any).days) ? (raw as any).days : []);
    return { dataset: ds };
  } catch (err) {
    return { dataset: [] };
  }
}
