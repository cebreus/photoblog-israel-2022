# Návrh: Rozšíření metadat pro speciální typy médií

**Datum:** 2024-12-29  
**Status:** Implemented (Slim Version)  
**Autor:** AI Assistant

## Implementace (Dec 2024)

Byla implementována "zeštíhlená" verze tohoto návrhu zaměřená na robustní detekci a zobrazování jednosouborových médií.

### Implementované změny:

1. **Nové typy:** `SpecialMediaData` a `ImageProjection` v `shared/types/manifest.ts`.
2. **SpecialMediaConfig:** Přidáno pole `specialMedia` do `ImageEntry`.
3. **Detekce:**
   - **Panoramata:** Detekce podle suffixu `--pano` NEBO `aspectRatio > 2.2`.
   - **Sféry:** Detekce podle suffixu `--sphere`.
   - **Koláže:** Identifikovány, ale mají explicitně `specialMedia: undefined` (jsou flat).
4. **Sekvence:** Opravena detekce členů pomocí časového okna (10 min) pro sdružování fotek (Zoom, Burst).
5. **Runtime.** `SequencePlayer` a `Fancybox` využívají nová metadata namísto ad-hoc heuristik.

---

## 1. Motivace

Aktuálně máme několik typů speciálních fotografií, které vyžadují odlišné zpracování a zobrazení:

| Typ               | Příklad                  | Aktuální identifikace | Problém                 |
| ----------------- | ------------------------ | --------------------- | ----------------------- |
| Koláž             | `--collage` suffix       | ✅ Funguje            | -                       |
| Panorama (suffix) | `--pano` suffix          | ✅ Funguje            | -                       |
| Panorama (aspekt) | široké fotky bez suffixu | ⚠️ Částečně           | Pouze runtime, ne build |
| Fotosféra 360°    | equirectangular          | ❌ Neexistuje         | Potřebuje viewer        |
| Fisheye           | rybí oko                 | ❌ Neexistuje         | Potřebuje korekci       |
| Sekvence          | `--zoom1from3` atd.      | ✅ Funguje            | -                       |

## 2. Zdroje metadat

### 2.1 EXIF/XMP standardy

#### GPano (Google PhotoSphere XMP)

Standardizovaná metadata pro panoramata a sféry:

```
GPano:ProjectionType        = "equirectangular" | "cylindrical"
GPano:UsePanoramaViewer     = true/false
GPano:CroppedAreaImageWidthPixels
GPano:CroppedAreaImageHeightPixels
GPano:FullPanoWidthPixels   = šířka celé sféry (typicky 2x height pro 360°)
GPano:FullPanoHeightPixels
GPano:CroppedAreaLeftPixels
GPano:CroppedAreaTopPixels
GPano:PoseHeadingDegrees    = 0-360 (směr kamery, N=0)
GPano:PosePitchDegrees      = -90 to 90 (vertikální úhel)
GPano:PoseRollDegrees       = rotace
GPano:InitialViewHeadingDegrees
GPano:InitialViewPitchDegrees
GPano:InitialHorizontalFOVDegrees
GPano:FirstPhotoDate
GPano:LastPhotoDate
GPano:SourcePhotosCount
GPano:StitchingSoftware
```

#### GPS směr kamery

```
EXIF:GPSImgDirection        = 0-360 (směr kam fotoaparát mířil)
EXIF:GPSImgDirectionRef     = "T" (true north) | "M" (magnetic)
EXIF:GPSDestBearing         = směr k objektu
```

#### Lens informace (pro fisheye)

```
EXIF:LensModel              = obsahuje "fisheye" pro rybí oko
EXIF:FocalLength            = <15mm často značí ultra-wide/fisheye
XMP:LensInfo
```

### 2.2 Naše konvence (filename suffixes)

| Suffix           | Význam                     |
| ---------------- | -------------------------- |
| `--collage`      | Uživatelem vytvořená koláž |
| `--pano`         | Explicitní panorama        |
| `--sphere`       | 360° fotosféra (návrh)     |
| `--fisheye`      | Rybí oko (návrh)           |
| `--zoom1from3`   | Zoom sekvence              |
| `--pan1from5`    | Pan sekvence               |
| `--burst1from10` | Burst                      |
| `--tl1from24`    | Timelapse                  |
| `--focus1from3`  | Focus stack                |

## 3. Navržený datový model

### 3.1 Nové typy

