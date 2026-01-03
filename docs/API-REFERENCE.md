# API Reference

> Kompletní seznam API endpointů pro správu galerií.

**Navigace:** [← INDEX](./INDEX.md) | [ARCHITECTURE →](./ARCHITECTURE.md) | [ARCH-STRUCTURE →](./ARCH-STRUCTURE.md)

## Obsah

1. [Image Management](#1-image-management)
2. [Sorting & Reordering](#2-sorting--reordering)
3. [People Management](#3-people-management)
4. [Collage Management](#4-collage-management)
5. [Utilities](#5-utilities)
6. [Error Handling](#6-error-handling)

---

## 1. Image Management

### DELETE `/api/images`

Smazat obrázek(y) z galerie.

**Method:** `DELETE`

**Auth:** Dev mode only

**Request:**

```json
{
  "imageIds": ["IMG_001", "IMG_002"],
  "contentDir": "egypt-2025"
}
```

**Response:**

```json
{
  "success": true,
  "deleted": ["IMG_001", "IMG_002"],
  "errors": []
}
```

**Side effects:**

- Fyzické soubory odstraněny ze `static/<gallery>/images/`
- Manifest aktualizován (imageId odstraněn)
- Sekvence updated (pokud byly členy)
- Cache invalidován

---

### POST `/api/images`

Hromadná editace metadat obrázků.

**Method:** `POST`

**Auth:** Dev mode only

**Request:**

```json
{
  "updates": [
    {
      "id": "IMG_001",
      "author": "John Doe",
      "keywords": "egypt,temple",
      "caption": "Temple at Luxor"
    }
  ],
  "contentDir": "egypt-2025"
}
```

**Response:**

```json
{
  "success": true,
  "updated": 1,
  "results": [
    {
      "id": "IMG_001",
      "success": true
    }
  ]
}
```

**Updated fields:**

- `author`, `keywords`, `caption`, `title`, `description`
- `latitude`, `longitude`, `location`, `city`
- `copyright`, `category`

---

### PATCH `/api/images`

Hromadná editace metadat s CLAP (Clean Aperture) podporou.

**Method:** `PATCH`

**Auth:** Dev mode only

**Request:**

```json
{
  "updates": [
    {
      "id": "IMG_001",
      "clap": {
        "width": 2500,
        "height": 1800,
        "horizOffset": 0,
        "vertOffset": 100
      },
      "author": "Jane Doe"
    }
  ],
  "contentDir": "egypt-2025"
}
```

**Response:**

```json
{
  "success": true,
  "updated": 1,
  "results": [
    {
      "id": "IMG_001",
      "success": true,
      "clapWritten": true
    }
  ]
}
```

**CLAP handling:**

- Parsuje CLAP atom z HEIC souboru
- Transformuje na user-space souřadnice (po EXIF rotaci)
- Zapisuje zpět via ExifTool
- Triggerovauzuje image regeneraci (variant cropping)

---

### GET `/api/images/clap-preview`

Náhled CLAP ořezu před aplikací.

**Method:** `GET`

**Query params:**

```
GET /api/images/clap-preview?imageId=IMG_001&variant=detail&width=2500&height=1800
```

| Param     | Type   | Desc                                          |
| --------- | ------ | --------------------------------------------- |
| `imageId` | string | Image ID (required)                           |
| `variant` | string | Variant to preview: `default`, `xl`, `detail` |
| `width`   | number | Preview width (px)                            |
| `height`  | number | Preview height (px)                           |

**Response:**

```json
{
  "src": "/static/egypt-2025/images/IMG_001.avif",
  "width": 2500,
  "height": 1800,
  "format": "avif",
  "clap": {
    "width": 2500,
    "height": 1800,
    "horizOffset": 0,
    "vertOffset": 100
  }
}
```

---

## 2. Sorting & Reordering

### POST `/api/images/reorder`

Změnit pořadí fotek v rámci jednoho dne (změní `releaseDate`).

**Method:** `POST`

**Auth:** Dev mode only

**Request:**

```json
{
  "dayId": "d1",
  "moves": [
    {
      "imageId": "IMG_001",
      "targetIndex": 0
    },
    {
      "imageId": "IMG_002",
      "targetIndex": 1
    }
  ],
  "contentDir": "egypt-2025"
}
```

**Response:**

```json
{
  "success": true,
  "relocated": 2,
  "relocations": {
    "IMG_001": {
      "oldReleaseDate": "2022-10-20T10:00:00",
      "newReleaseDate": "2022-10-20T09:58:00"
    },
    "IMG_002": {
      "oldReleaseDate": "2022-10-20T10:01:00",
      "newReleaseDate": "2022-10-20T09:59:00"
    }
  }
}
```

**Algorithm (Time Slot Swapping):**

1. Seřadí fotky podle `targetIndex`
2. Vypočítá `releaseDate` pro každou aby respektovaly pořadí
3. ExifTool zapisuje `XMP:ReleaseDate` do souborů
4. Manifest aktualizován

**Sequences:** Pokud jsou všichni členové v jedné sekvenci, všichni dědí nový `releaseDate` reprezentanta.

---

### POST `/api/images/swap-time`

Prohodit `releaseDate` mezi dvěma fotkami/sekvencemi.

**Method:** `POST`

**Auth:** Dev mode only

**Request:**

```json
{
  "dayId": "d1",
  "imageIds": ["IMG_001", "IMG_002"],
  "contentDir": "egypt-2025"
}
```

**Response:**

```json
{
  "success": true,
  "swapped": 2,
  "changes": {
    "IMG_001": {
      "oldReleaseDate": "2022-10-20T10:00:00",
      "newReleaseDate": "2022-10-20T10:05:00"
    },
    "IMG_002": {
      "oldReleaseDate": "2022-10-20T10:05:00",
      "newReleaseDate": "2022-10-20T10:00:00"
    }
  }
}
```

**Behavior:**

- Swapují `releaseDate` hodnoty
- Funguje na sekvencích: swapují reprezentanty
- Všichni sekvence členové dědí nový čas reprezentanta

---

### POST `/api/images/redistribute`

Rovnoměrně rozprostřít fotky v čase separátoru (location).

**Method:** `POST`

**Auth:** Dev mode only

**Request:**

```json
{
  "dayId": "d1",
  "location": "Nazareth",
  "contentDir": "egypt-2025"
}
```

**Response:**

```json
{
  "success": true,
  "distributed": 5,
  "relocations": {
    "IMG_001": { "newReleaseDate": "2022-10-20T10:00:00" },
    "IMG_002": { "newReleaseDate": "2022-10-20T10:12:00" },
    "IMG_003": { "newReleaseDate": "2022-10-20T10:24:00" },
    "IMG_004": { "newReleaseDate": "2022-10-20T10:36:00" },
    "IMG_005": { "newReleaseDate": "2022-10-20T10:48:00" }
  }
}
```

**Algorithm:**

1. Načte separator startDate/endDate (z markdown)
2. Spočítá počet fotek
3. Vypočítá rovnoměrný interval: `(endTime - startTime) / photoCount`
4. Přiřadí nový `releaseDate` každé fotce

---

## 3. People Management

### PATCH `/api/people`

Hromadná editace dat osob (jméno, kategorie, skrytí, trash).

**Method:** `PATCH`

**Auth:** Dev mode only

**Request:**

```json
{
  "updates": [
    {
      "id": "person-001",
      "name": "Alice Smith",
      "hidden": false,
      "junk": false,
      "category": "person"
    }
  ],
  "contentDir": "egypt-2025"
}
```

**Response:**

```json
{
  "success": true,
  "updated": 1,
  "results": [
    {
      "id": "person-001",
      "success": true
    }
  ]
}
```

**Categories:**

- `"person"` — Normální osoba
- `"statue"` — Socha/umělecké dílo
- `"painting"` — Obraz

---

### POST `/api/people/merge`

Sloučit dvě osoby do jedné.

**Method:** `POST`

**Auth:** Dev mode only

**Request:**

```json
{
  "sourcePersonId": "person-001",
  "targetPersonId": "person-002",
  "contentDir": "egypt-2025"
}
```

**Response:**

```json
{
  "success": true,
  "mergedIds": 42,
  "sourcePersonId": "person-001",
  "targetPersonId": "person-002"
}
```

**Side effects:**

- Všechny reference `person-001` → `person-002`
- Fotky updated (ljudi array)
- `person-001` smazána z `people.manifest.json`
- Faces updated

---

### POST `/api/people/reassign`

Přeřadit fotku/skupinu fotek jiné osobě.

**Method:** `POST`

**Auth:** Dev mode only

**Request:**

```json
{
  "imageIds": ["IMG_001", "IMG_002"],
  "targetPersonId": "person-002",
  "contentDir": "egypt-2025"
}
```

**Response:**

```json
{
  "success": true,
  "reassigned": 2
}
```

---

### POST `/api/people/unmatch`

Odpárovat obrázek od osoby (odebrat z `people` array).

**Method:** `POST`

**Auth:** Dev mode only

**Request:**

```json
{
  "imageId": "IMG_001",
  "personId": "person-001",
  "contentDir": "egypt-2025"
}
```

**Response:**

```json
{
  "success": true,
  "unmatched": true
}
```

---

### POST `/api/people/set-avatar`

Nastavit avatar osoby (používá tento image pro thumbnail).

**Method:** `POST`

**Auth:** Dev mode only

**Request:**

```json
{
  "personId": "person-001",
  "imageId": "IMG_001",
  "contentDir": "egypt-2025"
}
```

**Response:**

```json
{
  "success": true,
  "avatarSet": "IMG_001"
}
```

---

### GET `/api/people/avatars`

Seznam všech avatarů osob (pro cache).

**Method:** `GET`

**Response:**

```json
{
  "avatars": {
    "person-001": "IMG_001",
    "person-002": "IMG_005"
  }
}
```

---

### GET `/api/people/invalid-detections`

Seznam neplatných face detections (user-marked).

**Method:** `GET`

**Response:**

```json
{
  "invalidDetections": [
    {
      "imageId": "IMG_001",
      "faceIndex": 0
    }
  ]
}
```

---

### POST `/api/people/invalidate-detection`

Označit face detection jako neplatné (false positive).

**Method:** `POST`

**Auth:** Dev mode only

**Request:**

```json
{
  "imageId": "IMG_001",
  "faceIndex": 0,
  "contentDir": "egypt-2025"
}
```

---

### DELETE `/api/people/invalid-detections/clear`

Vymazat všechny neplatné detections.

**Method:** `DELETE`

**Auth:** Dev mode only

---

## 4. Collage Management

### POST `/api/images/collage`

Vytvořit koláž z vybraných obrázků.

**Method:** `POST`

**Auth:** Dev mode only

**Request:**

```json
{
  "sourceImageIds": ["IMG_001", "IMG_002", "IMG_003"],
  "layout": "grid-2x2",
  "fileName": "collage-001",
  "contentDir": "egypt-2025"
}
```

**Response:**

```json
{
  "success": true,
  "collageImageId": "IMG_collage_001",
  "fileName": "IMG_collage_001.jpeg",
  "src": "/images/egypt-2025/IMG_collage_001.jpeg"
}
```

**Side effects:**

- Nový obrázek vygenerován
- Manifest updated (typ = `"collage"`)
- Zdrojové obrázky označeny `category: "collage-source"` (skryté)
- Koláž dědí `people` tagy od zdrojů
- Koláž dědí `releaseDate` od reprezentanta

---

### GET `/api/collage-sources`

Metadata zdrojových obrázků pro koláž.

**Method:** `GET`

**Query params:**

```
GET /api/collage-sources?ids=IMG_001,IMG_002,IMG_003
```

**Response:**

```json
{
  "sources": [
    {
      "id": "IMG_001",
      "width": 3000,
      "height": 2000,
      "format": "jpeg"
    }
  ]
}
```

---

## 5. Utilities

### GET `/api/geocode`

Reverzní geocoding (Nominatim API proxy).

**Method:** `GET`

**Query params:**

```
GET /api/geocode?lat=31.7683&lng=35.2137
```

**Response:**

```json
{
  "address": {
    "city": "Bethlehem",
    "county": "West Bank",
    "country": "Palestine"
  },
  "country": {
    "code": "PS",
    "name": "Palestine"
  }
}
```

**Note:** Dev mode only

---

### POST `/api/log`

Frontend logging relay (ze Svelte do Pino loggeru).

**Method:** `POST`

**Request:**

```json
{
  "level": 30,
  "msg": "User clicked button",
  "label": "frontend",
  "context": { "buttonId": "filter-submit" }
}
```

**Response:**

```json
{
  "success": true
}
```

**Levels:**

- `10` = TRACE
- `20` = DEBUG
- `30` = INFO
- `40` = WARN
- `50` = ERROR
- `60` = FATAL

---

### GET `/api/files/[...filepath]`

Proxy pro originální soubory z `content/`.

**Method:** `GET`

**Example:**

```
GET /api/files/egypt-2025/pics/IMG_001.heic
```

**Response:**

- Binary HEIC/JPEG soubor
- Cache headers: `Cache-Control: max-age=31536000`

---

## 6. Error Handling

### Error Response Format

```json
{
  "success": false,
  "error": "Image not found",
  "code": "IMAGE_NOT_FOUND",
  "details": {
    "imageId": "IMG_999"
  }
}
```

### Common Error Codes

| Code                | Status | Meaning                         |
| ------------------- | ------ | ------------------------------- |
| `IMAGE_NOT_FOUND`   | 404    | Image ID nebyl nalezen          |
| `PERSON_NOT_FOUND`  | 404    | Person ID nebyla nalezena       |
| `INVALID_REQUEST`   | 400    | Malformovaný request            |
| `MANIFEST_LOCKED`   | 409    | Build probíhá, manifest locked  |
| `DEV_MODE_ONLY`     | 403    | Endpoint vyžaduje dev mode      |
| `INVALID_METADATA`  | 422    | Metadata selhala validaci       |
| `EXIF_WRITE_FAILED` | 500    | ExifTool nemohl zapsat metadata |

---

## Related Documents

- [ARCH-STRUCTURE.md](./ARCH-STRUCTURE.md) — API routes file structure
- [ARCH-DATA-FLOW.md](./ARCH-DATA-FLOW.md) — Data flow diagrams
- [SCRIPTS.md](./SCRIPTS.md) — Build scripts

---

_Poslední aktualizace: 2026-01-05_
