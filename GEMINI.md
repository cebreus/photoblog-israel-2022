# GEMINI.md

Instructions for Google Gemini CLI when working with this repository.

## Project summary

Multi-gallery SvelteKit photoblog on Bun runtime. Each gallery has content in `content/<gallery>/`, generated assets in `static-<gallery>/`, manifests in `src/data/<gallery>/`. System controlled by `CONTENT_DIR` environment variable.

**Full documentation:** [README.md](./README.md), [docs/INDEX.md](./docs/INDEX.md)

## Completion rules (do not skip)

- **Run formatting until clean, then run check:** `pnpm format` (or `bun run format`) as many times as needed, and only after the last successful format run execute `pnpm check` (or `bun run check`). `check` must follow the final format.
- If you cannot run them, state that explicitly in the handoff. Otherwise assume failure → do not hand off.
- Keep `CONTENT_DIR` correct for any command that needs gallery context.

### Essential commands

- Install: `bun install`
- Dev: `bun run dev` (interactive) or `bun run dev -- -g <gallery>`
- Build: `bun run build -- -g <gallery>`
- Tests: `bun run test` (all), `bun run test:unit`, `CONTENT_DIR=<gallery> bun run vitest run --project client`

### Runtime discipline

- **Bun-first**: use `Bun.file`, `Bun.write`, `Bun.env`, `Bun.spawn`, `Bun.password`. Avoid Node sync I/O; use `node:fs/promises` only where Bun lacks an API (e.g., `mkdir`, `readdir`).
- Respect per-runtime helpers already in the codebase; do not replace Bun-native helpers with Node equivalents.
- Vitest only (`import { describe, it, expect } from "vitest"`); never `bun:test`.

### Logging discipline

- Use the provided Pino loggers (`src/lib/logger.ts`, `scripts/lib/core/cli-logger.ts`).
- Do not add `console.log`/`console.error`; use structured logging with context objects and messages.

### CONTENT_DIR scope

- Never hardcode gallery paths; always honor `CONTENT_DIR` when reading/writing content, manifests, or static assets.
- CLI flags `--gallery/-g` and env `CONTENT_DIR` must stay consistent; do not mix galleries in a single run.

---

**Last updated:** 2026-01-05

```

```
