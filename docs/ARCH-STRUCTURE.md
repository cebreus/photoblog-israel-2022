# Struktura projektu

> Mapování adresářů a organizace kódu.

**Navigace:** [← INDEX](./INDEX.md) | [ARCHITECTURE →](./ARCHITECTURE.md)

## Obsah

- [Struktura projektu](#struktura-projektu)
  - [Obsah](#obsah)
  - [1. Hlavní adresáře](#1-hlavní-adresáře)
  - [2. Content Layer](#2-content-layer)
    - [site.md](#sitemd)
  - [3. Application Layer](#3-application-layer)
    - [SvelteKit konvence](#sveltekit-konvence)
    - [API endpointy](#api-endpointy)
  - [4. Scripts Layer](#4-scripts-layer)
    - [Shared Layer](#shared-layer)
  - [Související dokumenty](#související-dokumenty)

## 1. Hlavní adresáře

```
photoblog/
├── content/              # Zdrojový obsah (obrázky, markdown)
├── shared/               # Typy a utility sdílené mezi build + runtime
├── scripts/              # Build-time skripty (image processing)
├── src/                  # SvelteKit aplikace
├── static/               # Generované assety (obrázky, favicons)
├── tests/                # Testovací soubory
└── docs/                 # Dokumentace
```

## 2. Content Layer

Obsah je oddělen od aplikace → umožňuje sdílení mezi verzemi.

```
content/<CONTENT_DIR>/
├── pics/                 # Originální JPEG/PNG/HEIC
│   ├── 2022-03-21/       # Organizace podle data
│   │   ├── IMG_0001.jpg
│   │   └── story.md      # Volitelný příběh dne
│   └── ...
├── site.md               # Konfigurace galerie
└── favicons-source.png   # Zdroj pro favicon
```

### site.md

```yaml
---
title: Název galerie
description: Popis pro SEO
ogTitle: Open Graph název
faviconEmoji: 🌍
locale: cs-CZ
---
```

## 3. Application Layer

```
src/
├── routes/               # SvelteKit file-based routing
│   ├── +layout.server.ts # Server-side data load
│   ├── +layout.svelte    # Layout komponenta
│   ├── +page.svelte      # Homepage
│   └── api/              # API endpointy
│
├── lib/
│   ├── components/       # Svelte komponenty
│   │   ├── Hero.svelte
│   │   ├── PhotoGrid.svelte
│   │   ├── AppSidebar.svelte
│   │   └── ui/           # Shadcn-svelte komponenty
│   ├── stores/           # Svelte 5 stores (runes)
│   ├── types/            # TypeScript typy
│   ├── utils/            # Utility funkce
│   └── actions/          # Svelte actions
│
├── data/<CONTENT_DIR>/   # Generované manifesty
│   ├── images.manifest.json
│   ├── analysis.manifest.json
│   ├── faces.manifest.json
│   └── ...
│
├── app.html              # HTML šablona
└── app.css               # Globální styly (Tailwind)
```

### SvelteKit konvence

| Soubor            | Účel                     |
| ----------------- | ------------------------ |
| `+page.svelte`    | Stránka                  |
| `+page.server.ts` | Server-side data loading |
| `+layout.svelte`  | Layout obalující stránky |
| `+server.ts`      | API endpoint             |
| `+error.svelte`   | Error stránka            |

### API endpointy

**Poznámka:** Většina mutačních endpointů (`POST`, `PATCH`, `DELETE`) je dostupná pouze v DEV módu (`dev === true`).

| Endpoint                               | Metody                    | Účel                                                   |
| -------------------------------------- | ------------------------- | ------------------------------------------------------ |
| `/api/collage-sources`                 | `GET`                     | Metadata zdrojových obrázků kolážií (collage-sources/) |
| `/api/files/[...filepath]`             | `GET`                     | Proxy pro originální soubory z content/                |
| `/api/geocode`                         | `GET`                     | Reverse geocoding (Nominatim API proxy, pouze DEV)     |
| `/api/images`                          | `DELETE`, `POST`, `PATCH` | Smazání, duplikace, hromadná editace metadat obrázků   |
| `/api/images/clap-preview`             | `GET`                     | Preview CLAP videa podle query parametrů               |
| `/api/images/collage`                  | `POST`                    | Vytvoření koláže z vybraných obrázků                   |
| `/api/images/reorder`                  | `PATCH`                   | Změna pořadí obrázků v rámci dne                       |
| `/api/images/reorder`                  | `DELETE`                  | Reset pořadí dne na EXIF časy (ReleaseDate = DateTime) |
| `/api/images/redistribute`             | `POST`                    | Přesun obrázků mezi dny (změna wallclock času)         |
| `/api/images/swap-time`                | `POST`                    | Prohození časů dvou obrázků                            |
| `/api/log`                             | `POST`                    | Frontend logging (relay FE → BE Pino)                  |
| `/api/people`                          | `PATCH`                   | Hromadná editace osob (name, hidden, junk, category)   |
| `/api/people/avatars`                  | `GET`                     | Seznam avatarů všech osob                              |
| `/api/people/invalid-detections`       | `GET`                     | REMOVED (legacy) — odstraněno 2026-01-06               |
| `/api/people/invalid-detections/clear` | `DELETE`                  | REMOVED (legacy) — odstraněno 2026-01-06               |
| `/api/people/invalidate-detection`     | `POST`                    | Označení detekce obličeje jako neplatné                |
| `/api/people/constraints`              | `GET`, `DELETE`           | Čtení a mazání constraintů pro clustering              |
| `/api/people/run-clustering`           | `POST`                    | Spuštění re-analýzy shlukování obličejů (DEV)          |
| `/api/system/events`                   | `GET`                     | Server-Sent Events stream systémových událostí (DEV)   |
| `/api/people/merge`                    | `POST`                    | Sloučení více osob do jedné                            |
| `/api/people/reassign`                 | `POST`                    | Přeřazení obrázků osobě (změna přiřazení)              |
| `/api/people/set-avatar`               | `POST`                    | Nastavení avataru osoby                                |
| `/api/people/unmatch`                  | `POST`                    | Odpárování obrázku od osoby                            |

## 4. Scripts Layer

```
scripts/
├── manage.ts             # Hlavní CLI entry point
├── generate-images.ts    # Image variant generation
├── face-clustering.ts    # Face detection & clustering
├── build.config.ts       # Build konfigurace
│
└── lib/
    ├── core/             # CLI infrastruktura (logger, parser)
    ├── image/            # Image processing (processor, generator)
    ├── faces/            # Face detection & people management
    ├── manifests/        # Manifest operations (builder, repository)
    ├── gallery/          # Gallery operations (migration, cleanup)
    ├── ai/               # AI/ML modely
    └── utils/            # Generic utilities
```

### Shared Layer

```
shared/
├── types/
│   ├── images.ts         # ImageFormat, Variant, Quality
│   └── manifest.ts       # ImageEntry, Person, Manifest
│
└── utils/
    ├── dates.ts          # formatWallClock(), toPureWallClockISO()
    ├── strings.ts        # toSlug(), isCollage()
    └── sequences.ts      # Sequence parsing
```

**Pravidlo:** `scripts/` a `src/` mohou importovat ze `shared/`, ale nikdy ze sebe navzájem.

## Související dokumenty

- [INDEX.md](./INDEX.md) — Rozcestník dokumentace
- [ARCHITECTURE.md](./ARCHITECTURE.md) — Hlavní přehled
- [ARCH-BUILD.md](./ARCH-BUILD.md) — Build proces a skripty
- [ARCH-DATA-FLOW.md](./ARCH-DATA-FLOW.md) — Toky manifestů a cache
- [SCRIPTS.md](./SCRIPTS.md) — Reference CLI příkazů

---

_Poslední aktualizace: 2026-01-06_
