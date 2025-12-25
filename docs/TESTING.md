# Testování v projektu Photoblog

Tento dokument slouží jako průvodce pro vývojáře, jak psát a spouštět testy v tomto projektu.

## Přehled

Projekt je **multi-gallery fotoblog** běžící na **Bun runtime**. Testování zahrnuje jak backend skripty pro generování obrázků, tak frontend Svelte 5 komponenty s podporou browseru.

**📖 Pro detailní dokumentaci testovací architektury viz [`tests/README.md`](../tests/README.md)**

## Strategie testování

Projekt využívá vícevrstvou pyramidu testů:

1. **Unit Testy:** Testují izolovanou byznys logiku (backend skripty, utility funkce, transformace dat). Běží v Node.js/Bun prostředí.
2. **Component Testy:** Testují UI komponenty Svelte v reálném (headless) prohlížeči pomocí **Vitest Browser Mode**. Ověřují rendering, interakci a integraci s reaktivním stavem (stores).
3. **Integration Testy:** Testují kompletní flow (ScrollSpy, API endpoints) nebo image generation pipeline.
4. **E2E Testy:** Testují celou aplikaci z pohledu uživatele pomocí Playwright.

---

## Struktura testů

```
tests/
├── unit/                       # Rychlé unit testy (Node.js/jsdom)
│   ├── core/                   # Doménová logika (image processing, faces, manifests)
│   ├── stores/                 # Svelte stores logika
│   └── features/               # Pomocné funkce (URL sync, utils)
│
├── components/                 # Komponentové testy (Browser Mode)
│   └── AgendaTab.component.spec.ts
│
├── integration/                # Integrační testy
│   ├── flow-scrollspy/        # Browser Mode - reálné scrollování
│   └── api/                   # Node.js - API endpoint testy
│
├── e2e/                        # End-to-End testy (Playwright)
│   └── *.spec.ts
│
├── fixtures/                   # Testovací data
│   ├── manifests.ts
│   ├── people.ts
│   └── observers.ts
│
└── setup/                      # Globální konfigurace
    ├── browser.ts             # Browser Mode setup
    └── server.ts              # Node.js/jsdom setup
```

---

## Jak spouštět testy

Všechny příkazy používají `bun`.

### Unit Testy

Unit testy ověřují jednotlivé funkce a utility. Jsou umístěny v `tests/unit/`.

```bash
# Všechny unit testy
bun run test:unit

# Konkrétní projekt
bun run vitest run --project unit-core
bun run vitest run --project unit-dom
```

### Component Testy (Vitest Browser Mode)

Spustí testy UI komponent v headless Chromium. **Vyžadují nastavenou proměnnou `CONTENT_DIR`** pro správné fungování aliasů a načtení manifestů.

```bash
CONTENT_DIR=egypt-2025 bun run vitest run --project client
```

### Integration Testy

```bash
# API testy
bun run vitest run --project integration-api

# Browser integration (ScrollSpy)
bun run vitest run --project browser-integration

# Image processing pipeline
bun run test:images
```

### E2E Testy (Playwright)

Spustí end-to-end testy v reálném prohlížeči:

```bash
bun run test:e2e
```

### Všechny testy

```bash
bun run test
```

---

## Psaní testů

### 1. Unit Testy

**Kdy použít:**

- Čisté funkce (pure functions)
- Transformace dat
- Matematické výpočty
- Store logika (bez UI)

**Příklad:**

```typescript
// tests/unit/core/utils/strings.unit.spec.ts
import { describe, expect, it } from "vitest";

import { toSlug } from "$lib/utils/strings";

describe("toSlug", () => {
  it("converts text to slug", () => {
    expect(toSlug("Hello World")).toBe("hello-world");
  });
});
```

### 2. Component Testy (Browser Mode)

**Kdy použít:**

- Testování Svelte komponent
- Interakce vyžadující reálné DOM API
- Ověření vykreslení a struktury

**Klíčové:**

- Používejte `render` z `vitest-browser-svelte`
- Používejte `page` z `vitest/browser` pro locatory
- Mockujte pouze stores a API, ne DOM komponenty

**Příklad:**

```typescript
// tests/components/AgendaTab.component.spec.ts
import { describe, expect, it, vi } from "vitest";
import { render } from "vitest-browser-svelte";
import { page } from "vitest/browser";

import AgendaTab from "$lib/components/sidebar-content/AgendaTab.svelte";

// Mock UI store
const mockActiveSections = new Set<string>();
vi.mock("$lib/stores/ui.svelte", () => ({
  ui: {
    get activeSections() {
      return mockActiveSections;
    },
  },
}));

describe("AgendaTab", () => {
  it("renders menu items", async () => {
    render(AgendaTab, { props: { menuItems: mockData } });

    await expect.element(page.getByText("24. listopadu")).toBeInTheDocument();
  });
});
```

