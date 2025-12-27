# Collage Editor

> **Kompozitní nástroj pro vytváření profesionálních foto koláží s podporou EXIF metadat**

![Development Only](https://img.shields.io/badge/mode-development-yellow)
![SvelteKit](https://img.shields.io/badge/framework-SvelteKit-ff3e00)
![Sharp](https://img.shields.io/badge/processing-Sharp-99cc00)

---

## Obsah

1. [Popis](#popis)
2. [Klíčové funkce](#klíčové-funkce)
3. [Architektura](#architektura)
4. [Quick Start](#quick-start)
5. [API Reference](#api-reference)
6. [Konfigurace](#konfigurace)
7. [Příklady použití](#příklady-použití)
8. [Re-editace koláží](#re-editace-koláží)
9. [Testování](#testování)
10. [Roadmap](#roadmap)

---

## Popis

Collage Editor je pokročilý nástroj pro vytváření foto koláží přímo v prostředí photoblogu. Umožňuje:

- **Intuitivní vizuální kompozici** – drag & drop, pan & zoom pro každý obrázek
- **Zachování kvality** – Quality-First Scaling zabraňuje upscalingu
- **Metadatovou integritu** – EXIF data kopírována z prvního obrázku (dle DateTimeOriginal)
- **Perzistentní konfiguraci** – možnost re-editace vytvořených koláží

### Proč existuje?

Fotografové často potřebují kombinovat více snímků do jednoho kompozitního výstupu. Tradiční nástroje (Photoshop, Canva) vyžadují manuální import/export a ztrácí EXIF metadata. Tento editor je integrován přímo do workflow galerie.

---

## Klíčové funkce

| Funkce                  | Popis                                                  |
| ----------------------- | ------------------------------------------------------ |
| **3 šablony rozložení** | Row (vedle sebe), Column (pod sebou), Grid 2x2         |
| **Optické okraje**      | Gallery-style margin weighting (2u outer, 3u bottom)   |
| **Pan & Zoom**          | Interaktivní úprava pozice a přiblížení každého snímku |
| **Drag & Drop řazení**  | Změna pořadí obrázků přetažením                        |
| **Auto-save konceptů**  | localStorage ukládá rozpracovanou koláž                |
| **Re-edit podpora**     | JSON sidecar pro opětovné otevření a úpravu            |
| **8K limit**            | Automatická redukce při překročení 8000px              |

---

## Architektura

### Struktura souborů

```
src/lib/
├── types/
│   └── collage.ts              # TypeScript typy
├── utils/
│   ├── collage.ts              # Frontend utility funkce
│   ├── collage-config.ts       # Načítání konfigurace pro re-edit
│   └── collage-layout-engine.ts # Sdílený layout engine
├── components/
│   └── admin/
│       └── CollageDialog.svelte # Hlavní UI komponenta
└── routes/
    └── api/
        └── images/
            └── collage/
                └── +server.ts  # Backend API endpoint
```

### Datový tok

```
┌─────────────────────────────────────────────────────────────────────┐
│                         CollageDialog.svelte                         │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────────────┐   │
│  │ ImageEntry[] │ -> │ Layout Engine │ -> │ Preview (CSS preview)│   │
│  └──────────────┘    └──────────────┘    └──────────────────────┘   │
│         │                    │                                       │
│         v                    v                                       │
│  ┌──────────────────────────────────────────────┐                   │
│  │            CollageRequest (JSON)              │                   │
│  │  { items[], template, border }                │                   │
│  └──────────────────────────────────────────────┘                   │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              v  POST /api/images/collage
┌─────────────────────────────────────────────────────────────────────┐
│                        Backend (+server.ts)                          │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────────────┐   │
│  │ Resolve paths│ -> │ Sharp render │ -> │ EXIF copy + save     │   │
│  └──────────────┘    └──────────────┘    └──────────────────────┘   │
│                                                                      │
│  Output: content/<gallery>/pics/<name>--collage.jpg                  │
│          content/<gallery>/pics/<name>--collage.json                 │
│          content/<gallery>/collage-sources/<originals>         │
└─────────────────────────────────────────────────────────────────────┘

> **Note:** When the backend moves source images into `collage-sources/`, it now updates the images manifest and performs the same cleanup steps as archiving (removing generated assets, cache entries, clustering constraints, and cleaning sub-manifests like analysis/embeddings/faces). The audit script also detects orphaned files in `collage-sources/` so the gallery can be cleaned up when needed.

```

---

## Quick Start

### 1. Výběr obrázků

V Edit Mode vyberte 2–4 obrázky a klikněte na tlačítko **„Vytvořit koláž"**.

### 2. Konfigurace v dialogu

```svelte
<!-- Automaticky se otevře CollageDialog -->
<CollageDialog bind:open={dialogOpen} images={selectedImages} />
```

### 3. Interakce s náhledem

| Akce              | Ovládání                          |
| ----------------- | --------------------------------- |
| **Pan (posun)**   | Klikni + táhni myší               |
| **Zoom**          | Kolečko myši (scroll)             |
| **Změna pořadí**  | Drag & drop v seznamu obrázků     |
| **Změna šablony** | Kliknutí na ikony Row/Column/Grid |

### 4. Vytvoření koláže

Klikněte **„Vytvořit koláž (High Quality)"**. Výsledek:

- Uloží se do `pics/<název>--collage.jpg`
- Konfigurace do `pics/<název>--collage.json`
- Zdrojové soubory přesunuty do `collage-sources/`

---

## API Reference

### POST `/api/images/collage`

Vytvoří novou koláž z poskytnutých obrázků.

#### Request Body

```typescript
interface CollageRequest {
  items: CollageItemConfig[];
  template: "row" | "column" | "grid-2x2";
  border?: {
    width: number; // Referenční šířka v px
    color: string; // HEX barva (#ffffff)
  };
  aspectRatio?: string; // Poměr stran ("auto", "16:9", "4:3", "21:9", atd.)
}

interface CollageItemConfig {
  imageId: string; // Cesta k souboru
  id?: string; // ID z manifestu
  crop?: {
    x: number; // 0-100 (horizontální pozice %)
    y: number; // 0-100 (vertikální pozice %)
    scale: number; // >= 1 (zoom faktor)
  };
}
```

#### Response

```typescript
interface CollageResponse {
  success: boolean;
  outputPath?: string; // Relativní cesta k výstupu
  error?: string; // Chybová zpráva (pokud success=false)
}
```

#### Příklad

```bash
curl -X POST http://localhost:5173/api/images/collage \
  -H "Content-Type: application/json" \
  -d '{
    "items": [
      { "imageId": "pics/DSC_1234.jpg", "crop": { "x": 50, "y": 50, "scale": 1 } },
      { "imageId": "pics/DSC_1235.jpg", "crop": { "x": 30, "y": 60, "scale": 1.2 } }
    ],
    "template": "row",
    "aspectRatio": "16:9",
    "border": { "width": 10, "color": "#ffffff" }
  }'
```

### Utility funkce

#### `collage.ts`

```typescript
// Normalizace šířky okraje podle rozměrů obrázků
calculateNormalizedBorderWidth(setting: number, images: ImageEntry[]): number

// Výpočet CSS pozic pro náhled
calculateCollageLayout(imgs: ImageEntry[], template: CollageTemplateId, borderW: number)

// Automatický výběr šablony podle převládající orientace
determineAutoTemplate(images: ImageEntry[]): CollageTemplateId

// Formátování rozměrů pro UI
formatDimensionLabel(width?: number, height?: number): string
formatRatioLabel(width?: number, height?: number): string
```

#### `collage-config.ts`

```typescript
// Načtení konfigurace pro re-edit
loadCollageConfig(collageImageId: string): Promise<CollageRequest | null>

// Detekce, zda je obrázek koláž
isCollage(imageId: string): boolean

// Získání ID zdrojových obrázků
getCollageSourceIds(config: CollageRequest): string[]
```

#### `collage-layout-engine.ts`

```typescript
// Sdílený layout engine (frontend + backend)
calculateLayout<T extends LayoutItem>(
  items: T[],
  template: CollageTemplateId,
  border: CollageBorder
): SharedLayout<T>
```

---

## Konfigurace

### Šablony rozložení

| Šablona        | Min/Max | Popis                                                           |
| -------------- | ------- | --------------------------------------------------------------- |
| `row`          | 2+      | (Stávající) Horizontální řazení s vyrovnanou výškou             |
| `column`       | 2+      | (Stávající) Vertikální řazení s vyrovnanou šířkou               |
| `grid-2x2`     | 4       | (Stávající) Mřížka 2×2 s proporcionálním škálováním             |
| `hero-top`     | 3       | 1 velký nahoře, 2 menší vedle sebe dole                         |
| `hero-left`    | 3       | 1 vysoký vlevo, 2 menší nad sebou vpravo                        |
| `hero-right`   | 3       | 1 vysoký vpravo, 2 menší nad sebou vlevo                        |
| `density-7`    | 7       | Komplexní mřížka 2-3-2 (Mosaic)                                 |
| `grid-3x2`     | 6       | Mřížka 3 řady po 2 sloupcích                                    |
| `mosaic-6`     | 6       | 3 sloupce s různým dělením (např. 2-3-1)                        |
| `sidebar-hero` | 4       | 1 vysoký vlevo ("sidebar"), vpravo 2 malé nahoře, 1 široký dole |

### Detailní specifikace nových šablon

**Hero Top (3 items)**

```
[       1       ]
[   2   ][   3   ]
```

**Hero Left (3 items)**

```
[      ][  2  ]
[   1  ][     ]
[      ][  3  ]
```

**Hero Right (3 items)**

```
[  2  ][      ]
[     ][   1  ]
[  3  ][      ]
```

**Sidebar Hero (4 items)**

```
[      ][ 2 ][ 3 ]
[   1  ][        ]
[      ][    4   ]
```

**Density 7 (7 items)**

```
[   1   ][   2   ]
[ 3 ][ 4 ][ 5 ]
[   6   ][   7   ]
```

**Grid 3x2 (6 items)**

```
[   1   ][   2   ]
[   3   ][   4   ]
[   5   ][   6   ]
```

**Mosaic 6 (6 items)**

```
[ A ][ B ][ F ]
[ A ][ C ][ F ]
[ D ][ E ][ F ]
```

### Okraje (Border)

```
┌──────────────────────────────────────────────────┐
│                    2u (outer margin)              │
│  ┌────────────────┐  u  ┌────────────────┐      │
│  │                │     │                │      │
│  │    Image 1     │     │    Image 2     │      │
│  │                │     │                │      │
│  └────────────────┘     └────────────────┘      │
│                    3u (bottom margin)            │
└──────────────────────────────────────────────────┘

u = borderWidth (gutter)
2u = outer margins (top, left, right)
3u = bottom margin (gallery-style optical weighting)
```

### Environment

| Proměnná      | Popis                                           |
| ------------- | ----------------------------------------------- |
| `CONTENT_DIR` | Název aktivní galerie (egypt-2025, israel-2022) |

**Poznámka:** API endpoint je dostupný pouze v development módu (`import.meta.env.DEV`).

---

## Příklady použití

### Základní koláž dvou obrázků

```svelte
<script lang="ts">
  import CollageDialog from "$lib/components/admin/CollageDialog.svelte";
  import type { ImageEntry } from "$lib/types/manifest";

  let dialogOpen = $state(false);
  let selectedImages = $state<ImageEntry[]>([]);

  function openCollageEditor(images: ImageEntry[]) {
    selectedImages = images;
    dialogOpen = true;
  }
</script>

<button onclick={() => openCollageEditor(mySelectedImages)}>
  Vytvořit koláž ({mySelectedImages.length})
</button>

<CollageDialog bind:open={dialogOpen} images={selectedImages} />
```

### Re-editace existující koláže

```svelte
<script lang="ts">
  import type { CollageRequest } from "$lib/types/collage";
  import { getCollageSourceIds, isCollage, loadCollageConfig } from "$lib/utils/collage-config";

  let existingConfig = $state<CollageRequest | undefined>(undefined);

  async function editExistingCollage(collageImage: ImageEntry) {
    if (!isCollage(collageImage.id)) return;

    const config = await loadCollageConfig(collageImage.id);
    if (!config) {
      toast.error("Nelze načíst konfiguraci koláže");
      return;
    }

    const sourceIds = getCollageSourceIds(config);
    const sourceImages = sourceIds
      .map((id) => allImages.find((img) => img.id === id))
      .filter(Boolean);

    existingConfig = config;
    selectedImages = sourceImages;
    dialogOpen = true;
  }
</script>

<CollageDialog bind:open={dialogOpen} images={selectedImages} {existingConfig} />
```

### Programové vytvoření koláže

```typescript
const response = await fetch("/api/images/collage", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    items: [
      { imageId: "pics/photo1.jpg" },
      { imageId: "pics/photo2.jpg" },
      { imageId: "pics/photo3.jpg" },
    ],
    template: "row",
    border: { width: 15, color: "#000000" },
  }),
});

const result = await response.json();
if (result.success) {
  console.log(`Koláž vytvořena: ${result.outputPath}`);
}
```

---

## Re-editace koláží

### Detekce koláže

Koláž je identifikována suffixem `--collage` v názvu souboru:

```typescript
import { isCollage } from "$lib/utils/collage-config";

if (isCollage("DSC_1234--collage.jpg")) {
  // Zobrazit "Upravit koláž" místo "Vytvořit koláž"
}
```

### Struktura souborů po vytvoření

```
content/egypt-2025/
├── pics/
│   ├── DSC_1234--collage.jpg      ← Finální koláž
│   ├── DSC_1234--collage.json     ← Konfigurace pro re-edit
│   └── collage-sources/
│       ├── DSC_1234.jpg          ← Původní fotka
│       ├── DSC_1235.jpg
│       └── DSC_1236.jpg
```

### JSON konfigurace

```json
{
  "items": [
    {
      "imageId": "pics/DSC_1234.jpg",
      "id": "DSC_1234",
      "crop": { "x": 45, "y": 30, "scale": 1.5 },
      "originalPath": "pics/DSC_1234.jpg",
      "movedPath": "collage-sources/pics/DSC_1234.jpg"
    },
    {
      "imageId": "pics/DSC_1235.jpg",
      "id": "DSC_1235",
      "crop": { "x": 50, "y": 50, "scale": 1.0 },
      "originalPath": "pics/DSC_1235.jpg",
      "movedPath": "collage-sources/pics/DSC_1235.jpg"
    }
  ],
  "template": "row",
  "aspectRatio": "16:9",
  "border": {
    "width": 10,
    "color": "#ffffff"
  },
  "metadata": {
    "name": "DSC_1234--collage.jpg",
    "created": "2025-12-26T12:00:00.000Z",
    "canvasWidth": 4500,
    "canvasHeight": 3000
  }
}
```

### Workflow re-editace

1. Uživatel vybere `*--collage.jpg` v galerii
2. Systém detekuje koláž → zobrazí „Upravit koláž"
3. Kliknutí načte JSON konfiguraci přes API
4. Dialog se otevře s předvyplněnými hodnotami:
   - Šablona (template)
   - Poměr stran (aspectRatio)
   - Nastavení okraje (border)
   - Crop/Pan/Zoom pro každou fotku
5. Uživatel upraví (řazení, zoom, okraje, poměr stran...)
6. Uložení **přemaže** starý `.jpg` a `.json`
7. Zdrojové fotky zůstávají v `collage-sources/`

---

## Testování

### Jednotkové testy

```bash
# Spuštění unit testů pro collage utility funkce
bun run test:unit -- --grep "collage"
```

### Komponenty

```bash
# Component testy pro CollageDialog
CONTENT_DIR=egypt-2025 bun run vitest run --project client -- --grep "CollageDialog"
```

### E2E testy

```bash
# End-to-end test workflow
bun run test:e2e -- --grep "collage"
```

### Manuální testování

1. Spustit dev server: `bun run dev:egypt`
2. Přejít do Edit Mode
3. Vybrat 2-4 obrázky
4. Kliknout „Vytvořit koláž"
5. Ověřit:
   - Náhled se správně renderuje
   - Pan/Zoom funguje
   - Výstup má správné rozměry
   - EXIF metadata jsou zachována

---

## Roadmap

### Plánované funkce

- [ ] **Více šablon** – Golden ratio, Pinterest-style masonry
- [ ] **Text overlays** – Přidání titulků a popisků
- [ ] **Filtry** – B&W, sepia, vignette
- [ ] **Export formátů** – PNG, TIFF, WebP
- [ ] **Batch processing** – Hromadné vytváření koláží

### Známé limitace

| Limitace             | Důvod                 | Workaround          |
| -------------------- | --------------------- | ------------------- |
| Max 8000px           | Paměťové limity Sharp | Automatická redukce |
| Pouze JPEG výstup    | Optimalizace kvality  | --                  |
| Dev-only             | Bezpečnost produkce   | --                  |
| 4 obrázky max (grid) | Design rozhodnutí     | Použít row/column   |

### Budoucí směry

1. **WebAssembly rendering** – Rychlejší zpracování v prohlížeči
2. **AI-based composition** – Automatické rozpoznání hlavních subjektů
3. **Cloud backup** – Synchronizace konceptů napříč zařízeními

---

## Troubleshooting

### Časté problémy

#### „Obrázek nebyl nalezen"

**Příčina:** Nesprávná cesta k souboru nebo chybějící zdrojový obrázek.

**Řešení:** Ověřte, že obrázky existují v `content/<gallery>/pics/`.

#### Koláž se nevytvoří

**Příčina:** API endpoint je dostupný pouze v dev módu.

**Řešení:** Spusťte aplikaci pomocí `bun run dev:*`.

#### Ztráta crop nastavení při re-editu

**Příčina:** JSON konfigurace nebyla správně uložena.

**Řešení:** Zkontrolujte existenci `*--collage.json` vedle koláže.

#### Upozornění na škálování

**Log:** `Škálování pro zachování kvality: 85%`

**Význam:** Zoom způsobil potenciální upscale, systém automaticky zmenšil canvas pro zachování kvality.

---

## Poznámky pro vývojáře

### Přidání nové šablony

1. Přidat typ do `src/lib/types/collage.ts`:

   ```typescript
   export type CollageTemplateId = "row" | "column" | "grid-2x2" | "new-template";
   ```

2. Implementovat layout v `collage-layout-engine.ts`:

   ```typescript
   function calculateNewTemplateLayout<T>(items: T[], borderW: number): SharedLayout<T> {
     // ...implementace
   }
   ```

3. Přidat do `calculateLayout()` switch

4. Přidat do UI v `CollageDialog.svelte` (templates array)

### Lokalizace

Všechny texty jsou centralizovány v `src/lib/utils/messages.ts` pod `COLLAGE_MESSAGES`. Pro přidání nového jazyka:

1. Vytvořit nový soubor `messages.<lang>.ts`
2. Implementovat i18n provider
3. Přepnout import v komponentách

---

_Poslední aktualizace: 2025-12-26_
