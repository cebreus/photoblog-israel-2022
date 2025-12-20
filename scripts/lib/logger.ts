import pc from "picocolors";
import winston from "winston";
import { progressManager } from "./progress-manager";

const { combine, timestamp, printf } = winston.format;

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
    const ts = payload.timestamp ? String(payload.timestamp) : "";
    return `${pc.dim(ts)} [${pc.blue(label)}] ${colorizer(levelUpper)}: ${payload.message}`;
  }

  const customFormat = printf(customFormatter);

  const logger = winston.createLogger({
    level: process.env.LOG_LEVEL || "info",
    format: combine(timestamp({ format: "YYYY-MM-DD HH:mm:ss" }), customFormat),
    transports: [
      new winston.transports.Console({
        log(info, callback) {
          // Use the raw symbol for the formatted message if available, otherwise just message
          const msg = info[Symbol.for("message") as any] || info.message;
          progressManager.log(msg);
          if (callback) callback();
        },
      }),
    ],
  });

  return logger;
}
