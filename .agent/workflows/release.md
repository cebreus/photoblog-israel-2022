---
description: How to create a release with changelog generation
---

# Release Workflow (AI-Driven)

This workflow guides AI agents through the release process. **No external tools needed** – the AI agent analyzes commit history, generates changelog, and performs the release.

## Pre-release Checklist

Before starting a release:

// turbo

1. Ensure all tests pass

```bash
bun run test
```

// turbo 2. Ensure format and check pass

```bash
pnpm format && pnpm check
```

3. Ensure working directory is clean

```bash
git status
```

## Step 1: Analyze Commit History

Get the last tag (or start from beginning if none):

```bash
git describe --tags --abbrev=0 2>/dev/null || echo "No tags yet"
```

If tags exist, analyze commits since last tag:

```bash
LAST_TAG=$(git describe --tags --abbrev=0)
git log $LAST_TAG..HEAD --oneline --format="%H|%s|%an|%ad" --date=short
```

If no tags, analyze entire history:

```bash
git log --oneline --format="%H|%s|%an|%ad" --date=short
```

## Step 2: Parse and Categorize Commits

Group commits by conventional type:

| Type                     | CHANGELOG Section       | SemVer Impact |
| ------------------------ | ----------------------- | ------------- |
| `feat`                   | ✨ **Features**         | MINOR         |
| `fix`                    | 🐛 **Bug Fixes**        | PATCH         |
| `perf`                   | ⚡ **Performance**      | PATCH         |
| `refactor`               | ♻️ **Refactoring**      | -             |
| `docs`                   | 📚 **Documentation**    | -             |
| `test`                   | ✅ **Tests**            | -             |
| `build`                  | 🔧 **Build**            | -             |
| `BREAKING CHANGE` or `!` | ⚠️ **BREAKING CHANGES** | MAJOR         |

**Ignore for changelog:**

- `chore` (unless significant)
- `style`
- `ci`

## Step 3: Determine Version Bump

Follow Semantic Versioning:

- **MAJOR** (X.0.0): Breaking changes present (`BREAKING CHANGE:` or `!`)
- **MINOR** (0.X.0): New features (`feat`) without breaking changes
- **PATCH** (0.0.X): Only fixes (`fix`) and performance (`perf`)

**Pre-1.0 rules** (current project state):

- MINOR = breaking changes allowed
- PATCH = fixes only

## Step 4: Generate CHANGELOG.md

Create or update `CHANGELOG.md` with this structure:

```markdown
# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

<!-- Future changes go here -->

## [X.Y.Z] - YYYY-MM-DD

### ⚠️ BREAKING CHANGES

- List commits with `BREAKING CHANGE:` or `!`

### ✨ Features

- feat(scope): description ([commit-hash](link))

### 🐛 Bug Fixes

- fix(scope): description ([commit-hash](link))

### ⚡ Performance

- perf(scope): description ([commit-hash](link))

### ♻️ Refactoring

- refactor(scope): description ([commit-hash](link))

### 📚 Documentation

- docs(scope): description ([commit-hash](link))

### 🔧 Build

- build(scope): description ([commit-hash](link))

### ✅ Tests

- test(scope): description ([commit-hash](link))

[Unreleased]: https://github.com/USER/REPO/compare/vX.Y.Z...HEAD
[X.Y.Z]: https://github.com/USER/REPO/releases/tag/vX.Y.Z
```

**Grouping rules:**

1. Group by type (feat, fix, perf, etc.)
2. Within each type, optionally group by scope
3. Sort alphabetically within groups
4. Include commit hash link for traceability

## Step 5: Update package.json

Update version field:

```json
{
  "version": "X.Y.Z"
}
```

## Step 6: Create Release Commit

```bash
git add CHANGELOG.md package.json
git commit -m "chore(release): vX.Y.Z"
```

## Step 7: Create Git Tag

```bash
git tag -a vX.Y.Z -m "Release vX.Y.Z"
```

## Step 8: Push to Remote

```bash
git push origin main --tags
```

## AI Agent Instructions

When user invokes `/release`, you should:

1. **Verify pre-conditions:**
   - Tests pass
   - Format/check pass
   - Working directory clean

2. **Analyze commits:**
   - Parse commit messages
   - Extract type, scope, description
   - Identify breaking changes

3. **Determine version:**
   - Check for breaking changes → MAJOR
   - Check for features → MINOR
   - Only fixes → PATCH

4. **Generate CHANGELOG:**
   - Group by type with emoji headers
   - Include scope in parentheses
   - Add commit hash links
   - Maintain chronological order within groups

5. **Update files:**
   - CHANGELOG.md
   - package.json version

6. **Create commit and tag:**
   - Commit: `chore(release): vX.Y.Z`
   - Tag: `vX.Y.Z`

7. **Ask user to review** before pushing

## Example Output

```markdown
## [0.2.0] - 2026-01-17

### ✨ Features

- feat(map): add satellite layer toggle ([a7138549](https://github.com/cebreus/photoblog-israel-2022/commit/a7138549))
- feat(people): add bulk detection invalidation ([51a8b608](https://github.com/cebreus/photoblog-israel-2022/commit/51a8b608))

### 🐛 Bug Fixes

- fix(i18n): Paraglide JS 2.x migration ([2a8156e6](https://github.com/cebreus/photoblog-israel-2022/commit/2a8156e6))
- fix(gallery): correct filter evaluation ([fff2d2ef](https://github.com/cebreus/photoblog-israel-2022/commit/fff2d2ef))

### ⚡ Performance

- perf(gallery): implement lazy loading ([c660e044](https://github.com/cebreus/photoblog-israel-2022/commit/c660e044))
```

## Retroactive CHANGELOG Generation

For initial release covering entire history:

1. Analyze ALL commits from beginning
2. Group by major milestones or date ranges
3. Summarize features instead of listing every commit
4. Focus on user-facing changes

Example:

```markdown
## [0.1.0] - 2026-01-17

### ✨ Features

- **Gallery**: Multi-gallery support with sequences, separators, collages
- **Map**: Interactive map with self-hosted tiles and satellite layer
- **People**: Face detection, clustering, person management
- **Filters**: Advanced filtering with priority cascade
- **i18n**: Full Czech/English localization

### 🔧 Build

- Migrated to Svelte 5 with $state runes
- Upgraded to Bun runtime
- Consolidated logging to Pino
```
