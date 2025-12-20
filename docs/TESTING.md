# Testování v projektu Photoblog

Tento dokument slouží jako průvodce pro vývojáře, jak psát a spouštět testy v tomto projektu.

## Přehled

Projekt je **multi-gallery fotoblog** běžící na **Bun runtime**. Testování zahrnuje jak backend skripty pro generování obrázků, tak frontend Svelte 5 komponenty s podporou browseru.

## Strategie testování

Projekt využívá vícevrstvou pyramidu testů:

1.  **Unit Testy:** Testují izolovanou byznys logiku (backend skripty, utility funkce, transformace dat). Běží v Node.js/Bun prostředí.
2.  **Component Testy:** Testují UI komponenty Svelte v reálném (headless) prohlížeči pomocí Vitest Browser Mode. Ověřují rendering, interakci a integraci s reaktivním stavem (stores).
3.  **Integration Testy:** Testují kompletní image generation pipeline včetně Sharp processingu a manifest generování.
4.  **E2E Testy:** Testují celou aplikaci z pohledu uživatele pomocí Playwright, včetně navigace a reálného backendu.

---

## 1. Jak spouštět testy

Všechny příkazy používají `bun`.

### Unit Testy

Unit testy ověřují jednotlivé funkce a utility. Jsou umístěny v `tests/unit`.
Příklad: `tests/unit/utils-gallery.unit.spec.ts` testuje filtrování a merge logiku.
`tests/unit/aesthetic.unit.spec.ts` ověřuje matematiku výpočtu estetického skóre a správnost vah (kalibrace).

Spuštění: `bun test:unit`

### Component Testy (Vitest Browser Mode)

Spustí testy UI komponent v headless Chromium. **Vyžadují nastavenou proměnnou `CONTENT_DIR`** pro správné fungování aliasů a načtení manifestů.

```bash
CONTENT_DIR=egypt-2025 bun run vitest run --project client
```

_Poznámka: Pokud chcete vidět UI během testování, upravte konfiguraci v `vite.config.ts`._

### Integration Testy

Spustí integration testy pro image generation pipeline:

```bash
bun run test:images
```

### E2E Testy (Playwright)

Spustí end-to-end testy v reálném prohlížeči:

```bash
bun run test:e2e
```

_Poznámka: Testy běží v headless Chromium prohlížeči. Pokud chcete vidět UI, odstraňte `--headless` z konfigurace nebo sledujte terminál._

### Všechny testy

```bash
bun run test
```

---

## 2. Psaní Unit Testů

- **Umístění:** `tests/unit/` nebo přímo vedle kódu (např. `src/lib/utils/my-util.test.ts`).
- **Co testovat:** Čisté funkce (pure functions), transformace dat, matematické výpočty.
- **Co netestovat:** Svelte komponenty, DOM manipulace.

```typescript
// Příklad: tests/unit/math.test.ts
import { add } from "$lib/utils/math";
import { describe, expect, it } from "vitest";

describe("add", () => {
  it("adds two numbers", () => {
    expect(add(1, 2)).toBe(3);
  });
});
```

---

## 3. Psaní Component Testů (Vitest Browser Mode)

Toto je klíčová část naší strategie. Používáme **Vitest Browser Mode** (`@vitest/browser`) s **Playwright**, což umožňuje renderovat Svelte 5 komponenty v reálném DOMu.

- **Umístění:** Přímo vedle komponenty, např. `src/lib/components/PhotoGrid.svelte.test.ts`
- **Technologie:** `vitest-browser-svelte`, `page` objekt z `@vitest/browser/context`
- **Multi-gallery kontext:** Testy vyžadují `CONTENT_DIR` pro správné načtení manifestů přes `$manifests` alias

### Klíčový pattern: Mockování Store (Stores Isolation)

Svelte 5 aplikace (a tento projekt) silně využívá globální stores (`$lib/stores/editorState`, `filters`, atd.). Abychom mohli komponentu testovat izolovaně, **musíme tyto stores mockovat**.

**Jak na to:**