```typescript
// shared/types/manifest.ts

/**
 * Projekce obrázku - jak se má renderovat.
 */
export type ImageProjection =
  | "flat" // Běžná fotka (výchozí)
  | "cylindrical" // Panorama (horizontální scroll)
  | "equirectangular" // 360° sféra
  | "fisheye" // Rybí oko (potřebuje korekci)
  | "stereographic"; // Little planet / malá planeta

/**
 * Typ speciálního média - sémantická kategorie.
 */
export type SpecialMediaType =
  | "standard" // Běžná fotka
  | "panorama" // Široké panorama (ne 360°)
  | "photosphere" // 360° sféra
  | "collage" // Uživatelská koláž
  | "fisheye" // Rybí oko
  | "drone" // Letecký snímek (potenciálně jiný přístup)
  | "hdr" // HDR merge
  | "focus-stack"; // Focus stacked výsledek

/**
 * Konfigurace pro speciální média.
 * Pouze pro fotky, které vyžadují nestandardní zpracování nebo viewer.
 */
export type SpecialMediaConfig = {
  /**
   * Sémantický typ média.
   */
  type: SpecialMediaType;

  /**
   * Projekce pro renderer (Pannellum, etc.)
   */
  projection?: ImageProjection;

  // ═══════════════════════════════════════════
  // FIELD OF VIEW (FOV) - pro panoramata a sféry
  // ═══════════════════════════════════════════

  /**
   * Horizontal Field of View ve stupních.
   * - 360 = plná sféra
   * - 180 = hemisféra
   * - <180 = částečné panorama
   */
  hfov?: number;

  /**
   * Vertical Field of View ve stupních.
   * - 180 = plná vertikální coverage
   * - <180 = omezené (typické pro panoramata)
   */
  vfov?: number;

  /**
   * Počáteční FOV pro viewer (zoom level).
   * Menší = více zoomováno.
   */
  initialFov?: number;

  // ═══════════════════════════════════════════
  // CAMERA ORIENTATION - směr pohledu
  // ═══════════════════════════════════════════

  /**
   * Směr kamery (heading/azimuth) ve stupních.
   * 0 = Sever, 90 = Východ, 180 = Jih, 270 = Západ
   */
  heading?: number;

  /**
   * Naklopení kamery (pitch) ve stupních.
   * -90 = dolů (nadir), 0 = horizont, 90 = nahoru (zenith)
   */
  pitch?: number;

  /**
   * Rotace kamery (roll) ve stupních.
   * 0 = rovně, ±180 = vzhůru nohama
   */
  roll?: number;

  /**
   * Zda je heading relativní k true north nebo magnetic north.
   */
  headingRef?: "true" | "magnetic";

  // ═══════════════════════════════════════════
  // INITIAL VIEW - kde začít při zobrazení
  // ═══════════════════════════════════════════

  /**
   * Počáteční heading pro viewer (kde se má uživatel "dívat" na začátku).
   */
  initialHeading?: number;

  /**
   * Počáteční pitch pro viewer.
   */
  initialPitch?: number;

  // ═══════════════════════════════════════════
  // CREATION METADATA
  // ═══════════════════════════════════════════

  /**
   * Software použitý pro stitching.
   */
  stitchingSoftware?: string;

  /**
   * Počet zdrojových fotek (pro panorama/HDR/stack).
   */
  sourcePhotoCount?: number;

  /**
   * Datum první zdrojové fotky.
   */
  firstPhotoDate?: string;

  /**
   * Datum poslední zdrojové fotky.
   */
  lastPhotoDate?: string;
};
```

### 3.2 Rozšíření ImageEntry

```typescript
export type ImageEntry = {
  // ... existující pole ...

  /**
   * Konfigurace pro speciální média.
   * Undefined pro běžné fotky.
   */
  specialMedia?: SpecialMediaConfig;

  // Existující pole zůstávají:
  // - aspectRatio: "panorama" | "collage" | ...
  // - sequenceInfo: pro sekvence
  // - panoramaConfig: DEPRECATED - nahrazeno specialMedia
};
```

### 3.3 Vztah k existujícím polím

| Pole                  | Účel                 | Vztah k specialMedia                             |
| --------------------- | -------------------- | ------------------------------------------------ |
| `type: MediaItemType` | Základní typ položky | Zůstává ("image", "sequence", etc.)              |
| `aspectRatio`         | Poměr stran pro grid | Zůstává, ale specialMedia má prioritu pro viewer |
| `sequenceInfo`        | Sekvence metadata    | Nezávislé, zůstává                               |
| `panoramaConfig`      | **DEPRECATED**       | Migrovat do `specialMedia`                       |

## 4. Detekce a klasifikace

### 4.1 Priorita zdrojů

```
1. Filename suffix (--collage, --pano, --sphere)
   → Explicitní uživatelský override

2. XMP GPano metadata
   → Authoritative pro panoramata/sféry z kamer/software

3. EXIF LensModel
   → Detekce fisheye objektivů

4. Aspect ratio heuristika
   → Fallback: ratio > 2.2 = panorama

5. EXIF GPS Direction
   → Doplňující data (heading)
```

### 4.2 Klasifikační rozhodovací strom

