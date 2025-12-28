# Svelte 5 Quality Assurance Setup

## ✅ Co bylo implementováno

### 1. Svelte Language Server Diagnostics

Konfigurace v `.vscode/settings.json` zahrnuje:

**Svelte 5 Reactivity Checks:**

- `state-referenced-locally` - Detekuje zachycení props mimo reaktivní kontext
- `reactive-component-module-script-dependency` - Neplatné reaktivní závislosti
- `non-reactive-update` - Nereaktivní mutace stavu
- `ownership-invalid-binding` - Neplatné bindování komponent
- `ownership-invalid-mutation` - Porušení vlastnictví stavu

**Accessibility (27 pravidel):**

- ARIA atributy a role
- Interaktivní elementy
- Klávesnicová navigace
- Sémantický HTML

**CSS:**

- Detekce nepoužívaných selektorů

### 2. Existing Scripts

```bash
# Svelte + TypeScript check
pnpm check

# Watch mode (během vývoje)
pnpm check:watch

# Linting
pnpm lint

# Formatting
pnpm format

# All tests
pnpm test

# Unit tests only
pnpm test:unit

# Integration tests
pnpm test:integration

# E2E tests
pnpm test:e2e
```

### 3. Dokumentace

Vytvořen `docs/CODE_QUALITY.md` s:

- Přehled nástrojů
- Běžné Svelte 5 problémy a řešení
- Workflow doporučení
- Troubleshooting

## 🚀 Jak používat

### Během vývoje

```bash
# Spusť watch mode v samostatném terminálu
pnpm check:watch
```

VS Code bude zobrazovat diagnostiku v reálném čase.

### Před commitem

```bash
pnpm check && pnpm lint
```

### Před PR/deploy

```bash
pnpm check && pnpm lint && pnpm test
```

## 📊 Co se kontroluje

| Nástroj          | Co kontroluje                    | Kdy běží        |
| ---------------- | -------------------------------- | --------------- |
| **svelte-check** | TypeScript + Svelte 5 reaktivita | `pnpm check`    |
| **Biome**        | TS/JS linting                    | `pnpm lint`     |
| **Prettier**     | Svelte/CSS/MD formátování        | `pnpm format`   |
| **Stylelint**    | CSS kvalita                      | `pnpm lint`     |
| **Vitest**       | Unit + Integration testy         | `pnpm test`     |
| **Playwright**   | E2E testy                        | `pnpm test:e2e` |

## 🔍 Příklady detekovaných problémů

### Svelte 5 Reactivity

```svelte
<!-- ❌ Špatně -->
<script>
  let { value } = $props();
  let state = $state(value); // Varování!
</script>

<!-- ✅ Správně -->
<script>
  import { untrack } from 'svelte';
  let { value } = $props();
  let state = $state(untrack(() => value));
</script>
```

### Accessibility

```svelte
<!-- ❌ Špatně -->
<div onclick={handleClick}>Click me</div>

<!-- ✅ Správně -->
<button onclick={handleClick}>Click me</button>
```

## 📝 Poznámky

- Všechna nastavení jsou v `.vscode/settings.json`
- Žádné další závislosti (ESLint) - pouze Biome
- Real-time feedback ve VS Code
- Pre-commit hooks automaticky formátují kód

## 🎯 Výsledek

```
✓ 0 errors, 0 warnings
✓ Svelte 5 reactivity checks aktivní
✓ 27 accessibility pravidel
✓ TypeScript strict mode
✓ CSS optimization
```
