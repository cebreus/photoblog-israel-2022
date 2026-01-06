import { log } from "$lib/logger";

/**
 * Univerzální wrapper pro fetch, který přidává E2E trasování.
 * Generuje traceId, loguje na FE a předává backend přes X-Request-ID hlavičku.
 *
 * @example
 * const response = await tracedFetch('/api/images/123', { method: 'DELETE' });
 */
export async function tracedFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const traceId = crypto.randomUUID();

  // Logujeme záměr provést akci na frontendu
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
      method: options.method || "GET",
      body: parsedBody,
    },
    "FE Trace: Initiating API call",
  );

  // Připojíme hlavičku pro backend
  const headers = new Headers(options.headers);
  headers.set("X-Request-ID", traceId);
  options.headers = headers;

  try {
    const response = await fetch(url, options);

    if (!response.ok) {
      log.warn(
        {
          traceId,
          url,
          status: response.status,
          statusText: response.statusText,
        },
        "FE Trace: API call failed",
      );
    }

    return response;
  } catch (error) {
    log.error(
      {
        err: error,
        traceId,
        url,
      },
      "FE Trace: API call threw error",
    );
    throw error;
  }
}
