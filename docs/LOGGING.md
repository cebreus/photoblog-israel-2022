# Logování

> Strukturované logování s Pino, wide events a E2E trasování.

**Navigace:** [← INDEX](./INDEX.md) | [CODE-QUALITY →](./CODE-QUALITY.md)

## Obsah

1. [Cíl](#cíl)
2. [Wide Events v SvelteKit](#wide-events-v-sveltekit)
3. [Strukturované logování](#strukturované-logování)
4. [Logování ve skriptech](#logování-ve-skriptech)
5. [E2E trasování](#e2e-trasování)
6. [Doporučené postupy](#doporučené-postupy)

## Cíl

Zavést strukturované logování a koncept "širokých událostí" (wide events), aby bylo logování:

- Strojově čitelné a filtrovatelné
- Obsahovalo maximum kontextu pro ladění
- Umožnilo end-to-end trasování požadavků

**Implementováno:** Pino logger s wide events (hooks.server.ts), E2E trasování přes tracedFetch.

## Wide Events v SvelteKit

Princip "široké události" = **jeden souhrnný log pro každý HTTP požadavek** s veškerým relevantním kontextem.

### Implementace v hooks.server.ts

```typescript
// src/hooks.server.ts
import type { Handle } from "@sveltejs/kit";

import { log as rootLogger } from "$lib/logger";

export const handle: Handle = async ({ event, resolve }) => {
  // 1. Získáme traceId z FE (X-Request-ID), nebo vygenerujeme nové
  const incomingTraceId = event.request.headers.get("X-Request-ID");
  const requestId = incomingTraceId || crypto.randomUUID();

  // 2. Vytvoříme child logger s kontextem požadavku
  const requestLogger = rootLogger.child({
    requestId,
    route: event.route.id,
    method: event.request.method,
    path: event.url.pathname,
  });

  // 3. Zpřístupníme logger v event.locals
  event.locals.log = requestLogger;
  event.locals.logContext = {}; // Objekt pro sběr byznys kontextu

  // Log začátku
  const startTime = performance.now();
  requestLogger.info({ stage: "start" }, "Request received");

  const response = await resolve(event);

  // Log konce s nasbíraným kontextem
  requestLogger.info(
    {
      stage: "end",
      status: response.status,
      durationMs: Math.round(performance.now() - startTime),
      ...event.locals.logContext,
    },
    "Request finished",
  );

  return response;
};
```

### Použití v API routes

```typescript
// routes/api/people/merge/+server.ts
export async function POST({ request, locals }) {
  const { log, logContext } = locals; // Logger s requestId

  const { from, to } = await request.json();

  // Obohatíme kontext pro finální log
  logContext.peopleMerge = { from, to };

  try {
    // ... logika
    log.info({ successfulMerges: 1 }, "Merge operation successful");
  } catch (err) {
    log.error({ err }, "Merge operation failed");
    // ...
  }
}
```

## Strukturované logování

Konzistentní formát: **objekt s kontextem + statická zpráva**.

| Situace         | ❌ Špatně                                | ✅ Správně                                                        |
| --------------- | ---------------------------------------- | ----------------------------------------------------------------- |
| Kontext         | `log.info(\`User ${userId} logged in\`)` | `log.info({ userId }, 'User logged in')`                          |
| Data            | `log.debug("Data:", data)`               | `log.debug({ data }, 'Processing data')`                          |
| Chyba           | `log.error("Chyba:", err)`               | `log.error({ err }, 'Operace selhala')`                           |
| Chyba + kontext | `log.error(err)`                         | `log.error({ err, userId }, 'Nepodařilo se aktualizovat profil')` |

**Klíčové:** První argument = objekt s kontextem, druhý = statická zpráva. Pino automaticky formátuje pole `err`.

## Logování ve skriptech

Logger pro skripty (`scripts/lib/core/cli-logger.ts`) podporuje duální režim:

- **Interaktivní** (default): Barevný, formátovaný výstup pro terminál
- **JSON** (`LOG_FORMAT=json`): Čistý JSON pro strojové zpracování

```bash
# Běžné spuštění (barevný výstup)
bun run images:build

# JSON režim pro logování do souboru
LOG_FORMAT=json bun run images:build > build.log
```

### Implementace duálního režimu

```typescript
// scripts/lib/core/cli-logger.ts
export function createLogger(label: string) {
  // JSON režim pro strojové zpracování
  if (process.env.LOG_FORMAT === "json") {
    const logger = pino({ level: process.env.LOG_LEVEL || "info" });
    return logger.child({ label });
  }

  // Hezký formátovaný výstup pro terminál
  const stream = {
    write(msg: string) {
      // ... formátování s barvami
    },
  };

  return pino(
    {
      /* ... */
    },
    stream,
  );
}
```

## E2E trasování

Propojení akcí uživatele v prohlížeči s logy na serveru přes `traceId`.

### Frontend: tracedFetch

```typescript
// src/lib/utils/api.ts
import { log } from "$lib/logger";

export async function tracedFetch(url: string, options: RequestInit = {}) {
  const traceId = crypto.randomUUID();

  // Log na FE
  log.info({ traceId, url, method: options.method || "GET" }, "FE Trace: Initiating API call");

  // Připojíme hlavičku pro backend
  const headers = new Headers(options.headers);
  headers.set("X-Request-ID", traceId);
  options.headers = headers;

  return fetch(url, options);
}
```

### Backend: hooks.server.ts

```typescript
// Čte X-Request-ID z požadavku
const incomingTraceId = event.request.headers.get("X-Request-ID");
const requestId = incomingTraceId || crypto.randomUUID();
```

### Příklad životního cyklu

1. Uživatel klikne "Smazat fotku IMG_1234.jpg"
2. FE: `tracedFetch` generuje `traceId: "abc-123"`
3. **FE Log:** `{ traceId: "abc-123", url: "/api/images/IMG_1234.jpg", msg: "FE Trace: Initiating API call" }`
4. FE odešle fetch s hlavičkou `X-Request-ID: abc-123`
5. **BE Log (start):** `{ requestId: "abc-123", stage: "start", msg: "Request received" }`
6. **BE Log (operation):** `{ requestId: "abc-123", file: "IMG_1234.jpg", msg: "Deleting file from disk" }`
7. **BE Log (end):** `{ requestId: "abc-123", stage: "end", status: 200, msg: "Request finished" }`

→ Vyhledáním `requestId: "abc-123"` získáte kompletní, chronologický přehled operace napříč FE/BE.

## Doporučené postupy

### 1. Vždy používejte logger z event.locals

```typescript
// ❌ Špatně
import { log } from "$lib/logger";

export async function POST({ request }) {
  log.info("Processing..."); // Chybí requestId
}

// ✅ Správně
export async function POST({ request, locals }) {
  const { log } = locals; // Logger s requestId
  log.info("Processing...");
}
```

### 2. Aktivně plňte logContext

```typescript
export async function POST({ request, locals }) {
  const { log, logContext } = locals;
  const { userId, action } = await request.json();

  // Obohatíme kontext pro finální log
  logContext.userId = userId;
  logContext.action = action;

  // ... operace
  logContext.itemsProcessed = 5;

  // Kontext se automaticky připojí k finálnímu logu
}
```

### 3. Logujte objekty, ne stringy

```typescript
// ❌ Špatně
log.info("Processing user " + userId + " with data " + JSON.stringify(data));

// ✅ Správně
log.info({ userId, data }, "Processing user data");
```

### 4. Používejte tracedFetch pro API volání

```typescript
// ❌ Špatně
const response = await fetch("/api/images/123", { method: "DELETE" });

// ✅ Správně (automatické E2E trasování)
const response = await tracedFetch("/api/images/123", { method: "DELETE" });
```

## Architektonický kontext

### Proč oddělené logy start/end?

Místo jedné atomické události na konci požadavku používáme dva logy spojené `requestId`. Důvody:

- **Pragmatický kompromis:** Jediná událost by vyžadovala složité bufferování mezilehlých logů
- **80/20 princip:** Současný model přináší 80 % přínosů (trasovatelnost) s 20 % úsilí
- **Jednoduchost:** Méně complexity v kódu, stejná trasovatelnost díky `requestId`

### Omezení a budoucí rozšíření

- **Asynchronní úlohy:** Pro background tasky je nutné manuálně předat `requestId`, aby zůstaly v trasovacím řetězci
- **Externí služby:** Aktuální implementace nepočítá s odesíláním logů do externích systémů (Datadog, Sentry apod.)

## Související dokumenty

- [INDEX.md](./INDEX.md) — Rozcestník dokumentace
- [CODE-QUALITY.md](./CODE-QUALITY.md) — QA nástroje a workflow
- [ARCH-DEV.md](./ARCH-DEV.md) — Development workflow

---

_Poslední aktualizace: 2026-01-05_
