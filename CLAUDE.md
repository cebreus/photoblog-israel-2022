# CLAUDE.md

Instructions for Claude Code (claude.ai/code) when working with this repository.

## Project summary

Multi-gallery SvelteKit photoblog on Bun runtime. Each gallery has content in `content/<gallery>/`, generated assets in `static/<gallery>/`, manifests in `src/data/<gallery>/`. System controlled by `CONTENT_DIR` environment variable.

**Full documentation:** [README.md](./README.md), [docs/INDEX.md](./docs/INDEX.md)

## Completion rules (must follow)

- **Run formatting until clean, then run check:** `pnpm format` (or `bun run format`) as many times as needed, and only after the last successful format run execute `pnpm check` (or `bun run check`). `check` must follow the final format.
- If you cannot run them, say so explicitly in the handoff; otherwise assume failure and do not hand off.
- Ensure commands use the correct `CONTENT_DIR` for the targeted gallery.

### Essential commands

- Install: `bun install`
- Dev: `bun run dev` (interactive) or `bun run dev -- -g <gallery>`
- Build: `bun run build -- -g <gallery>`
- Tests: `bun run test` (all), `bun run test:unit`, `CONTENT_DIR=<gallery> bun run vitest run --project client`

### Runtime discipline

- **Use Bun-native APIs:** `Bun.file`, `Bun.write`, `Bun.env`, `Bun.spawn`, `Bun.password`. Avoid Node sync I/O; if you need `mkdir`/`readdir`, use `node:fs/promises` per project rules.
- Do not replace Bun helpers with Node equivalents; respect existing runtime-specific utilities in the repo.
- Testing: Vitest only (`import { describe, it, expect } from "vitest"`), never `bun:test`.

### Logging discipline

- Use provided Pino loggers (`src/lib/logger.ts`, `scripts/lib/core/cli-logger.ts`).
- Avoid `console.log`/`console.error`; emit structured logs with context + message.

### CONTENT_DIR scope

- Do not hardcode gallery paths; always honor `CONTENT_DIR` when touching content, manifests, static assets.
- Keep CLI flags (`--gallery/-g`) and env `CONTENT_DIR` in sync; do not mix galleries within one run.

## Bun-native API quick reference

| Avoid (Node.js)                   | Use (Bun)                        |
| --------------------------------- | -------------------------------- |
| `fs.readFileSync(path, 'utf8')`   | `await Bun.file(path).text()`    |
| `fs.writeFileSync(path, data)`    | `await Bun.write(path, data)`    |
| `fs.existsSync(path)`             | `await Bun.file(path).exists()`  |
| `process.env.KEY`                 | `Bun.env.KEY`                    |
| `child_process.spawn`             | `Bun.spawn([...])`               |
| `import fg from 'fast-glob'`      | `new Bun.Glob('**/*.ts').scan()` |
| `JSON.parse(fs.readFileSync(..))` | `await Bun.file(..).json()`      |
| `import { randomUUID } from ...`  | `crypto.randomUUID()`            |

Exceptions: use `node:fs/promises` for `mkdir`, `readdir` (Bun lacks native equivalents).

---

**Last updated:** 2026-01-05
