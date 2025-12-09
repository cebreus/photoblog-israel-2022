import winston from "winston";
import pc from "picocolors";

const { combine, timestamp, printf, colorize } = winston.format;

const levelColors: Record<string, (str: string) => string> = {
  error: pc.red,
  warn: pc.yellow,
  info: pc.cyan,
  verbose: pc.dim,
  debug: pc.magenta,
};

/**
 * Creates a new logger instance with a specified label.
 * @param label - The label to display in log messages (e.g., 'images', 'favicons').
 * @returns A Winston logger instance.
 */
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
    transports: [new winston.transports.Console()],
  });

  return logger;
}
