# Kvalita kódu

> QA nástroje a workflow pro projekt.

## Obsah

1. [Nástroje](#1-nástroje)
2. [Příkazy](#2-příkazy)
3. [Časté problémy](#3-časté-problémy)

## 1. Nástroje

### Svelte diagnostika

Konfigurace v `.vscode/settings.json`:

| Pravidlo                     | Popis                                  |
| ---------------------------- | -------------------------------------- |
| `state-referenced-locally`   | Zachycení props mimo reaktivní kontext |
| `non-reactive-update`        | Nereaktivní mutace stavu               |
| `ownership-invalid-mutation` | Porušení vlastnictví stavu             |

### Linting & Formatting

| Nástroj      | Účel                       | Konfigurace    |
| ------------ | -------------------------- | -------------- |
| Biome        | TS/JS linting + formatting | `biome.json`   |
| Prettier     | Svelte, Markdown, CSS      | `.prettierrc`  |
| Stylelint    | CSS kvalita                | `.stylelintrc` |
| svelte-check | TypeScript + Svelte        | –              |

## 2. Příkazy

### Rychlá kontrola (před commitem)

```bash
pnpm check && pnpm lint
```

### S testy

```bash
pnpm check && pnpm lint && pnpm test:unit
```

### Kompletní (před PR)

```bash
pnpm check && pnpm lint && pnpm test
```

### Watch mode

```bash
pnpm check:watch
```

## 3. Časté problémy

### State referenced locally

```svelte
<!-- ❌ Špatně -->
<script>
  let { autoplay = true } = $props();
  let isPlaying = $state(autoplay);
</script>

<!-- ✅ Správně -->
<script>
  import { untrack } from "svelte";
  let { autoplay = true } = $props();
  let isPlaying = $state(untrack(() => autoplay));
</script>
```

### Invalid ownership mutation

```svelte
<!-- ❌ Špatně -->
<script>
  let { items } = $props();
  items.push(newItem);  // Mutace prop
</script>

<!-- ✅ Správně -->
<script>
  let { items, onAddItem } = $props();
  onAddItem(newItem);  // Callback
</script>
```

### Svelte-check je pomalý

```bash
rm -rf .svelte-kit
pnpm check
```

### TypeScript chyby v .svelte

1. Otevřít libovolný `.ts` soubor
2. Kliknout na verzi TypeScript ve status bar
3. Vybrat „Use Workspace Version"

## Související dokumenty

- [ARCH-DEV.md](./ARCH-DEV.md) — Development workflow
- [ARCH-CONFIG.md](./ARCH-CONFIG.md) — Konfigurační soubory
- [TESTING.md](./TESTING.md) — Testování

---

_Poslední aktualizace: 2026-01-03_
