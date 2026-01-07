# Konfigurační soubory

> Přehled konfiguračních souborů v root adresáři projektu.

**Navigace:** [← INDEX](./INDEX.md) | [ARCHITECTURE →](./ARCHITECTURE.md) | [ARCH-DEV →](./ARCH-DEV.md)

## Obsah

1. [SvelteKit](#1-sveltekit)
2. [Vite](#2-vite)
3. [TypeScript](#3-typescript)
4. [Tailwind CSS](#4-tailwind-css)
5. [Linting & Formatting](#5-linting--formatting)

## 1. SvelteKit

### svelte.config.js

```javascript
import adapter from "@sveltejs/adapter-static";
import { vitePreprocess } from "@sveltejs/vite-plugin-svelte";

export default {
  preprocess: vitePreprocess(),
  kit: { adapter: adapter() },
};
```

| Klíč         | Hodnota            | Účel                                    |
| ------------ | ------------------ | --------------------------------------- |
| `preprocess` | `vitePreprocess()` | TypeScript + PostCSS v Svelte souborech |
| `adapter`    | `adapter-static()` | Generování statického výstupu (SSG)     |

## 2. Vite

### vite.config.ts

```typescript
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vitest/config";

import { sveltekit } from "@sveltejs/kit/vite";

export default defineConfig({
  plugins: [tailwindcss(), sveltekit()],
  test: {
    projects: [
      { name: "client", environment: "browser" /* ... */ },
      { name: "server", environment: "node" /* ... */ },
    ],
  },
});
```

**Pluginy:**

| Plugin          | Účel                            |
| --------------- | ------------------------------- |
| `tailwindcss()` | Tailwind CSS v4 JIT compilation |
| `sveltekit()`   | SvelteKit integrace + HMR       |

**Testing projekty:**

| Projekt  | Environment          | Include                 |
| -------- | -------------------- | ----------------------- |
| `client` | Browser (Playwright) | `*.svelte.spec.ts`      |
| `server` | Node.js              | `*.spec.ts` (ne Svelte) |

## 3. TypeScript

### tsconfig.json

```jsonc
{
  "extends": "./.svelte-kit/tsconfig.json",
  "compilerOptions": {
    "allowJs": true,
    "checkJs": true,
    "esModuleInterop": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "skipLibCheck": true,
    "sourceMap": true,
    "strict": true,
    "moduleResolution": "bundler",
    "lib": ["esnext", "dom", "dom.iterable"],
  },
}
```

**Klíčové options:**

| Option              | Hodnota         | Účel                   |
| ------------------- | --------------- | ---------------------- |
| `strict`            | `true`          | Striktní type checking |
| `moduleResolution`  | `bundler`       | ESM bundler resolution |
| `resolveJsonModule` | `true`          | Import JSON souborů    |
| `lib`               | `esnext`, `dom` | TypeScript knihovny    |

**Path aliases** (SvelteKit managed):

| Alias        | Cesta                    |
| ------------ | ------------------------ |
| `$lib`       | `src/lib`                |
| `$manifests` | `src/data/<CONTENT_DIR>` |
| `$scripts`   | `scripts/`               |
| `$shared`    | `shared/`                |

## 4. Tailwind CSS

### tailwind.config.ts

```typescript
export default {
  content: ["./src/**/*.{html,js,svelte,ts}"],
  theme: { extend: {} },
  plugins: [],
};
```

**Poznámka:** Projekt používá Tailwind CSS v4 s `@tailwindcss/vite` pluginem.

## 5. Linting & Formatting

### biome.json

```json
{
  "formatter": {
    "indentStyle": "space",
    "indentWidth": 2,
    "lineWidth": 100
  },
  "linter": {
    "rules": { "recommended": true }
  }
}
```

**Excludes:**

- `node_modules`, `build`, `.svelte-kit`
- `static-<gallery>/images/**` (generované obrázky)
- `*.css` (Stylelint)

### Nástroje

| Nástroj      | Účel                            | Příkaz          |
| ------------ | ------------------------------- | --------------- |
| Biome        | TS/JS linting + formatting      | `pnpm lint`     |
| Prettier     | Svelte, Markdown, HTML          | `pnpm format`   |
| Stylelint    | CSS linting                     | `pnpm lint:css` |
| svelte-check | TypeScript + Svelte diagnostics | `pnpm check`    |

## Související dokumenty

- [ARCHITECTURE.md](./ARCHITECTURE.md) — Hlavní přehled
- [CODE-QUALITY.md](./CODE-QUALITY.md) — QA nástroje a workflow
- [ARCH-DEV.md](./ARCH-DEV.md) — Development workflow

---

_Poslední aktualizace: 2026-01-05_
