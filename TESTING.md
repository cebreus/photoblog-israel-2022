# Testování v projektu Photoblog Israel

Tento dokument slouží jako průvodce pro vývojáře, jak psát a spouštět testy v tomto projektu.

## Strategie testování

Projekt využívá třístupňovou pyramidu testů:

1.  **Unit Testy (Unit):** Testují izolovanou _byznys logiku_ (backend skripty, utility funkce, transformace dat). Jsou rychlé a běží v Node.js prostředí.
2.  **Component Testy (Integration):** Testují UI komponenty Svelte v _reálném (headless) prohlížeči_. Ověřují rendering, interakci a integraci s reaktivním stavem (stores).
3.  **E2E Testy (End-to-End):** Testují celou aplikaci z pohledu uživatele, včetně navigace a reálného backendu (pomocí Playwright).

---

## 1. Jak spouštět testy

Všechny příkazy používají `bun`.

### Unit Testy (Rychlé)

Spustí testy pro logiku (`src/lib/utils`, `scripts/lib`).

```bash
bun run test:unit
```

_Poznámka: Tyto testy běží v prostředí `node` a nevykreslují komponenty._

### Component Testy (Browser Mode)

Spustí testy UI komponent (`*.svelte.test.ts`). Vyžadují nastavenou proměnnou `CONTENT_DIR` pro správné fungování aliasů.

```bash
CONTENT_DIR=egypt-2025 bun run vitest run --project client
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
import { describe, it, expect } from "vitest";

describe("add", () => {
  it("adds two numbers", () => {
    expect(add(1, 2)).toBe(3);
  });
});
```

---

## 3. Psaní Component Testů (Vitest Browser Mode)

Toto je nejnovější část naší strategie. Používáme **Vitest Browser Mode** (`@vitest/browser`), což nám umožňuje renderovat Svelte 5 komponenty v reálném DOMu.

- **Umístění:** Přímo vedle komponenty, např. `src/lib/components/PhotoGrid.svelte.test.ts`.
- **Technologie:** `vitest-browser-svelte`, `page` objekt z `@vitest/browser/context`.

### Klíčový pattern: Mockování Store (Stores Isolation)

Svelte 5 aplikace (a tento projekt) silně využívá globální stores (`$lib/stores/editorState`, `filters`, atd.). Abychom mohli komponentu testovat izolovaně, **musíme tyto stores mockovat**.

**Jak na to:**

1.  Použijte `vi.mock()` na začátku test souboru.
2.  Pokud používáte `hoisted` proměnné, definujte mock uvnitř factory funkce nebo použijte `in-line` definici.

```typescript
// Příklad: src/lib/components/MyComponent.svelte.test.ts
import { describe, it, expect, vi } from "vitest";
import { render } from "vitest-browser-svelte";
import { page } from "@vitest/browser/context"; // Důležité: page objekt pro selektory
import MyComponent from "./MyComponent.svelte";

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

---

## 4. E2E Testy (Playwright)

Používají se pro testování kritických průchodů aplikací (Smoke Tests).

- **Umístění:** `e2e/`.
- **Spuštění:** `bun run test:e2e`.

---

## 5. Časté problémy a řešení

- **"Cannot use 'in' operator to search for 'set' in undefined":**
  - Tato chyba často znamená špatně namockovaný store. Zkontrolujte, zda váš mock vrací objekt s metodou `subscribe` (pro Svelte stores). Pokud používáte `sveltekit-superforms`, musíte namockovat celý objekt (viz `EditTab.svelte.test.ts`).

- **"Hoisting" error ve Vitestu:**
  - Nemůžete používat top-level proměnné uvnitř `vi.mock()`, pokud nejsou definovány pomocí `vi.hoisted()`. Nejjednodušší je definovat mock objekt přímo (inline) uvnitř `vi.mock` callbacku.

- **Chybějící `$manifests`:**
  - Testy vyžadují existující data. Ujistěte se, že spouštíte test s `CONTENT_DIR=...` ukazujícím na validní obsah.
