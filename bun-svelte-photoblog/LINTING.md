# Linting a formátování

Tento projekt používá [Biome](https://biomejs.dev/) pro linting a formátování kódu a [Prettier](https://prettier.io/) pro formátování specifických typů souborů.

## Příkazy

### Kontrola kódu

Pro spuštění linteru a kontrolu chyb v kódu použijte následující příkaz:

```bash
bun run lint
```

Pro automatickou opravu chyb:

```bash
bun run lint:fix
```

### Formátování

Pro automatické formátování kódu v celém projektu (používá Biome i Prettier):

```bash
bun run format
```

Pro kontrolu, zda je kód správně naformátován (bez provádění změn):

```bash
bun run format:check
```

## Pre-commit Hook

Projekt je nastaven tak, aby automaticky spouštěl linting a formátování na změněných souborech před každým commitem pomocí `husky` a `lint-staged`. Tím je zajištěna konzistence kódu v repozitáři.