**Spuštění s CONTENT_DIR:**

```bash
CONTENT_DIR=egypt-2025 bun run vitest run --project client
```

### 3. Integration Testy

#### Browser Integration (reálný DOM)

Pro testy vyžadující reálný layout engine (ScrollSpy, IntersectionObserver):

```typescript
// tests/integration/flow-scrollspy/scrollspy.spec.ts
import { describe, expect, it } from "vitest";
import { render } from "vitest-browser-svelte";
import { page } from "vitest/browser";

import ScrollSpyTestSubject from "./ScrollSpyTestSubject.svelte";

describe("ScrollSpy Integration", () => {
  it("updates activeSections when scrolling", async () => {
    render(ScrollSpyTestSubject);

    document.getElementById("section-1")?.scrollIntoView();
    await new Promise((resolve) => setTimeout(resolve, 200)); // Wait for observer

    const activeSections = page.getByTestId("active-sections");
    await expect.element(activeSections).toHaveTextContent("section-1");
  });
});
```

#### API Integration (Node.js)

Pro testování API endpoints:

```typescript
// tests/integration/api/people-api.spec.ts
describe("People API", () => {
  it("updates person name", async () => {
    const response = await fetch("/api/people", {
      method: "PATCH",
      body: JSON.stringify({ updates: [{ id: "alice", name: "Alice Smith" }] }),
    });

    expect(response.ok).toBe(true);
  });
});
```

### 4. E2E Testy (Playwright)

Pro smoke testy a kritické user flow:

```typescript
// tests/e2e/smoke-navigation.spec.ts
import { expect, test } from "@playwright/test";

test("loads main page and displays photos", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveTitle(/Fotoblog/);

  const photos = page.locator("[data-testid='photo-grid-item']");
  await expect(photos.first()).toBeVisible();
});
```

---

## Rozhodovací matice

| Kritérium                 | Unit (Node/jsdom) | Browser Mode          | Playwright E2E        |
| ------------------------- | ----------------- | --------------------- | --------------------- |
| **Závislost na layoutu?** | ❌ Nikdy          | ✅ ANO                | ✅ ANO                |
| **Potřeba reálného DOM?** | ❌ Simulace       | ✅ Reálný             | ✅ Reálný             |
| **Rychlost**              | 🚀 < 50ms         | 🚗 ~500ms             | 🐢 > 2s               |
| **Použití**               | Logika, utils     | Komponenty, ScrollSpy | Smoke, Critical paths |

---

## Časté problémy a řešení

### "Invalid Chai property: toHaveText"

**Problém:** Chybí matcher z `@vitest/browser`.

**Řešení:** Použijte `toHaveTextContent` nebo přidejte `vitest-setup-client.ts` do setupFiles.

### "IntersectionObserver is not defined" (jsdom)

**Problém:** jsdom nepodporuje IntersectionObserver.

**Řešení:** Použijte mock z `tests/fixtures/observers.ts` nebo přesuňte test do Browser Mode.

### "vi.mock factory hoisting error"

**Problém:** Top-level proměnné v `vi.mock()` factory.

**Řešení:** Nepoužívejte `$state` v top-level mock proměnných. Vytvořte mock objekty přímo v factory funkci.

### Timeout v Browser Mode testech

**Problém:** Async operace (IntersectionObserver, animace) nejsou dokončeny.

**Řešení:** Přidejte explicitní čekání:

```typescript
await new Promise((resolve) => setTimeout(resolve, 200));
```

### Chybějící `CONTENT_DIR`

Component testy a některé integration testy vyžadují existující manifest data. Ujistěte se, že:

- Spouštíte test s `CONTENT_DIR=<galerie>` ukazujícím na validní galerii
- Manifesty pro danou galerii existují v `src/data/<galerie>/`
- Nejprve spusťte `bun run images:build` pro vygenerování manifestů

---

## Best Practices

1. **Testujte chování, ne implementaci**
   - ✅ "Když kliknu na tlačítko, zobrazí se dialog"
   - ❌ "Funkce `openDialog()` byla zavolána"

2. **Preferujte Browser Mode pro UI testy**
   - Reálný DOM je spolehlivější než jsdom simulace
   - Odhalí problémy s layoutem a CSS

3. **Držte testy rychlé**
   - Unit testy < 50ms
   - Komponentové testy < 500ms
   - E2E testy pouze pro kritické flow

4. **Používejte data-testid**
   - Stabilnější než CSS selektory
   - Nezávislé na textu (i18n)
   - Konvence: `component-name-element-purpose`

---

**Pro detailní dokumentaci viz:**

- [`tests/README.md`](../tests/README.md) - Kompletní testovací architektura
- [`TESTING-IMAGES.md`](./TESTING-IMAGES.md) - Testování image processing pipeline
