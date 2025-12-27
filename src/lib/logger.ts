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

function getLogLevel(): string {
  if (browser) {
    return dev ? "debug" : "warn";
  }

  // Use process.env which is available in both Bun and Node environments
  return process.env.LOG_LEVEL || "info";
}

const logger = pino({
  level: getLogLevel(),
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
    trace: (msg: unknown, ...args: unknown[]) => child.trace(msg as any, ...(args as any[])),
    // biome-ignore lint/suspicious/noExplicitAny: wrapper for pino
    debug: (msg: unknown, ...args: unknown[]) => child.debug(msg as any, ...(args as any[])),
    // biome-ignore lint/suspicious/noExplicitAny: wrapper for pino
    info: (msg: unknown, ...args: unknown[]) => child.info(msg as any, ...(args as any[])),
    // biome-ignore lint/suspicious/noExplicitAny: wrapper for pino
    warn: (msg: unknown, ...args: unknown[]) => child.warn(msg as any, ...(args as any[])),
    // biome-ignore lint/suspicious/noExplicitAny: wrapper for pino
    error: (msg: unknown, ...args: unknown[]) => child.error(msg as any, ...(args as any[])),
    // biome-ignore lint/suspicious/noExplicitAny: wrapper for pino
    fatal: (msg: unknown, ...args: unknown[]) => child.fatal(msg as any, ...(args as any[])),
    // biome-ignore lint/suspicious/noExplicitAny: wrapper for pino
    verbose: (msg: unknown, ...args: unknown[]) => child.debug(msg as any, ...(args as any[])),
  };
}
export type Logger = ReturnType<typeof createLogger>;

export const log = createLogger();
