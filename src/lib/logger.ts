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
    // Frontend: debug in dev, warn in production
    return dev ? "debug" : "warn";
  }

  // Backend: Use LOG_LEVEL env var, default to info in dev, error in production
  if (process.env.LOG_LEVEL) {
    return process.env.LOG_LEVEL;
  }

  return dev ? "info" : "error";
}

const logger = pino({
  level: getLogLevel(),
  // Add FE/BE distinction to all logs
  base: {
    env: browser ? "FE" : "BE",
  },
  // Use pino-pretty for server-side dev logging
  transport:
    !browser && dev
      ? {
          target: "pino-pretty",
          options: {
            colorize: true,
            ignore: "pid,hostname",
            translateTime: "HH:MM:ss",
            messageFormat: "{env} > {label} \t {msg}", // Custom format: BE > app   Message
          },
        }
      : undefined,
  browser: {
    asObject: true,
    transmit: {
      level: "info", // Transmit info and above to the server
      send: (level, logEvent) => {
        if (browser && dev) {
          const { messages, bindings, ts } = logEvent;

          // Find the first string to use as the message
          const msgIndex = messages.findIndex((m) => typeof m === "string");
          const msg = msgIndex !== -1 ? (messages[msgIndex] as string) : "";

          // All other arguments (including objects) are passed as 'args'
          const args = messages.filter((_, i) => i !== msgIndex);

          fetch("/api/log", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              level,
              msg: msg || undefined,
              args: args.length > 0 ? args : undefined,
              ...bindings,
              ts,
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

  return child;
}
export type Logger = ReturnType<typeof createLogger>;

export const log = createLogger();
