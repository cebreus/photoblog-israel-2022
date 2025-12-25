# Testovací Architektura

Tento dokument definuje strukturu a konvence pro psaní testů v projektu.

## Struktura Testů

```
tests/
├── unit/                       # Rychlé unit testy (Node.js/jsdom)
│   ├── core/                   # Doménová logika (image processing, faces, manifests)
│   ├── stores/                 # Svelte stores logika
│   └── features/               # Pomocné funkce (URL sync, utils)
│
├── components/                 # Komponentové testy (Browser Mode)
│   ├── sidebar/               # Sidebar komponenty
│   │   ├── AgendaTab.component.spec.ts
│   │   ├── PeopleTab.component.spec.ts
│   │   └── EditTab.component.spec.ts
│   ├── dialogs/               # Dialog komponenty
│   └── grid/                  # PhotoGrid komponenty
│
├── integration/                # Integrační testy
│   ├── browser/               # Browser Mode - reálné scrollování
│   │   └── scrollspy.integration.spec.ts
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
├── utils/                      # Testovací utility
│   ├── gallery-test-utils.ts  # Mock factories pro images, people
│   ├── wait-for-observer.ts   # IntersectionObserver helpers
│   └── store-mocks.ts         # Svelte 5 store mock factories
│
└── setup/                      # Globální konfigurace
    ├── browser.ts             # Browser Mode setup
    └── server.ts              # Node.js/jsdom setup
```

## Rozhodovací Matice: Kdy Použít Který Nástroj

| Kritérium                     | Vitest Unit (Node/jsdom)    | Vitest Browser Mode   | Playwright E2E              |
| ----------------------------- | --------------------------- | --------------------- | --------------------------- |
| **Závislost na layoutu?**     | ❌ Nikdy                    | ✅ ANO                | ✅ ANO                      |
| **Potřeba reálného DOM API?** | ❌ Simulace                 | ✅ Reálný browser     | ✅ Reálný browser           |
| **Interakce s backendem?**    | ✅ Mockovaný                | ✅ Mockovaný fetch    | ✅ Reálný backend           |
| **Rychlost provedení**        | 🚀 < 50ms                   | 🚗 ~500ms             | 🐢 > 2s                     |
| **Paralelní spouštění**       | ✅ Ano                      | ✅ Ano                | ⚠️ Omezené                  |
| **Příklad použití**           | `toSlug()`, Face clustering | ScrollSpy, Komponenty | Smoke testy, Critical paths |

## Konvence pro Psaní Testů

### 1. Unit Testy (Node.js/jsdom)

**Kdy použít:**

- Čistá logika bez závislosti na DOM
- Utility funkce
- Store logika (bez UI interakcí)
- Image processing, Face detection

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

**Konfigurace:**

- Projekt: `unit-core` (Node) nebo `unit-dom` (jsdom)
- Setup: `tests/setup/server.ts`

### 2. Komponentové Testy (Browser Mode)

**Kdy použít:**

- Testování Svelte komponent
- Interakce vyžadující reálné DOM API
- Ověření vykreslení a struktury

**Příklad:**

```typescript
// tests/components/AgendaTab.component.spec.ts
import { describe, expect, it } from "vitest";
import { render } from "vitest-browser-svelte";
import { page } from "vitest/browser";

import AgendaTab from "$lib/components/sidebar-content/AgendaTab.svelte";

describe("AgendaTab", () => {
  it("renders menu items", async () => {
    render(AgendaTab, { props: { menuItems: mockData } });

    await expect.element(page.getByText("24. listopadu")).toBeInTheDocument();
  });
});
```

**Konfigurace:**

- Projekt: `client` nebo `browser-integration`
- Setup: `tests/setup/browser.ts`
- Provider: Playwright (Chromium)

**Důležité:**

- Používejte `page` z `vitest/browser` pro locatory
- Mockujte pouze stores a API, ne DOM komponenty
- Pro async operace (IntersectionObserver) přidejte explicitní čekání

### 3. Integrační Testy

#### Browser Integration (reálný DOM)

**Kdy použít:**

- Testování flow vyžadující reálný layout engine
- ScrollSpy, IntersectionObserver
- Komplexní interakce mezi komponentami

**Příklad:**

```typescript
// tests/integration/flow-scrollspy/scrollspy.spec.ts
describe("ScrollSpy Integration", () => {
  it("updates activeSections when scrolling", async () => {
    render(ScrollSpyTestSubject);

    document.getElementById("section-1")?.scrollIntoView();
    await new Promise((resolve) => setTimeout(resolve, 200)); // Wait for observer

    await expect.element(activeSections).toHaveTextContent("section-1");
  });
});
```

