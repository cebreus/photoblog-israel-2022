# Struktura projektu

> Mapování adresářů a organizace kódu.

## Obsah

1. [Hlavní adresáře](#1-hlavní-adresáře)
2. [Content Layer](#2-content-layer)
3. [Application Layer](#3-application-layer)
4. [Scripts Layer](#4-scripts-layer)

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

- [ARCHITECTURE.md](./ARCHITECTURE.md) — Hlavní přehled
- [ARCH-BUILD.md](./ARCH-BUILD.md) — Build proces a skripty
- [SCRIPTS.md](./SCRIPTS.md) — Reference CLI příkazů

---

_Poslední aktualizace: 2026-01-03_
