# 🚀 Bun Project Guidelines for AI Copilot

This project runs on **Bun** runtime. You must adhere to the following ecosystem rules to ensure performance and compatibility.

## 1. File System Operations (CRITICAL)

Bun's native I/O is optimized and significantly faster (up to 3x) than Node.js `fs`.

| Node.js (❌ AVOID)              | Bun (✅ USE)                                  | Notes                       |
| ------------------------------- | --------------------------------------------- | --------------------------- |
| `fs.readFileSync(path, 'utf8')` | `await Bun.file(path).text()`                 | Native text reading         |
| `fs.readFileSync(path)`         | `await Bun.file(path).arrayBuffer()`          | Native binary reading       |
| `fs.writeFileSync(path, data)`  | `await Bun.write(path, data)`                 | 3x faster write             |
| `fs.existsSync(path)`           | `await Bun.file(path).exists()`               | Async existence check       |
| `fs.statSync(path)`             | `await Bun.file(path).size` / `.lastModified` | Native file stats           |
| `fs.promises.readFile(...)`     | `await Bun.file(path).text()`                 | Prefer Bun over fs/promises |

**Exceptions:**

- `mkdir` / `mkdirSync`: Bun does not have a native replacement yet. Use `import { mkdir } from "node:fs/promises"`.
- `readdir` / `readdirSync`: Use `import { readdir } from "node:fs/promises"`.

## 2. Environment Variables

Bun reads `.env` files natively at startup.

| Node.js (❌ AVOID)           | Bun (✅ USE)                       |
| ---------------------------- | ---------------------------------- |
| `process.env.API_KEY`        | `Bun.env.API_KEY`                  |
| `require('dotenv').config()` | _(Bun handles this automatically)_ |

## 3. Shell Commands / Child Processes

Bun has a superior, optimized spawner.

| Node.js (❌ AVOID)         | Bun (✅ USE)       |
| -------------------------- | ------------------ |
| `child_process.spawn(...)` | `Bun.spawn([...])` |
| `child_process.exec(...)`  | `Bun.spawn([...])` |

Example:

```typescript
const proc = Bun.spawn(["echo", "hello"], {
  stdout: "pipe",
});
const text = await new Response(proc.stdout).text();
```

## 4. Hashing & Cryptography

Use Bun's native optimized implementations.

| Node.js / Libs (❌ AVOID) | Bun (✅ USE)                     |
| ------------------------- | -------------------------------- |
| `bcrypt.hash(...)`        | `await Bun.password.hash(...)`   |
| `bcrypt.compare(...)`     | `await Bun.password.verify(...)` |

## 5. Testing Framework

⚠️ **IMPORTANT:** This project uses **Vitest**, NOT `bun:test`.

- **DO NOT** use `import { describe, test } from "bun:test"`.
- **ALWAYS** use `import { describe, it, expect } from "vitest"`.

The project is configured to run Vitest via Bun (`bun run test`), but the framework itself is Vitest.

## 6. Import Organization

- **NEVER** manually sort imports. Prettier handles this automatically.
- **ALWAYS** organize imports into groups:
  1. `node:*` built-ins
  2. `bun`
  3. Third-party packages
  4. SvelteKit aliases (`$lib`, `$app`)
  5. Relative imports
  - **ALWAYS** separate third-party and local imports.

## 7. Advanced Performance Patterns

| Node.js / Libs (❌ AVOID)         | Bun (✅ USE)                     | Why?                                             |
| --------------------------------- | -------------------------------- | ------------------------------------------------ |
| `import fg from 'fast-glob'`      | `new Bun.Glob('**/*.ts').scan()` | Native C++ implementation, no V8 overhead.       |
| `JSON.parse(fs.readFileSync(..))` | `await Bun.file(..).json()`      | Direct buffer parsing, avoids string allocation. |
| `zlib.gzipSync(data)`             | `Bun.gzipSync(data)`             | Optimized native compression.                    |
| `crypto.createHash('md5')`        | `Bun.hash(data)`                 | **For non-crypto only**: 5-10x faster (Wyhash).  |
| `setTimeout(..., ms)`             | `Bun.sleep(ms)`                  | Cleaner syntax, native implementation.           |

## 8. TypeScript & Modules

- Use `verbatimModuleSyntax` style for imports/exports.
- Prefer `import type { ... }` for type-only imports to help the compiler.
