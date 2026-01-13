import { createLogger } from "$lib/logger";
import { json, type RequestHandler } from "@sveltejs/kit";

export async function POST({ request, locals }: Parameters<RequestHandler>[0]) {
  // Suppress automatic request logging for this endpoint to avoid noise
  // The frontend logs are already being re-logged through the logger
  locals.skipRequestLog = true;

  try {
    const { level, msg, label, traceId, ...rest } = await request.json();

    const logLabel = label ? `fe:${label}` : "fe";
    // Propagate traceId as requestId if provided
    const child = createLogger(logLabel).child(traceId ? { requestId: traceId } : {});

    // Map numeric logging levels to method names for compatibility with our wrapper
    const levelMap: Record<number, string> = {
      10: "trace",
      20: "debug",
      30: "info",
      40: "warn",
      50: "error",
      60: "fatal",
    };

    const methodName = levelMap[level as number] || "info";

    // Flatten args if it's a single object to keep logs flat and readable
    let logObj = rest;
    if (Array.isArray(rest.args) && rest.args.length === 1 && typeof rest.args[0] === "object") {
      const { args, ...others } = rest;
      logObj = { ...others, ...args[0] };
    }

    const loggerWithMethods = child as unknown as Record<
      string,
      (obj: object, msg?: string) => void
    >;
    if (typeof loggerWithMethods[methodName] === "function") {
      loggerWithMethods[methodName](logObj, msg);
    }

    return json({ success: true });
  } catch (_err) {
    return json({ error: "Failed to process log" }, { status: 500 });
  }
}
