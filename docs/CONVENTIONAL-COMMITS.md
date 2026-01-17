# Conventional Commits Guidelines

> **Verze**: 1.1  
> **Aktualizováno**: 2026-01-17  
> **Specifikace**: [Conventional Commits 1.0.0](https://www.conventionalcommits.org/en/v1.0.0/)

---

## Formát commit message

```
<type>(<scope>): <description>

[optional body]

[optional footer(s)]
```

### Pravidla

1. **type** – POVINNÝ, lowercase
2. **scope** – VOLITELNÝ, ale DOPORUČENÝ pro kontextuální změny
3. **description** – POVINNÁ, max 72 znaků, imperativ (anglicky), lowercase první písmeno
4. **body** – VOLITELNÉ, odděleno prázdným řádkem
5. **footer** – VOLITELNÉ (`BREAKING CHANGE:`, `Refs: #123`, `Closes: #456`)

---

## Povolené typy

| Type       | Popis                                               | SemVer vliv        |
| ---------- | --------------------------------------------------- | ------------------ |
| `feat`     | Nová funkcionalita                                  | MINOR              |
| `fix`      | Oprava chyby                                        | PATCH              |
| `docs`     | Pouze dokumentace (pro lidi, ne generované soubory) | -                  |
| `style`    | Formátování, whitespace (NE CSS změny!)             | -                  |
| `refactor` | Změna kódu bez změny chování                        | -                  |
| `perf`     | Optimalizace výkonu                                 | PATCH              |
| `test`     | Přidání/oprava testů                                | -                  |
| `build`    | Build systém, dependencies, config                  | -                  |
| `ci`       | CI/CD konfigurace                                   | -                  |
| `chore`    | Údržba, ostatní (manifesty, cleanup)                | -                  |
| `revert`   | Revert předchozího commitu                          | závisí na původním |

### ⚠️ Zakázané typy

| Nepoužívat       | Nahradit za                               |
| ---------------- | ----------------------------------------- |
| `data`           | `chore(manifests)` nebo `feat(manifests)` |
| `config`         | `build(config)` nebo `chore(config)`      |
| `infrastructure` | `build` nebo `ci`                         |
| `release`        | `chore(release)`                          |
| `wip`            | squash před merge                         |
| `fixup`          | squash před merge                         |
| `cleanup`        | `chore` nebo `refactor`                   |

---

## Definované scopes

Scopes odvozené z analýzy 1188 commitů a struktury projektu. **Všechny scopes jsou rovnocenné** – použij ten, který nejlépe popisuje oblast změny.

### Funkční scopes

| Scope       | Oblast                      | Typické soubory                              |
| ----------- | --------------------------- | -------------------------------------------- |
| `api`       | Backend API endpointy       | `src/routes/api/**`, `src/lib/api/**`        |
| `ui`        | UI komponenty obecně        | `src/lib/components/**`                      |
| `map`       | Mapa a geolokace            | `**/Map*.svelte`, `**/tiles/**`              |
| `people`    | Správa osob, face detection | `**/People*.svelte`, `**/face-*.ts`          |
| `filters`   | Filtrace galerie            | `src/lib/stores/filters.svelte.ts`           |
| `gallery`   | Galerie, PhotoGrid          | `**/PhotoGrid*.svelte`, `**/Gallery*.svelte` |
| `lightbox`  | Lightbox/viewer             | Fancybox integrace                           |
| `collage`   | Kolážový editor             | `**/Collage*.svelte`                         |
| `i18n`      | Internacionalizace          | `messages/**`, `src/lib/i18n.ts`             |
| `manifests` | Generované manifesty        | `src/data/**/*.manifest.json`                |
| `logging`   | Logování                    | `src/lib/logger.ts`, Pino                    |

### Infrastrukturní scopes

| Scope     | Oblast                                              |
| --------- | --------------------------------------------------- |
| `scripts` | CLI skripty (`scripts/**`)                          |
| `stores`  | Svelte stores (`src/lib/stores/**`)                 |
| `types`   | TypeScript typy (`src/lib/types/**`)                |
| `utils`   | Utility funkce (`src/lib/utils/**`)                 |
| `tests`   | Testovací infrastruktura                            |
| `deps`    | Dependency updates                                  |
| `config`  | Konfigurační soubory (`*.config.*`)                 |
| `build`   | Build proces (`vite.config.ts`, `svelte.config.js`) |
| `release` | Release proces                                      |

### Komponentní scopes (PascalCase)

Pro změny v konkrétní komponentě:

| Scope                | Komponenta           |
| -------------------- | -------------------- |
| `Header`             | Header komponenta    |
| `Sidebar`            | Sidebar komponenta   |
| `PhotoGrid`          | PhotoGrid komponenta |
| `PersonDetailDialog` | Detail osoby         |

### Gallery-specific scopes

| Scope    | Oblast              |
| -------- | ------------------- |
| `egypt`  | Egypt 2025 content  |
| `israel` | Israel 2022 content |

---

## Pravidla pro scopes

### 1. Jeden scope na commit

```bash
# ✅ Správně
feat(map): add satellite layer toggle

# ❌ Špatně - více scopes
feat(map,ui): add satellite layer
```

### 2. Cross-cutting změny bez scope

Pokud změna zasahuje více oblastí, použij **bez scope**:

```bash
# ✅ Bez scope pro změny napříč codebase
refactor: convert arrow functions to named functions
```

### 3. Nebo použij nadřazený scope

```bash
# ✅ Nadřazený scope pro UI komponenty
refactor(ui): consolidate loading indicators

# V body můžeš specifikovat:
# Affected: PhotoGrid, PeopleTab, MapView
```

### 4. Lowercase, kromě komponent

```bash
feat(api): add person endpoint     # ✅ lowercase
refactor(Header): simplify nav     # ✅ PascalCase pro komponenty
feat(API): ...                     # ❌ nepoužívat UPPERCASE
```

---

## Příklady

### ✅ Správné

```bash
# Feature s scope
feat(people): add bulk detection invalidation

# Fix bez body
fix(gallery): correct filter evaluation order

# Refactoring s body
refactor(ui): consolidate loading indicators

Replaced manual spinners with LoadingOverlay component.
Affected: PhotoGrid, PeopleTab, MapView.

# Breaking change
feat(api)!: change person endpoint response format

BREAKING CHANGE: Person endpoint now returns nested object.

# Manifest regenerace (automatická)
chore(manifests): regenerate after image processing

# Dependencies
build(deps): upgrade svelte to 5.46.3

# Release (AI-generated)
chore(release): v0.2.0
```

### ❌ Špatné

```bash
# Chybí typ
update readme

# Neplatný typ pro manifesty
docs(manifests): update manifests  # manifesty nejsou dokumentace!

# Multiple scopes
feat(map,ui): add feature          # použij jeden scope

# Vágní
fix: stuff                         # buď konkrétní

# WIP/Fixup (squash!)
fixup! previous commit
```

---

## Breaking Changes

Pro breaking changes použij jeden z těchto formátů:

```bash
# S vykřičníkem v typu
feat(api)!: change response format

# S BREAKING CHANGE footer
feat(api): change response format

BREAKING CHANGE: Response now returns nested object.
```

---

## Release proces (AI-driven)

Projekt používá **AI agent** pro automatizované release pomocí `/release` workflow.

### Jak funguje AI release

1. **Analyzuje commit historii** od posledního tagu (nebo celou historii)
2. **Parsuje conventional commits** a kategorizuje je
3. **Určí SemVer verzi** (MAJOR/MINOR/PATCH)
4. **Vygeneruje CHANGELOG.md** s emoji sekcemi
5. **Aktualizuje package.json**
6. **Vytvoří release commit** a tag
7. **Nabídne push** na remote

### CHANGELOG formát

```markdown
## [X.Y.Z] - YYYY-MM-DD

### ⚠️ BREAKING CHANGES

- feat(api)!: change endpoint format ([hash](link))

### ✨ Features

- feat(map): add satellite layer ([hash](link))
- feat(people): bulk detection ([hash](link))

### 🐛 Bug Fixes

- fix(gallery): filter evaluation ([hash](link))

### ⚡ Performance

- perf(gallery): lazy loading ([hash](link))
```

### Spuštění release

```bash
# V konverzaci s AI agentem:
/release
```

AI agent provede všechny kroky a vygeneruje CHANGELOG včetně retroaktivní analýzy celé historie.

---

## Reference

- [Conventional Commits 1.0.0](https://www.conventionalcommits.org/en/v1.0.0/)
- [Semantic Versioning 2.0.0](https://semver.org/)
- [Keep a Changelog](https://keepachangelog.com/en/1.1.0/)
- [Angular Commit Guidelines](https://github.com/angular/angular/blob/main/CONTRIBUTING.md#-commit-message-format)
