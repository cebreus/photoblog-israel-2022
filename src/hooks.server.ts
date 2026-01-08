import path from "node:path";
import type { Handle } from "@sveltejs/kit";

import { log as rootLogger } from "$lib/logger";
import { startTaskWatcher } from "$lib/server/task-watcher";

// Initialize task watchers for all galleries on server start
const contentDir = process.env.CONTENT_DIR || "egypt-2025";
const dataDir = path.resolve(process.cwd(), `src/data/${contentDir}`);
await startTaskWatcher(contentDir, dataDir);

export const handle: Handle = async ({ event, resolve }) => {
  // 1. Získáme traceId z FE, pokud existuje. Jinak vygenerujeme nové.
  const incomingTraceId = event.request.headers.get("X-Request-ID");
  const requestId = incomingTraceId || crypto.randomUUID();

  // 2. Vytvořte "dítě" hlavního loggeru s kontextem požadavku
  const requestLogger = rootLogger.child({
    requestId,
    route: event.route.id,
    method: event.request.method,
    path: event.url.pathname,
  });

  // 3. Přidejte logger do `event.locals`, aby byl dostupný v API trasách
  event.locals.log = requestLogger;
  event.locals.logContext = {};

  // Zpracování požadavku
  const startTime = performance.now();
  const response = await resolve(event);

  // Log podle typu požadavku a verbose režimu
  const isApiRoute = event.url.pathname.startsWith("/api");
  const isError = response.status >= 400;
  const isVerbose = process.env.VERBOSE === "true" || process.env.LOG_LEVEL === "debug";
  const shouldSkip = event.locals.skipRequestLog === true;

  if (!shouldSkip && (isApiRoute || isError || isVerbose)) {
    const duration = Math.round(performance.now() - startTime);
    requestLogger.info(
      {
        status: response.status,
        durationMs: duration,
        ...event.locals.logContext,
      },
      `${event.request.method} ${event.url.pathname} → ${response.status} (${duration}ms)`,
    );
  }

  return response;
};
