import { log } from "$lib/logger";

/**
 * Generates a short, human-readable request ID.
 * Format: req-[random4] (e.g., req-a1b2)
 */
function generateRequestId(): string {
  // Simple 4-char random hex string
  const random = Math.floor(Math.random() * 0xffff)
    .toString(16)
    .padStart(4, "0");
  return `req-${random}`;
}

/**
 * Universal wrapper for fetch that adds E2E tracing.
 * Generates traceId, logs on FE, and passes to backend via X-Request-ID header.
 *
 * Features:
 * - Human-readable IDs (e.g., req-a1b2)
 * - Infinite loop protection (skips logging for /api/log)
 * - Automatic X-Request-ID propagation
 *
 * @example
 * const response = await tracedFetch('/api/images/123', { method: 'DELETE' });
 */
export async function tracedFetch(url: string, options: RequestInit = {}): Promise<Response> {
  // CRITICAL: Infinite loop protection
  // If we are sending logs, we must NOT log that request, otherwise:
  // Log -> fetch(/api/log) -> tracedFetch -> Log -> fetch(/api/log) ...
  if (url.includes("/api/log")) {
    return fetch(url, options);
  }

  const traceId = generateRequestId();
  const method = options.method || "GET";

  // Log intent to perform action on frontend
  let parsedBody: unknown;
  if (options.body && typeof options.body === "string") {
    try {
      parsedBody = JSON.parse(options.body);
    } catch {
      parsedBody = options.body;
    }
  }

  log.info(
    {
      traceId,
      url,
      method,
      body: parsedBody,
    },
    `FE > Starting ${traceId} ${method} ${url}`,
  );

  // Attach header for backend
  const headers = new Headers(options.headers);
  headers.set("X-Request-ID", traceId);
  options.headers = headers;

  const startTime = performance.now();

  try {
    const response = await fetch(url, options);
    const duration = Math.round(performance.now() - startTime);

    // Verify correlation: Did backend acknowledge our ID?
    const responseId = response.headers.get("X-Request-ID");
    const idMatch = responseId === traceId;

    const logPayload = {
      traceId,
      url,
      status: response.status,
      durationMs: duration,
      idMatch,
      ...(idMatch ? {} : { responseId }), // Log mismatch if present
    };

    if (response.ok) {
      log.info({ ...logPayload }, `FE > Finished ${traceId} ${method} ${url} → ${response.status}`);
    } else {
      log.warn({ ...logPayload }, `FE > Failed ${traceId} ${method} ${url} → ${response.status}`);
    }

    return response;
  } catch (error) {
    const duration = Math.round(performance.now() - startTime);
    log.error(
      {
        err: error,
        traceId,
        url,
        durationMs: duration,
      },
      `FE > Error ${traceId} ${method} ${url}`,
    );
    throw error;
  }
}
