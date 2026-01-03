# Quick Start

> Prvních 5 minut s projektem photoblog.

**Requirements:** Node.js 18+ nebo **Bun** (doporučeno)

---

## 1. Instalace

```bash
# Klonovat repo
git clone https://github.com/cebreus/photoblog-israel-2022.git
cd photoblog-israel-2022

# Instalovat dependence (Bun)
bun install

# nebo Node.js:
npm install
```

---

## 2. Dev server

```bash
# Spustit SvelteKit dev server
bun run dev

# Visit: http://localhost:5173
```

---

## 3. Vytvořit novou galerii

```bash
# Zkopírovat template
cp -r content/_test content/egypt-2025

# Přidat fotky
mkdir -p content/egypt-2025/pics
cp your-photos/*.heic content/egypt-2025/pics/

# Vygenerovat manifesty a procházet fotky
bun scripts/manage.ts process:images --gallery egypt-2025

# Sestavit (build images, detect faces, create thumbnails)
bun run build
```

Detaily: [ADD-GALLERY.md](./ADD-GALLERY.md)

---

## 4. Editace v dev režimu

Dev mode aktivace v `.env`:

```bash
cp .env.example .env
# Edit: DEV_MODE=true
```

**Features:**

- Inline editace (fotky, osoby, separátory)
- Drag-drop přeřazení
- Face detection & clustering UI
- CLAP editor (HEIC ořezy)

Návštěvit sidebar "Editace" tab → klikněte na fotky pro inline edit.

---

## 5. Běžné příkazy

```bash
# Build
bun run build

# Test (Vitest + Playwright)
bun run test                # Všechny testy
bun run test:client        # Client-side only
bun run test:integration   # API & build integration

# Lint & format
bun run check              # Type-check (svelte-check)
bun run format             # Prettier

# Clean slate
bun run clean              # Remove build artifacts
bun run clean:all          # Remove node_modules, cache
```

Detaily: [SCRIPTS.md](./SCRIPTS.md)

---

## 6. Struktura

```
src/
  ├── routes/             # Pages + API endpoints (19)
  │   ├── +page.svelte    # Main gallery view
  │   ├── +layout.svelte  # App layout
  │   └── api/            # REST endpoints
  ├── lib/
  │   ├── components/     # Svelte UI components
  │   ├── stores/         # Svelte 5 $state stores
  │   └── utils/          # Utilities (filter, sort, gallery)
  └── app.html            # Root HTML

content/
  ├── [gallery]/          # Per-gallery folder
  │   ├── pics/           # HEIC/JPEG source photos
  │   ├── locations/      # Separators (markdown)
  │   ├── maps/           # KML/GPX files
  │   └── pics.manifest.json
  └── _test/              # Template gallery

scripts/
  ├── manage.ts           # Main CLI
  ├── lib/                # Helper modules
  └── models/             # ML weights (TensorFlow)

static/
  └── [gallery]/          # Built (processed images)
```

Detaily: [ARCH-STRUCTURE.md](./ARCH-STRUCTURE.md)

---

## 7. Klíčové koncepty

### Stores (Svelte 5)

```svelte
<script>
  import { filters } from "$lib/stores/filters.svelte";
  import { selectedImageIds } from "$lib/stores/selectedImages.svelte";
</script>

<button on:click={() => selectedImageIds.add("IMG_001")}>
  Select {selectedImageIds.size} images
</button>
```

### API endpointy

```ts
// Update metadata
POST /api/images { updates: [ { id, author, caption, ... } ] }

// Reorder photos (change releaseDate)
POST /api/images/reorder { dayId, moves: [ { imageId, targetIndex } ] }

// Edit person
PATCH /api/people { updates: [ { id, name, hidden } ] }
```

Detaily: [API-REFERENCE.md](./API-REFERENCE.md)

### Separators (Location groups)

```markdown
## <!-- content/egypt-2025/locations/nazareth.md -->

title: Nazareth
startDate: 2022-10-20T10:00:00
endDate: 2022-10-20T17:00:00
storyImageId: IMG_001

---

Temple of the Annunciation.
```

Fotky v rozmezí startDate-endDate jsou seskupeny pod tímto separátorem.

Detaily: [SEPARATOR_ARCHITECTURE_ANALYSIS.md](./SEPARATOR_ARCHITECTURE_ANALYSIS.md)

### Sequences (10-minute groups)

Fotky pořízené v rozmezí **10 minut** na **stejné lokaci** (EXIF GPS) se automaticky seskupují do sekvence.

---

## 8. Dev Mode Features

Zapnout `DEV_MODE=true` v `.env`:

```bash
# Edit & delete images
Click image → "Edit" → Change title, author, keywords, GPS

# Reorder photos
Right-click separator → "Reorder" → Drag or use distribute/reset

# Edit people
Sidebar → People tab → Click person → Edit/merge/hide

# CLAP editor (HEIC crop)
Click image → "Edit" → "CLAP" tab → Rectangle crop + aspect ratio lock
```

---

## 9. Build & Optimization

SvelteKit + Vite build:

```bash
bun run build
# → .svelte-kit/ (SvelteKit artifacts)
# → static/[gallery]/ (processed images)

# Output:
# ✓ Images (AVIF, WebP, JPEG variants)
# ✓ Thumbnails (lazy-loaded)
# ✓ Manifests (JSON metadata)
# ✓ Face embeddings (TensorFlow)
```

---

## 10. Troubleshooting

| Issue                    | Solution                               |
| ------------------------ | -------------------------------------- |
| Port 5173 already in use | `bun run dev -- --port 3000`           |
| Images not loading       | `bun run clean && bun run build`       |
| Type errors              | `bun run check`                        |
| Tests fail               | `bun run test -- --reporter=verbose`   |
| Git conflicts            | Resolve in code, then `bun run format` |

---

## Next Steps

1. **New to project?** → Read [ARCHITECTURE.md](./ARCHITECTURE.md) (10 min)
2. **Add gallery?** → See [ADD-GALLERY.md](./ADD-GALLERY.md)
3. **Modify components?** → Check [ARCH-COMPONENTS.md](./ARCH-COMPONENTS.md)
4. **Deploy?** → Follow [ARCH-DEPLOY.md](./ARCH-DEPLOY.md)
5. **Full docs?** → Navigate [INDEX.md](./INDEX.md)

---

_Poslední aktualizace: 2026-01-05_
