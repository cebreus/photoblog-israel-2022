import type { Handle } from "@sveltejs/kit";

import { log as rootLogger } from "$lib/logger";

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

  // Log začátku požadavku
  const startTime = performance.now();
  requestLogger.info({ stage: "start" }, "Request received");

  // Zpracování požadavku
  const response = await resolve(event);

  // 4. Log konce požadavku s nasbíraným byznys kontextem
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
