# Component Reference

> Kompletní přehled klíčových Svelte komponent v projektu.

**Navigace:** [← INDEX](./INDEX.md) | [ARCH-COMPONENTS →](./ARCH-COMPONENTS.md)

## Obsah

1. [Gallery Components](#1-gallery-components)
2. [Editing Components](#2-editing-components)
3. [People Management](#3-people-management)
4. [Separator Management](#4-separator-management)
5. [Utilities](#5-utilities)

---

## 1. Gallery Components

### PhotoGrid

**Path:** [`src/lib/components/PhotoGrid.svelte`](../../src/lib/components/PhotoGrid.svelte)

Hlavní galerie s interaktivním gridů fotek.

**Props:**

```svelte
<PhotoGrid items={photoItems} isEditMode={true} selectedCount={5} />
```

| Prop            | Type           | Desc                  |
| --------------- | -------------- | --------------------- |
| `items`         | `ImageEntry[]` | Filtrované fotky      |
| `isEditMode`    | `boolean`      | Je v režimu editace?  |
| `selectedCount` | `number`       | Počet vybraných fotek |

**Features:**

- Lazy loading via Intersection Observer
- Lightbox (Fancybox) integraci
- Reorder mode (drag-drop)
- Collage mode pro multi-select

**Stores:**

```ts
import { filters } from "$lib/stores/filters.svelte.js";
import { selectedImageIds } from "$lib/stores/selectedImages.svelte.js";
```

---

### PhotoGridSeparator

**Path:** [`src/lib/components/PhotoGridSeparator.svelte`](../../src/lib/components/PhotoGridSeparator.svelte)

Separator component mezi skupinami fotek (extraction z PhotoGrid).

**Props:**

```svelte
<PhotoGridSeparator separator={sep} {dayId} onReorder={() => {}} />
```

| Prop        | Type         | Desc                  |
| ----------- | ------------ | --------------------- |
| `separator` | `Separator`  | Separator definice    |
| `dayId`     | `string`     | ID dne (context)      |
| `onReorder` | `() => void` | Callback po přeřazení |

**Features:**

- Drag-drop story modal
- Reorder modes: "Distribute" (rovnoměrně), "Reset" (origami)
- Inline editing (title/description)
- Story image preview
- Context menu pro smazání/edit

**Stores:**

```ts
import { editingMode } from "$lib/stores/editingMode.svelte.js";
```

---

### SequencePlayer

**Path:** [`src/lib/components/SequencePlayer.svelte`](../../src/lib/components/SequencePlayer.svelte)

Přehrávač pro sekvence fotek (10-minutové skupiny).

**Props:**

```svelte
<SequencePlayer sequence={seq} autoplay={false} />
```

| Prop       | Type           | Desc                   |
| ---------- | -------------- | ---------------------- |
| `sequence` | `SequenceInfo` | Sequence definice      |
| `autoplay` | `boolean`      | Automaticky přehrávat? |

**Features:**

- Navigace mezi členy (next/prev)
- Informace: identifikátor, počet fotek, čas prvního snímku
- Zobrazuje všechny členy jako timeline
- Click aktivuje fotku na PhotoGrid

**Stores:**

```ts
import { selectedImageIds } from "$lib/stores/selectedImages.svelte.js";
```

---

## 2. Editing Components

### ClapEditor

**Path:** [`src/lib/components/ClapEditor.svelte`](../../src/lib/components/ClapEditor.svelte)

Editor pro CLAP (Clean Aperture) ořezy na HEIC obrázcích.

**Props:**

```svelte
<ClapEditor imageId={id} initialClap={clap} onSave={(clap) => {}} />
```

| Prop          | Type                | Desc                  |
| ------------- | ------------------- | --------------------- |
| `imageId`     | `string`            | ID obrázku            |
| `initialClap` | `CleanApertureData` | Aktuální CLAP hodnoty |
| `onSave`      | `(data) => void`    | Callback po uložení   |

**Features:**

- 2D canvas pro výběr ořezu (rectangle)
- Aspect ratio lock (16:9, 4:3, 1:1, custom)
- Náhled s reálným CLAP ořezem
- Transformace souřadnic (native EXIF → user-space)
- Reset na originál

**Data model:**

```ts
interface CleanApertureData {
  width: number; // px
  height: number; // px
  horizOffset: number; // px (left edge)
  vertOffset: number; // px (top edge)
}
```

**Related API:**

```
GET /api/images/clap-preview?imageId=...&variant=...
PATCH /api/images (with clap object)
```

---

### AspectRatioPicker

**Path:** [`src/lib/components/AspectRatioPicker.svelte`](../../src/lib/components/AspectRatioPicker.svelte)

Komponent pro výběr aspect ratio (v ClapEditor).

**Props:**

```svelte
<AspectRatioPicker aspectRatios={["16:9", "4:3", "1:1"]} selected="16:9" onChange={(ratio) => {}} />
```

| Prop           | Type       | Desc              |
| -------------- | ---------- | ----------------- |
| `aspectRatios` | `string[]` | Dostupné poměry   |
| `selected`     | `string`   | Vybraný poměr     |
| `onChange`     | `func`     | Callback na změnu |

---

### ReorderMode

**Path:** [`src/lib/components/ReorderMode.svelte`](../../src/lib/components/ReorderMode.svelte)

Režim přeuspořádání fotek v sekvenci/separátoru.

**Props:**

```svelte
<ReorderMode
  images={items}
  mode="Distribute" | "Reset"
  onApply={(newOrder) => {}}
/>
```

**Modes:**

| Mode           | Description                                  |
| -------------- | -------------------------------------------- |
| `"Distribute"` | Rovnoměrně rozprostřít `releaseDate` po čase |
| `"Reset"`      | Vrátit origami `releaseDate` z EXIF          |

**API calls:**

```ts
POST / api / images / redistribute; // Distribute mode
POST / api / images / reorder; // Reset mode
```

---

## 3. People Management

### PeopleSelectionControls

**Path:** [`src/lib/components/sidebar-content/PeopleSelectionControls.svelte`](../../src/lib/components/sidebar-content/PeopleSelectionControls.svelte)

Controls pro přiřazení osob k vybraným fotkám.

**Props:**

```svelte
<PeopleSelectionControls selectedImageCount={5} onApply={() => {}} />
```

**Features:**

- Multi-select osob z `people.manifest.json`
- Search field (filtrování)
- Avatar thumbnails
- "Apply to selected" button
- Kategorie: person, statue, painting

**Stores:**

```ts
import { manifest } from "$lib/stores/manifest.svelte.js";
import { selectedImageIds } from "$lib/stores/selectedImages.svelte.js";
```

---

### HiddenPersonActions

**Path:** [`src/lib/components/sidebar-content/HiddenPersonActions.svelte`](../../src/lib/components/sidebar-content/HiddenPersonActions.svelte)

Správa skrytých a trash osob.

**Features:**

- Filtrovat podle `hidden: true`
- Filtrovat podle `junk: true`
- Hromadná operace "unhide"
- Trash restore

---

### CategoryPersonCard

**Path:** [`src/lib/components/people/CategoryPersonCard.svelte`](../../src/lib/components/people/CategoryPersonCard.svelte)

Kartička osoby s kategorií a akcemi.

**Props:**

```svelte
<CategoryPersonCard {person} imageCount={42} isSelected={false} />
```

| Prop         | Type      | Desc        |
| ------------ | --------- | ----------- |
| `person`     | `Person`  | Osoba       |
| `imageCount` | `number`  | Počet fotek |
| `isSelected` | `boolean` | Zvolena?    |

**Context menu:**

- Edit (jméno, kategorie)
- Set as avatar
- Merge with other
- Hide/Unhide
- Trash/Restore

---

### MetadataInputField

**Path:** [`src/lib/components/edit/MetadataInputField.svelte`](../../src/lib/components/edit/MetadataInputField.svelte)

Generický input field pro metadata editaci.

**Props:**

```svelte
<MetadataInputField
  label="Title"
  value={image.title}
  type="text" | "textarea" | "number"
  onChange={(val) => {}}
/>
```

**Types:**

- `text` — Single line input
- `textarea` — Multi-line input
- `number` — Numeric input
- `date` — Date picker

---

### GeoDataSection

**Path:** [`src/lib/components/edit/GeoDataSection.svelte`](../../src/lib/components/edit/GeoDataSection.svelte)

Sekce pro editaci geo dat (GPS souřadnice, lokace, město).

**Props:**

```svelte
<GeoDataSection latitude={31.7683} longitude={35.2137} location="Temple Mount" city="Jerusalem" />
```

**Features:**

- Reverzní geocoding (Nominatim)
- Manual input GPS souřadnic
- Location & city autocomplete
- Map preview (integrace s maplib)

**API calls:**

```ts
GET /api/geocode?lat=...&lng=...
```

---

### SelectedImagesBadges

**Path:** [`src/lib/components/SelectedImagesBadges.svelte`](../../src/lib/components/SelectedImagesBadges.svelte)

Indikátor počtu vybraných fotek (floating badge).

**Features:**

- Zobrazuje počet vybraných
- "Clear all" button
- "Select all in view" button
- Animace (fade in/out)

**Stores:**

```ts
import { selectedImageIds } from "$lib/stores/selectedImages.svelte.js";
```

---

## 4. Separator Management

### SeparatorForm

**Path:** [`src/lib/components/edit/SeparatorForm.svelte`](../../src/lib/components/edit/SeparatorForm.svelte)

Formulář pro vytvoření/editaci separátoru.

**Props:**

```svelte
<SeparatorForm separator={sep} onSave={() => {}} isNew={false} />
```

**Fields:**

- Title (required)
- Description (markdown support)
- Start date & time
- End date & time
- Story image selection
- Auto-detection toggle

**API calls:**

```ts
POST / api / separators(create);
PATCH / api / separators / [id](update);
```

---

## 5. Utilities

### Filter Badge

**Path:** [`src/lib/components/filters/FilterBadge.svelte`](../../src/lib/components/filters/FilterBadge.svelte)

Visual badge pro aktivní filtr.

**Features:**

- Zobrazuje typ filtru
- Hodnota (počet/název)
- Click odebere filtr
- Color-coded dle typu

---

### Loading Spinner

**Path:** [`src/lib/components/LoadingSpinner.svelte`](../../src/lib/components/LoadingSpinner.svelte)

Standard spinning loader.

**Props:**

```svelte
<LoadingSpinner size="lg" message="Loading images..." />
```

---

### Error Boundary

**Path:** [`src/lib/components/ErrorBoundary.svelte`](../../src/lib/components/ErrorBoundary.svelte)

Error handling wrapper.

**Features:**

- Catch JS errors v subtree
- Fallback UI
- Log to backend via `/api/log`

---

## Component Hierarchy

```
App.svelte
├── Header
│   └── GallerySelector
├── Sidebar
│   ├── FiltersTab
│   │   ├── FilterBadge (multiple)
│   │   └── FilterControls
│   ├── EditTab
│   │   ├── SelectedImagesBadges
│   │   └── SelectedActions
│   └── PeopleTab
│       ├── PeopleSelectionControls
│       ├── CategoryPersonCard (multiple)
│       └── HiddenPersonActions
├── PhotoGrid
│   ├── PhotoGridSeparator (multiple)
│   │   ├── ReorderMode
│   │   └── StoryModal
│   ├── Lightbox (Fancybox)
│   └── ImageCard (multiple)
└── Modal (edit dialog)
    ├── ClapEditor
    │   └── AspectRatioPicker
    ├── GeoDataSection
    └── MetadataInputField (multiple)
```

---

## Related Documents

- [ARCH-COMPONENTS.md](./ARCH-COMPONENTS.md) — Component architecture
- [ARCH-DATA-FLOW.md](./ARCH-DATA-FLOW.md) — Data flow
- [ARCH-FEATURES.md](./ARCH-FEATURES.md) — Feature documentation

---

_Poslední aktualizace: 2026-01-05_
