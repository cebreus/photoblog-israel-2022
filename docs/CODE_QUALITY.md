# Code Quality & Diagnostics

This document describes the quality assurance tools and workflows for the photoblog project.

## Tools Overview

### 1. Svelte Language Server Diagnostics

The Svelte Language Server provides real-time diagnostics in VS Code for:

- **Svelte 5 Reactivity Issues**
  - `state-referenced-locally` - Warns when props are captured outside reactive context
  - `reactive-component-module-script-dependency` - Detects invalid reactive dependencies
  - `non-reactive-update` - Catches non-reactive state mutations
  - `ownership-invalid-binding` - Detects invalid component bindings
  - `ownership-invalid-mutation` - Catches invalid state ownership violations

- **Accessibility (a11y)**
  - ARIA attributes validation
  - Interactive element requirements
  - Semantic HTML enforcement
  - Keyboard navigation support

- **CSS**
  - Unused selector detection
  - Style optimization warnings

Configuration: `.vscode/settings.json`

### 2. Biome

Fast linter and formatter for TypeScript/JavaScript code.

```bash
pnpm lint      # Check for issues
pnpm format    # Auto-fix formatting
```

### 3. svelte-check

TypeScript and Svelte compiler checks.

```bash
pnpm check         # One-time check
pnpm check:watch   # Watch mode for development
```

### 4. Prettier + Stylelint

- Prettier: Svelte, Markdown, HTML, CSS formatting
- Stylelint: CSS-specific linting with Tailwind support

## Quality Assurance Workflows

### Quick Check (Before Commit)

```bash
pnpm check && pnpm lint
```

Runs:

1. `svelte-check` - TypeScript + Svelte diagnostics
2. `biome check` + `prettier` + `stylelint` - Code formatting

### With Tests

```bash
pnpm check && pnpm lint && pnpm test:unit
```

Adds unit tests to the quick check.

### Full Check (Before PR/Deploy)

```bash
pnpm check && pnpm lint && pnpm test
```

Runs all checks and all tests (unit + integration + e2e).

### Watch Mode (During Development)

```bash
pnpm check:watch
```

Continuously checks for Svelte and TypeScript errors as you code.

## Common Svelte 5 Issues Detected

### 1. State Referenced Locally

**Problem:**

```svelte
<script>
  let { autoplay = true } = $props();
  let isPlaying = $state(autoplay); // ⚠️ Warning
</script>
```

**Solution:**

```svelte
<script>
  import { untrack } from "svelte";

  let { autoplay = true } = $props();
  let isPlaying = $state(untrack(() => autoplay)); // ✅ OK
</script>
```

### 2. Non-Reactive Update

**Problem:**

```svelte
<script>
  let count = $state(0);

  function increment() {
    count = count + 1; // ✅ OK
  }

  function badIncrement() {
    let temp = count;
    temp++; // ⚠️ Non-reactive
    count = temp;
  }
</script>
```

### 3. Invalid Ownership Mutation

**Problem:**

```svelte
<script>
  let { items } = $props(); // Props are readonly

  function addItem() {
    items.push(newItem); // ⚠️ Error: mutating prop
  }
</script>
```

**Solution:**

```svelte
<script>
  let { items, onAddItem } = $props();

  function addItem() {
    onAddItem(newItem); // ✅ OK: notify parent
  }
</script>
```

## CI/CD Integration

The project uses Husky pre-commit hooks to run:

```bash
pnpm lint-staged
```

This automatically formats and checks staged files before commit.

## VS Code Integration

The `.vscode/settings.json` configures:

- Real-time Svelte diagnostics
- Format on save
- TypeScript IntelliSense
- Svelte syntax highlighting
- Auto-organize imports

## Recommended VS Code Extensions

- **Svelte for VS Code** (`svelte.svelte-vscode`) - Required
- **Biome** (`biomejs.biome`) - Required
- **Prettier** (`esbenp.prettier-vscode`) - Required
- **Stylelint** (`stylelint.vscode-stylelint`) - Required

## Performance Tips

- Use `pnpm check:watch` during development for instant feedback
- Run `pnpm qa` before committing
- Run `pnpm qa:full` before creating PRs
- CI runs full QA on every push

## Troubleshooting

### "svelte-check is slow"

Try:

```bash
rm -rf .svelte-kit
pnpm check
```

### "False positive warnings"

Adjust severity in `.vscode/settings.json`:

```json
{
  "svelte.plugin.svelte.compilerWarnings": {
    "specific-warning": "ignore"
  }
}
```

### "TypeScript errors in .svelte files"

Ensure VS Code is using workspace TypeScript:

1. Open any `.ts` file
2. Click TypeScript version in status bar
3. Select "Use Workspace Version"