```
┌─ Má suffix --collage?
│  └─ ANO → type: "collage", projection: "flat"
│
├─ Má suffix --sphere nebo GPano:ProjectionType = "equirectangular"?
│  └─ ANO → type: "photosphere", projection: "equirectangular"
│
├─ Má suffix --pano nebo GPano:ProjectionType = "cylindrical"?
│  └─ ANO → type: "panorama", projection: "cylindrical"
│
├─ Má aspect ratio > 2.2 (a není collage)?
│  └─ ANO → type: "panorama", projection: "cylindrical"
│
├─ LensModel obsahuje "fisheye" nebo FocalLength < 12mm?
│  └─ ANO → type: "fisheye", projection: "fisheye"
│
└─ Jinak
   └─ type: "standard", projection: "flat"
```

## 5. Implementace

### 5.1 Fáze 1: Build-time detekce

**Soubory k úpravě:**

1. `shared/types/manifest.ts`
   - Přidat `SpecialMediaConfig`, `SpecialMediaType`, `ImageProjection`
   - Přidat `specialMedia` do `ImageEntry`
   - Deprecovat `panoramaConfig`

2. `scripts/lib/image/metadata.ts`
   - Rozšířit `readRawMetadata` o GPano XMP
   - Přidat `classifySpecialMedia()` funkci
   - Nastavit `specialMedia` v `buildImageEntry()`

3. `scripts/lib/image/processor.ts`
   - Použít `specialMedia.type` místo `isPanorama()` pro detekci
   - Generovat správné varianty podle typu

### 5.2 Fáze 2: Runtime viewers

1. `src/lib/components/SequencePlayer.svelte`
   - Rozšířit o podporu různých projekcí
   - Pro `equirectangular` integrovat Pannellum nebo Three.js

2. `src/lib/actions/fancybox.ts`
   - Použít `specialMedia` pro rozhodování o vieweru

### 5.3 Fáze 3: UI indikátory

1. Ikony v gridu pro různé typy
2. Informace v detailu (heading compass, FOV diagram)

## 6. Příklady výsledných dat

### 6.1 Běžná fotka

```json
{
  "id": "2025-11-26-081544-cebreus",
  "aspectRatio": "landscape-4-3",
  "specialMedia": null
}
```

### 6.2 Panorama (detekováno z aspect ratio)

```json
{
  "id": "2025-11-26-082610-cebreus",
  "aspectRatio": "panorama",
  "specialMedia": {
    "type": "panorama",
    "projection": "cylindrical",
    "hfov": 120,
    "heading": 45,
    "headingRef": "true"
  }
}
```

### 6.3 Koláž

```json
{
  "id": "2025-11-25-084249-cebreus--collage",
  "aspectRatio": "collage",
  "specialMedia": {
    "type": "collage",
    "projection": "flat",
    "sourcePhotoCount": 4
  }
}
```

### 6.4 360° Sféra

```json
{
  "id": "2025-11-27-143022-cebreus--sphere",
  "aspectRatio": "sphere",
  "specialMedia": {
    "type": "photosphere",
    "projection": "equirectangular",
    "hfov": 360,
    "vfov": 180,
    "initialFov": 90,
    "initialHeading": 0,
    "initialPitch": 0,
    "stitchingSoftware": "PTGui Pro",
    "sourcePhotoCount": 24
  }
}
```

### 6.5 Fisheye

```json
{
  "id": "2025-11-28-091500-cebreus",
  "aspectRatio": "square",
  "specialMedia": {
    "type": "fisheye",
    "projection": "fisheye",
    "hfov": 180
  }
}
```

## 7. Migrace

### 7.1 Existující data

1. Fotky s `aspectRatio: "panorama"` → přidat `specialMedia.type: "panorama"`
2. Fotky s `aspectRatio: "collage"` → přidat `specialMedia.type: "collage"`
3. Fotky s `panoramaConfig` → migrovat do `specialMedia`
4. Smazat deprecated `panoramaConfig`

### 7.2 Zpětná kompatibilita

- `aspectRatio` zůstává pro grid layout
- `specialMedia` je opt-in pro pokročilé viewery
- Viewers fallback na `aspectRatio` pokud `specialMedia` chybí

## 8. Otevřené otázky

1. **Pannellum vs Three.js vs jiný viewer pro 360°?**
   - Pannellum je lehčí, Three.js flexibilnější

2. **Automatická detekce FOV z EXIF?**
   - FocalLength + SensorWidth = FOV, ale sensor info často chybí

3. **Ukládat heading pro VŠECHNY fotky nebo jen speciální?**
   - Heading může být užitečný pro mapové vizualizace

4. **Multi-row panoramata?**
   - Některá panoramata mají více řad (vfov > 60°)

---

## Další kroky

1. [ ] Review tohoto návrhu
2. [ ] Rozhodnout o vieweru (Pannellum vs Three.js)
3. [ ] Implementovat Fázi 1 (build-time detekce)
4. [ ] Testovat s reálnými panoramaty a sférami
5. [ ] Implementovat Fáze 2-3