#### API Integration (Node.js)

**Kdy použít:**

- Testování API endpoints
- Integrace s file systemem
- Manifest operace

**Příklad:**

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

**Kdy použít:**

- Smoke testy (aplikace se načte)
- Kritické user flow
- Cross-browser testování

**Příklad:**

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

**Konfigurace:**

- Config: `playwright.config.ts`
- Spouští se samostatně: `bun run test:e2e`

## Mockování

### Pravidla

1. **Mockujte pouze na hranicích systému:**
   - ✅ API calls (`fetch`)
   - ✅ Svelte stores (když testujete izolovanou komponentu)
   - ✅ External libraries (`svelte-sonner`, `bits-ui`)
   - ❌ DOM komponenty (v Browser Mode)
   - ❌ Utility funkce (raději je testujte přímo)

2. **V Browser Mode:**
   - Globální mocky v `tests/setup/browser.ts`
   - Per-test mocky pomocí `vi.mock()` před importem komponenty
   - **Nepoužívejte `$state` v top-level mock proměnných** (hoisting issue)

3. **Příklad správného mockování store:**

```typescript
// ❌ ŠPATNĚ - $state v top-level
let mockSections = $state(new Set<string>());

// ✅ SPRÁVNĚ - plain object
const mockSections = new Set<string>();

vi.mock("$lib/stores/ui.svelte", () => ({
  ui: {
    get activeSections() {
      return mockSections;
    },
  },
}));
```

## Spouštění Testů

```bash
# Všechny testy
bun run test

# Unit testy (rychlé)
bun run test:unit

# Komponentové testy (Browser Mode)
CONTENT_DIR=egypt-2025 bun run vitest run --project client

# Integrační testy
bun run test:integration

# E2E testy
bun run test:e2e

# Konkrétní projekt
bun run vitest run --project unit-core
bun run vitest run --project browser-integration
```

## Fixtures a Helpery

### Sdílené Fixtures

- `tests/fixtures/manifests.ts` - Mock data pro manifesty
- `tests/fixtures/people.ts` - Mock data pro osoby
- `tests/fixtures/observers.ts` - IntersectionObserver mock pro jsdom

### Testovací Utility

Pro Browser Mode testy s IntersectionObserver:

```typescript
// Explicitní čekání na observer callback
await new Promise((resolve) => setTimeout(resolve, 200));

// Scroll do view
document.getElementById("element-id")?.scrollIntoView({
  behavior: "instant",
  block: "center",
});
```

## Časté Problémy a Řešení

### 1. "Invalid Chai property: toHaveText"

**Problém:** Chybí matcher z `@vitest/browser`.

**Řešení:** Použijte `toHaveTextContent` nebo přidejte `vitest-setup-client.ts` do setupFiles.

### 2. "IntersectionObserver is not defined" (jsdom)

**Problém:** jsdom nepodporuje IntersectionObserver.

**Řešení:** Použijte mock z `tests/fixtures/observers.ts` nebo přesuňte test do Browser Mode.

### 3. "vi.mock factory hoisting error"

**Problém:** Top-level proměnné v `vi.mock()` factory.

**Řešení:** Vytvořte mock objekty přímo v factory funkci, nepoužívejte externí proměnné.

### 4. Timeout v Browser Mode testech

**Problém:** Async operace (IntersectionObserver, animace) nejsou dokončeny.

**Řešení:** Přidejte explicitní čekání:

```typescript
await new Promise((resolve) => setTimeout(resolve, 200));
```

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

4. **Izolujte testy**
   - Každý test musí být nezávislý
   - Používejte `beforeEach` pro reset stavu
   - Nesdílejte mutable state mezi testy

5. **Používejte data-testid**
   - Stabilnější než CSS selektory
   - Nezávislé na textu (i18n)
   - Konvence: `component-name-element-purpose`

## Migrace Starých Testů

Pokud najdete test v nesprávném prostředí:

1. **jsdom test vyžadující layout** → Přesuňte do Browser Mode
2. **Browser Mode test bez DOM interakcí** → Přesuňte do unit testů
3. **Těžké mockování komponent** → Použijte reálné komponenty v Browser Mode

---

**Poslední aktualizace:** 2025-12-25  
**Autor:** Refaktoring testovací architektury (Fáze 1-3)
