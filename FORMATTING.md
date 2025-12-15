# Formatting & Linting Configuration

This document describes the formatting and linting setup for the project.

## 📋 Overview

The project uses a **multi-tool approach** for code quality:

- **Biome** → TypeScript/JavaScript files (formatting + linting)
- **Prettier** → Svelte, Markdown, HTML, CSS files (formatting only)
- **Stylelint** → CSS files (linting only, no formatting)

## 🔧 Consistent Settings

All tools are configured with consistent formatting rules:

| Setting             | Value     | Biome | Prettier | Stylelint |
| ------------------- | --------- | ----- | -------- | --------- |
| **Indentation**     | 2 spaces  | ✅    | ✅       | N/A¹      |
| **Max line length** | 100 chars | ✅    | ✅       | N/A¹      |
| **Quotes**          | Double    | ✅    | ✅       | N/A       |
| **Semicolons**      | Required  | ✅    | ✅       | N/A       |
| **Trailing commas** | All       | ✅    | ✅       | N/A       |

¹ _Stylelint v15+ removed stylistic rules. CSS formatting is handled by Prettier._

## 📁 File Coverage

```
TypeScript/JavaScript (*.ts, *.js, *.mjs)
  ├─ Formatting: Biome
  └─ Linting: Biome

Svelte (*.svelte)
  ├─ Formatting: Prettier (with prettier-plugin-svelte)
  └─ Linting: svelte-check (TypeScript compiler)

CSS (*.css)
  ├─ Formatting: Prettier (with prettier-plugin-tailwindcss)
  └─ Linting: Stylelint

Markdown/HTML (*.md, *.html)
  └─ Formatting: Prettier
```

## 🚀 Commands

### Format all files

```bash
pnpm format
```

### Check formatting (CI)

```bash
pnpm format:check
```

### Lint all files

```bash
pnpm lint        # Biome + Stylelint
pnpm lint:css    # Stylelint only
pnpm lint:fix    # Auto-fix Biome issues
```

## ⚙️ Configuration Files

All configuration files use the `.json` format for consistency:

- **`biome.json`** - Biome configuration (TS/JS only, excludes `*.svelte`)
- **`.prettierrc.json`** - Prettier configuration (Svelte/MD/HTML/CSS)
- **`.stylelintrc.json`** - Stylelint configuration (CSS linting)
- **`.prettierignore`** - Files to exclude from Prettier
- **`.stylelintignore`** - Files to exclude from Stylelint

### Note on Binary Files

**Binary files (images, videos, fonts, etc.) are automatically skipped** by all formatting tools. You don't need to explicitly ignore them in configuration files:

- **Biome** only processes supported text formats (JS, TS, JSON, etc.)
- **Prettier** only processes supported text formats (code, markdown, etc.)
- **Stylelint** only processes CSS files

The ignore files should only contain:

- Build output directories (`.svelte-kit/`, `build/`, etc.)
- Generated code that shouldn't be formatted
- Large files that would slow down the formatter (e.g., `images.manifest.json`)

## 🔍 Why This Setup?

### Biome vs. Prettier for Svelte

**Problem:** Biome cannot parse Svelte 5 syntax (specifically the `generics` attribute in `<script>` tags).

**Solution:** Biome handles TS/JS files, Prettier handles Svelte files with proper Svelte 5 support via `prettier-plugin-svelte`.

### Stylelint without Formatting Rules

Stylelint v15+ [deprecated stylistic rules](https://stylelint.io/migration-guide/to-15) like `indentation` and `max-line-length`, recommending Prettier for formatting instead. Our setup follows this best practice:

- **Stylelint** → Enforces CSS best practices (e.g., selector patterns, performance)
- **Prettier** → Handles CSS formatting (indentation, line length, etc.)

## 🧪 Pre-commit Hooks

The project uses **lint-staged** (`.lintstagedrc.json`) to run formatters and linters on staged files before commit:

```json
{
  "*.{ts,js,mjs}": ["biome check --write --no-errors-on-unmatched"],
  "*.{svelte,md,html,css}": ["prettier --write --plugin prettier-plugin-svelte"],
  "*.css": ["stylelint --fix"]
}
```

This ensures all committed code is properly formatted and linted.
