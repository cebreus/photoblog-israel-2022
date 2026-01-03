# Deployment

> Nasazení a CI/CD pipeline.

## Obsah

1. [Strategie](#1-strategie)
2. [Build výstup](#2-build-výstup)
3. [CI/CD](#3-cicd)

## 1. Strategie

Projekt je navržen jako **Static Site Generation (SSG)**.

### Možnosti hostingu

| Platforma        | Typ            | Poznámka   |
| ---------------- | -------------- | ---------- |
| Vercel           | Push-to-deploy | Doporučeno |
| Netlify          | Push-to-deploy | –          |
| Cloudflare Pages | Push-to-deploy | –          |
| GitHub Pages     | Statický       | –          |
| Apache/Nginx     | Tradiční       | –          |

## 2. Build výstup

### Struktura

```
build-<gallery>/
├── index.html          # Pre-rendered homepage
├── _app/
│   └── immutable/
│       ├── chunks/     # JS bundles
│       ├── entry/      # Entry points
│       └── assets/     # CSS
├── images/             # Optimalizované fotky
└── assets/
    └── favicons/       # Favicon variants
```

### Příkazy

```bash
# Interaktivní výběr galerie
pnpm build

# Konkrétní galerie
pnpm build -- -g egypt-2025

# Výstup do custom adresáře
OUTPUT_DIR=dist pnpm build
```

## 3. CI/CD

### GitHub Actions

```yaml
name: Build & Deploy

on:
  push:
    branches: [main]

jobs:
  build:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v4

      - name: Setup Bun
        uses: oven-sh/setup-bun@v1

      - name: Install libvips
        run: sudo apt-get install -y libvips

      - name: Install dependencies
        run: bun install

      - name: Run tests
        run: bun run test
        env:
          SHARP_NUM_THREADS: 1
          CONTENT_DIR: egypt-2025

      - name: Build
        run: bun run build -- -g egypt-2025

      - name: Deploy to Vercel
        uses: amondnet/vercel-action@v25
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          vercel-org-id: ${{ secrets.ORG_ID }}
          vercel-project-id: ${{ secrets.PROJECT_ID }}
```

### Klíčová nastavení

| Proměnná            | Hodnota     | Účel                     |
| ------------------- | ----------- | ------------------------ |
| `SHARP_NUM_THREADS` | `1`         | Deterministické výstupy  |
| `TZ`                | `UTC`       | Konzistence časových zón |
| `CONTENT_DIR`       | `<gallery>` | Aktivní galerie          |

### Artifacts

```yaml
- name: Upload artifacts on failure
  if: failure()
  uses: actions/upload-artifact@v3
  with:
    name: test-outputs
    path: tests/outputs/
```

## Související dokumenty

- [ARCHITECTURE.md](./ARCHITECTURE.md) — Hlavní přehled
- [ARCH-BUILD.md](./ARCH-BUILD.md) — Build proces
- [TESTING.md](./TESTING.md) — Testování

---

_Poslední aktualizace: 2026-01-03_