1.  Použijte `vi.mock()` na začátku test souboru.
2.  Pokud používáte `hoisted` proměnné, definujte mock uvnitř factory funkce nebo použijte `in-line` definici.

```typescript
// Příklad: src/lib/components/MyComponent.svelte.test.ts
// Důležité: page objekt pro selektory
import MyComponent from "./MyComponent.svelte";
import { page } from "@vitest/browser/context";
import { describe, expect, it, vi } from "vitest";
import { render } from "vitest-browser-svelte";

// 1. Mockování globálního storu
vi.mock("$lib/stores/editorState", () => ({
  selection: {
    subscribe: vi.fn((fn: any) => {
      fn(new Set());
      return () => {};
    }), // Simulujeme prázdný Set
    has: () => false,
    size: 0,
  },
}));

describe("MyComponent", () => {
  it("renders correctly", async () => {
    // 2. Render komponenty
    render(MyComponent, { props: { title: "Hello" } });

    // 3. Assertions pomocí page objektu (Testing Library styl)
    await expect.element(page.getByText("Hello")).toBeInTheDocument();
  });
});
```

### Best Practices pro Selektory

1.  **Preferujte `getByRole` nebo `getByText`:** Testujte to, co vidí uživatel.
    ```typescript
    const btn = page.getByRole("button", { name: "Uložit" });
    ```
2.  **Pro interakci použijte `data-testid`:** Pokud je element těžko zacílitelný nebo se text mění.
    ```html
    <!-- v komponentě -->
    <button data-testid="save-button" ...>Save</button>
    ```
    ```typescript
    // v testu
    await page.getByTestId("save-button").click();
    ```
3.  **Pozor na více elementů:** `getByText` selže, pokud je textu více. Použijte `.first()`, `.all()` nebo specifičtější selektor.

### Testování s CONTENT_DIR

Komponentní testy často potřebují přístup k manifestům přes `$manifests` alias. Ujistěte se, že spouštíte test s nastavenou proměnnou `CONTENT_DIR`:

```bash
CONTENT_DIR=egypt-2025 bun run vitest run --project client
```

---

## 4. Integration Testy (Image Processing)

Integrační testy pro image generation pipeline používají specializovanou konfiguraci `vitest.config.images.ts`.

- **Umístění:** `tests/integration/`, `tests/e2e-images/`
- **Spuštění:** `bun run test:images`
- **Kontext:** Testy vytvářejí dočasné galerie a testují celý pipeline včetně Sharp processing

Více detailů viz [TESTING-IMAGES.md](./TESTING-IMAGES.md).

## 5. E2E Testy (Playwright)

Používají se pro testování kritických průchodů aplikací (Smoke Tests).

- **Umístění:** `e2e/`.
- **Spuštění:** `bun run test:e2e`.

---

## 6. Časté problémy a řešení

### "Cannot use 'in' operator to search for 'set' in undefined"

Tato chyba často znamená špatně namockovaný store. Zkontrolujte, zda váš mock vrací objekt s metodou `subscribe` (pro Svelte stores). Pokud používáte `sveltekit-superforms`, musíte namockovat celý objekt.

### "Hoisting" error ve Vitestu

Nemůžete používat top-level proměnné uvnitř `vi.mock()`, pokud nejsou definovány pomocí `vi.hoisted()`. Nejjednodušší je definovat mock objekt přímo (inline) uvnitř `vi.mock` callbacku.

### Chybějící `$manifests` nebo `CONTENT_DIR`

Component testy a některé integration testy vyžadují existující manifest data. Ujistěte se, že:

- Spouštíte test s `CONTENT_DIR=<galerie>` ukazujícím na validní galerii
- Manifesty pro danou galerii existují v `src/data/<galerie>/`
- Nejprve spusťte `bun run images:build` pro vygenerování manifestů

### Sharp timeouty v integration testech

Pokud testy timeoutují, může to být způsobeno paralelním zpracováním obrázků. Nastavte `SHARP_NUM_THREADS=1` pro sériové zpracování:

```bash
SHARP_NUM_THREADS=1 bun run test:images
```
