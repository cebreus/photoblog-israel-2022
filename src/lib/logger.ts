import pino from "pino";
import { browser, dev } from "$app/environment";

// Define levels to match across FE/BE
const _levels = {
  trace: 10,
  debug: 20,
  info: 30,
  warn: 40,
  error: 50,
  fatal: 60,
};

const logger = pino({
  level: browser ? (dev ? "debug" : "warn") : process.env.LOG_LEVEL || "info",
  browser: {
    asObject: true,
    transmit: {
      level: "warn", // Only transmit warn and above to the server
      send: (level, logEvent) => {
        if (browser && !dev) {
          const msg = logEvent.messages[0];
          const bindings = logEvent.bindings;
          fetch("/api/log", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              level,
              msg,
              ...bindings,
              ts: logEvent.ts,
            }),
          }).catch(() => {
            /* Silently fail if bridge is down */
          });
        }
      },
    },
  },
});

export function createLogger(label = "app") {
  const child = logger.child({ label });

  return {
    // biome-ignore lint/suspicious/noExplicitAny: wrapper for pino
    trace: (msg: any, ...args: any[]) => child.trace(msg, ...args),
    // biome-ignore lint/suspicious/noExplicitAny: wrapper for pino
    debug: (msg: any, ...args: any[]) => child.debug(msg, ...args),
    // biome-ignore lint/suspicious/noExplicitAny: wrapper for pino
    info: (msg: any, ...args: any[]) => child.info(msg, ...args),
    // biome-ignore lint/suspicious/noExplicitAny: wrapper for pino
    warn: (msg: any, ...args: any[]) => child.warn(msg, ...args),
    // biome-ignore lint/suspicious/noExplicitAny: wrapper for pino
    error: (msg: any, ...args: any[]) => child.error(msg, ...args),
    // biome-ignore lint/suspicious/noExplicitAny: wrapper for pino
    fatal: (msg: any, ...args: any[]) => child.fatal(msg, ...args),
    // biome-ignore lint/suspicious/noExplicitAny: wrapper for pino
    verbose: (msg: any, ...args: any[]) => child.debug(msg, ...args),
  };
}

export const log = createLogger();
