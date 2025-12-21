import pc from "picocolors";
import winston from "winston";
import { progressManager } from "./progress-manager";

const { combine, printf } = winston.format;

const levelColors: Record<string, (str: string) => string> = {
  error: pc.red,
  warn: pc.yellow,
  info: pc.cyan,
  verbose: pc.dim,
  debug: pc.magenta,
};

export function createLogger(label: string) {
  function identity(str: string) {
    return str;
  }

  function customFormatter(payload: any) {
    const levelUpper = String(payload.level || "").toUpperCase();
    const colorizer = levelColors[payload.level] || identity;

    if (process.env.LOG_STYLE === "boxed") {
      // Boxed style: no timestamp, added vertical line prefix to every line
      // manage process uses single bar, others use double bar for nested look
      let bar = label === "manage" ? `${pc.dim("│")}  ` : `${pc.dim("│ │")} `;
      let message = payload.message;
      if (message.startsWith("┌")) {
        // For section starts, we want to maintain the specific nesting
        // manage: "│  " -> "│ ┌ "
        if (label === "manage") {
          bar = `${pc.dim("│")} ${pc.dim("┌")} `;
        } else {
          // others: "│ │ " -> "│ ┌ " (to align with manage?)
          // Or generally just replace the last space with corner?
          // Let's stick to the requested visual for manage
          bar = bar.replace("│", "┌");
        }
        message = message.slice(1).trim();
      }
      const prefix = `${bar}${pc.blue(`[${label}]`)} ${colorizer(levelUpper)}: `;
      return message
        .split("\n")
        .map((line: string, i: number) => (i === 0 ? `${prefix}${line}` : `${bar}${line}`))
        .join("\n");
    }

    // Default style: no timestamp
    return `[${pc.blue(label)}] ${colorizer(levelUpper)}: ${payload.message}`;
  }

  const customFormat = printf(customFormatter);

  const logger = winston.createLogger({
    level: process.env.LOG_LEVEL || "info",
    format: combine(customFormat),
    transports: [
      new winston.transports.Console({
        log(info, callback) {
          const msg = info[Symbol.for("message") as any] || info.message;
          progressManager.log(msg);
          if (callback) callback();
        },
      }),
    ],
  });

  return logger;
}
