import type { Handle } from "@sveltejs/kit";
import path from "node:path";

import { log as rootLogger } from "$lib/logger";
import { runWithLogger } from "$lib/server/request-context";
import { startTaskWatcher } from "$lib/server/task-watcher";
import { setIoLogger } from "$scripts/lib/utils/io-logger-bridge";

// Initialize task watchers for all galleries on server start
const contentDir = process.env.CONTENT_DIR || "egypt-2025";
const dataDir = path.resolve(process.cwd(), `src/data/${contentDir}`);
await startTaskWatcher(contentDir, dataDir);

// Wire up runtime IO logging to App Logger
setIoLogger(rootLogger);

export const handle: Handle = async ({ event, resolve }) => {
  // 1. Get traceId from FE or generate new one.
  const incomingTraceId = event.request.headers.get("X-Request-ID");
  const requestId = incomingTraceId || crypto.randomUUID();

  // 2. Create child logger with request context
  const requestLogger = rootLogger.child({
    requestId,
    method: event.request.method,
    path: event.url.pathname,
  });

  // 3. Attach logger to locals for API routes
  event.locals.log = requestLogger;
  event.locals.logContext = {};

  // Capture Request Body (for debugging)
  // We clone the request because reading the body consumes the stream
  let requestBody: unknown;
  if (event.request.method !== "GET" && event.request.method !== "HEAD") {
    try {
      const clonedReq = event.request.clone();
      const contentType = clonedReq.headers.get("content-type");
      if (contentType?.includes("application/json")) {
        requestBody = await clonedReq.json();
      } else if (contentType?.includes("text/")) {
        const text = await clonedReq.text();
        requestBody = text.slice(0, 1000); // Limit length
      } else if (contentType?.includes("multipart/form-data")) {
        requestBody = "[Multipart data]";
      }
    } catch (_e) {
      requestBody = "[Failed to read request body]";
    }
  }

  // Process request (with context)
  const startTime = performance.now();

  // Wrap resolve in runWithLogger to propagate context to all async operations (IO, etc.)
  let response = await runWithLogger(requestLogger, async () => {
    return await resolve(event);
  });

  // Capture Response Body (only for JSON responses to verify data returned)
  let responseBody: unknown;
  const isApiRoute = event.url.pathname.startsWith("/api");
  const isError = response.status >= 400;
  const isVerbose = process.env.VERBOSE === "true" || process.env.LOG_LEVEL === "debug";
  const shouldSkip = event.locals.skipRequestLog === true;
  const shouldLog = !shouldSkip && (isApiRoute || isError || isVerbose);

  if (shouldLog) {
    const contentType = response.headers.get("content-type");
    if (contentType?.includes("application/json")) {
      try {
        // Clone to read without consuming
        const clonedRes = response.clone();
        responseBody = await clonedRes.json();
      } catch (_e) {
        responseBody = "[Failed to read response body]";
      }
    }
  }

  if (shouldLog) {
    const duration = Math.round(performance.now() - startTime);

    const logPayload: Record<string, unknown> = {
      status: response.status,
      durationMs: duration,
      ...event.locals.logContext,
    };

    // Add request/response bodies to payload (suppressed in console, visible in file logs)
    if (requestBody) {
      logPayload.payload = requestBody;
    }
    if (responseBody) {
      logPayload.responseBody = responseBody;
    }

    requestLogger.info(
      logPayload,
      `${event.request.method} ${event.url.pathname} → ${response.status} (${duration}ms)`,
    );
  }

  // 4. Mirror request ID in response so client can correlate logs
  response.headers.set("X-Request-ID", requestId);

  return response;
};
