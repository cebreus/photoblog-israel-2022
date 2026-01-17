---
description: How to create a proper conventional commit message
---

# Conventional Commit Workflow

This workflow guides AI agents to create properly formatted commit messages following [Conventional Commits 1.0.0](https://www.conventionalcommits.org/en/v1.0.0/).

## Pre-commit Checklist

Before committing, ensure:

1. All changes are staged (`git add`)
2. Code passes `pnpm format` and `pnpm check`
3. Tests pass (if applicable)

## Commit Message Format

```
<type>(<scope>): <description>

[optional body]

[optional footer(s)]
```

## Step 1: Determine the Type

Select ONE type based on the primary change:

| Type       | When to use                                          |
| ---------- | ---------------------------------------------------- |
| `feat`     | Adding new functionality                             |
| `fix`      | Fixing a bug                                         |
| `docs`     | Documentation only (for humans, NOT generated files) |
| `style`    | Formatting, whitespace (NOT CSS!)                    |
| `refactor` | Code change without behavior change                  |
| `perf`     | Performance optimization                             |
| `test`     | Adding/fixing tests                                  |
| `build`    | Build system, dependencies, config files             |
| `ci`       | CI/CD configuration                                  |
| `chore`    | Maintenance, manifests, cleanup                      |
| `revert`   | Reverting a previous commit                          |

## Step 2: Determine the Scope (if applicable)

Use scope when the change is focused on a specific area. **Only ONE scope per commit!**

**Functional scopes**: `api`, `ui`, `map`, `people`, `filters`, `gallery`, `lightbox`, `collage`, `i18n`, `manifests`, `logging`

**Infrastructure scopes**: `scripts`, `stores`, `types`, `utils`, `tests`, `deps`, `config`, `build`, `release`

**Component scopes** (PascalCase): `Header`, `Sidebar`, `PhotoGrid`, `PersonDetailDialog`

**Gallery scopes**: `egypt`, `israel`

### When to skip scope

For cross-cutting changes affecting multiple areas:

```bash
refactor: convert arrow functions to named functions
```

Or use a broader scope:

```bash
refactor(ui): consolidate loading indicators
# Then in body: Affected: PhotoGrid, PeopleTab, MapView
```

## Step 3: Write the Description

- Start with lowercase letter
- Use imperative mood ("add" not "added")
- Max 72 characters
- No period at end
- Be specific, not vague

## Step 4: Add Body (optional)

For complex changes, add a body after a blank line:

- Explain WHY, not just WHAT
- Wrap at 72 characters
- Can have multiple paragraphs

## Step 5: Add Footer (optional)

For breaking changes or references:

- `BREAKING CHANGE: <description>`
- `Refs: #123`
- `Closes: #456`

## Examples

// turbo-all

### Simple feature

```bash
git commit -m "feat(map): add satellite layer toggle"
```

### Bug fix

```bash
git commit -m "fix(gallery): correct filter evaluation order"
```

### Manifest regeneration

```bash
git commit -m "chore(manifests): regenerate after image processing"
```

### Refactoring with body

```bash
git commit -m "refactor(ui): consolidate loading indicators

Replaced manual spinners with LoadingOverlay component.
Affected: PhotoGrid, PeopleTab, MapView."
```

### Breaking change

```bash
git commit -m "feat(api)!: change person endpoint response format

BREAKING CHANGE: Person endpoint now returns nested object."
```

### Dependency update

```bash
git commit -m "build(deps): upgrade svelte to 5.46.3"
```

## Common Mistakes to Avoid

| ❌ Wrong                    | ✅ Correct                         | Why                             |
| --------------------------- | ---------------------------------- | ------------------------------- |
| `docs(manifests): update`   | `chore(manifests): regenerate`     | Manifests are not documentation |
| `data(egypt): add photos`   | `chore(egypt): add photos`         | `data` is not a valid type      |
| `feat(map,ui): add feature` | `feat(map): add feature`           | Only one scope allowed          |
| `fix: stuff`                | `fix(gallery): correct null check` | Be specific                     |
| `fixup! previous`           | squash before merge                | Use interactive rebase          |
