import { getManifest, type Manifest, type ManifestEntry } from '$lib/images';

/**
 * Typy položek ve skupině dne pro vykreslení c-day-content a c-gallery
 */
export type LocationItem = {
  kind: 'location';
  where: string;
  date: string | null;    // sentinel nese stejný groupBy, date může být null
  city: string | null;
};

export type ImageItem = ManifestEntry & {
  kind: 'image';
  id: string;             // klíč v manifestu bez přípony
  fileKey: string;        // původní klíč v manifestu
  date: string | null;
  groupBy: string | null;
  city: string | null;
  where: string | null;
  type: string | null;
};

export type DayGroup = {
  key: string;            // YYYY-MM-DD
  items: Array<ImageItem | LocationItem>;
};

/**
 * Normalizace klíče (bez přípony) z cesty souboru
 */
function baseSlugFromKey(fileKey: string): string {
  const parts = fileKey.split('/');
  const name = parts[parts.length - 1];
  const dot = name.lastIndexOf('.');
  return dot > 0 ? name.slice(0, dot) : name;
}

/**
 * Pomocná funkce: řazení podle data a poté podle id
 */
function sortByDateThenId(a: ImageItem, b: ImageItem): number {
  const tA = a.date ? new Date(a.date).getTime() : 0;
  const tB = b.date ? new Date(b.date).getTime() : 0;
  if (tA !== tB) return tA - tB;
  return a.id.localeCompare(b.id);
}

/**
 * Vloží 'location' sentinel pro opakované 'where' v rámci jednoho dne,
 * inspirováno datasetNotesAndImages() v Gulp buildu:
 * - při druhém výskytu stejného 'where' vloží dopředu sentinelový objekt
 */
function insertLocationSentinels(dayItems: ImageItem[]): Array<ImageItem | LocationItem> {
  const out: Array<ImageItem | LocationItem> = [];
  let previousWhere = '';
  let whereCount = 0;
  let firstInGroupIndex = -1;

  for (let i = 0; i < dayItems.length; i++) {
    const it = dayItems[i];
    const where = (it.where || '').trim();

    if (where && where === previousWhere) {
      whereCount += 1;
      if (whereCount === 2 && firstInGroupIndex >= 0) {
        // vlož sentinel před první výskyt skupiny stejného 'where'
        const first = dayItems[firstInGroupIndex];
        const sentinel: LocationItem = {
          kind: 'location',
          where,
          city: first.city || null,
          date: first.date || null,
        };
        // Najdi místo, kam sentinel vložit ve výstupu
        let insertPos = out.findIndex(
          (x) => 'kind' in x && (x as any).kind === 'image' && (x as ImageItem).id === first.id,
        );
        if (insertPos === -1) insertPos = out.length;
        out.splice(insertPos, 0, sentinel);
      }
    } else {
      // nová skupina
      whereCount = where ? 1 : 0;
      firstInGroupIndex = where ? i : -1;
      previousWhere = where;
    }

    out.push(it);
  }

  return out;
}

/**
 * Sestaví denní skupiny podle meta.groupBy z manifestu.
 * - bestOf: filtruje pouze položky obsahující 'prio2' v keywords
 */
export function buildDayGroups(manifest: Manifest, options: { bestOf?: boolean } = {}): DayGroup[] {
  const byDay = new Map<string, ImageItem[]>();

  for (const [fileKey, entry] of Object.entries(manifest)) {
    const meta = (entry as any).meta || null;

    // Vynechat manifest položky bez meta.groupBy (nejsou to fotografie nebo chybí EXIF)
    const groupBy = meta?.groupBy ?? null;
    if (!groupBy) continue;

    // BestOf filtr: musí obsahovat 'prio2' (podporujeme string i string[])
    if (options.bestOf) {
      const kw = meta?.keywords;
      const asArr = Array.isArray(kw) ? kw : typeof kw === 'string' ? kw.split(/[,;]\s*/).filter(Boolean) : [];
      if (!asArr.map((s) => s.toLowerCase()).includes('prio2')) continue;
    }

    const id = baseSlugFromKey(fileKey);
    const imageItem: ImageItem = Object.assign({}, entry, {
      kind: 'image' as const,
      id,
      fileKey,
      date: meta?.date ?? null,
      groupBy,
      city: meta?.city ?? null,
      where: meta?.where ?? null,
      type: (meta?.type as string | null) ?? null,
    });

    const list = byDay.get(groupBy) || [];
    list.push(imageItem);
    byDay.set(groupBy, list);
  }

  // Post-processing: řazení a vložení location sentinelů
  const groups: DayGroup[] = [];
  for (const [key, list] of byDay.entries()) {
    list.sort(sortByDateThenId);
    const enriched = insertLocationSentinels(list);
    groups.push({ key, items: enriched });
  }

  // řazení dnů vzestupně
  groups.sort((a, b) => a.key.localeCompare(b.key));
  return groups;
}

/**
 * Convenience: načte manifest a vrátí denní skupiny
 */
export function loadDataset(options: { bestOf?: boolean } = {}): DayGroup[] {
  const manifest = getManifest();
  return buildDayGroups(manifest, options);
}
