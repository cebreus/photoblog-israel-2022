import { json, type RequestHandler } from "@sveltejs/kit";
import { createLogger } from "$lib/logger";

export const POST: RequestHandler = async ({ request }) => {
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
    // biome-ignore lint/suspicious/noExplicitAny: dynamic method access
    (child as any)[methodName](msg, rest);

    return json({ success: true });
  } catch (_err) {
    return json({ error: "Failed to process log" }, { status: 500 });
  }
};
