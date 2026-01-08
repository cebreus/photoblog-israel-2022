import { json, type RequestHandler } from "@sveltejs/kit";
import { createLogger } from "$lib/logger";

export const POST: RequestHandler = async ({ request, locals }) => {
  // Suppress automatic request logging for this endpoint to avoid noise
  // The frontend logs are already being re-logged through the logger
  locals.skipRequestLog = true;

  try {
    const { level, msg, label, ...rest } = await request.json();

    const logLabel = label ? `fe:${label}` : "fe";
    const child = createLogger(logLabel);

    // Map level number to method name if needed, but Pino handles numeric levels too
    // However, our wrapper 'createLogger' returns an object with named methods.
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

    // biome-ignore lint/suspicious/noExplicitAny: dynamic method access
    (child as any)[methodName](logObj, msg);

    return json({ success: true });
  } catch (_err) {
    return json({ error: "Failed to process log" }, { status: 500 });
  }
};
