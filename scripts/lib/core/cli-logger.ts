import pc from "picocolors";
import pino from "pino";
import { logProgress } from "./progress-manager";

const levelColors: Record<string, (str: string) => string> = {
  error: pc.red,
  warn: pc.yellow,
  info: pc.cyan,
  debug: pc.dim, // mapped from verbose
  trace: pc.magenta, // mapped from debug
};

const pinoToWinstonLevel: Record<string, string> = {
  "50": "error",
  "40": "warn",
  "30": "info",
  "20": "verbose",
  "10": "debug",
};

export interface Logger {
  error: (objOrMsg: any, msgOrArgs?: any, ...args: any[]) => void;
  warn: (objOrMsg: any, msgOrArgs?: any, ...args: any[]) => void;
  info: (objOrMsg: any, msgOrArgs?: any, ...args: any[]) => void;
  verbose: (objOrMsg: any, msgOrArgs?: any, ...args: any[]) => void;
  debug: (objOrMsg: any, msgOrArgs?: any, ...args: any[]) => void;
  raw: (msg: string) => void;
  silent: boolean;
  level: string;
}

export function createLogger(label: string): Logger {
  // Pokud je požadován JSON formát, použijte standardní výstup
  if (process.env.LOG_FORMAT === "json") {
    const logger = pino({ level: process.env.LOG_LEVEL || "info" });
    // Přidat label jako kontext
    const child = logger.child({ label });

    return {
      error: (objOrMsg: any, msgOrArgs?: any, ...args: any[]) =>
        typeof objOrMsg === "string"
          ? child.error(objOrMsg, msgOrArgs, ...args)
          : child.error(objOrMsg, msgOrArgs, ...args),
      warn: (objOrMsg: any, msgOrArgs?: any, ...args: any[]) =>
        typeof objOrMsg === "string"
          ? child.warn(objOrMsg, msgOrArgs, ...args)
          : child.warn(objOrMsg, msgOrArgs, ...args),
      info: (objOrMsg: any, msgOrArgs?: any, ...args: any[]) =>
        typeof objOrMsg === "string"
          ? child.info(objOrMsg, msgOrArgs, ...args)
          : child.info(objOrMsg, msgOrArgs, ...args),
      verbose: (objOrMsg: any, msgOrArgs?: any, ...args: any[]) =>
        typeof objOrMsg === "string"
          ? child.debug(objOrMsg, msgOrArgs, ...args)
          : child.debug(objOrMsg, msgOrArgs, ...args),
      debug: (objOrMsg: any, msgOrArgs?: any, ...args: any[]) =>
        typeof objOrMsg === "string"
          ? child.trace(objOrMsg, msgOrArgs, ...args)
          : child.trace(objOrMsg, msgOrArgs, ...args),
      raw: (msg: string) => console.log(msg),
      silent: false,
      set level(val: string) {
        child.level = val === "verbose" ? "debug" : val;
      },
      get level() {
        return child.level;
      },
    };
  }

  // Původní logika pro hezký formátovaný výstup
  function identity(str: string) {
    return str;
  }

  function formatMessage(level: string, message: string) {
    const levelUpper = level.toUpperCase();
    const colorizer = levelColors[level] || identity;

    if (process.env.LOG_STYLE === "boxed") {
      let bar = label === "manage" ? `${pc.dim("│")}  ` : `${pc.dim("│ │")} `;
      if (message.startsWith("┌")) {
        if (label === "manage") {
          bar = `${pc.dim("│")} ${pc.dim("┌")} `;
        } else {
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

    return `[${pc.blue(label)}] ${colorizer(levelUpper)}: ${message}`;
  }

  const stream = {
    write(msg: string) {
      const obj = JSON.parse(msg);
      const level = pinoToWinstonLevel[obj.level] || "info";
      const formatted = formatMessage(level, obj.msg);
      logProgress(formatted);
    },
  };

  const logger = pino(
    {
      level: process.env.LOG_LEVEL || "info",
      customLevels: {
        verbose: 25, // between info (30) and debug (20)
      },
      hooks: {
        logMethod(inputArgs, method) {
          if (inputArgs.length >= 2 && typeof inputArgs[0] === "string") {
            const [msg, ...args] = inputArgs;
            const formattedMsg =
              args.length > 0
                ? msg +
                  " " +
                  args.map((a) => (typeof a === "object" ? JSON.stringify(a) : a)).join(" ")
                : msg;
            return method.apply(this, [formattedMsg]);
          }
          return method.apply(this, inputArgs);
        },
      },
    },
    stream,
  );

  return {
    error: (objOrMsg: any, msgOrArgs?: any, ...args: any[]) =>
      typeof objOrMsg === "string"
        ? logger.error(objOrMsg, msgOrArgs, ...args)
        : logger.error(objOrMsg, msgOrArgs, ...args),
    warn: (objOrMsg: any, msgOrArgs?: any, ...args: any[]) =>
      typeof objOrMsg === "string"
        ? logger.warn(objOrMsg, msgOrArgs, ...args)
        : logger.warn(objOrMsg, msgOrArgs, ...args),
    info: (objOrMsg: any, msgOrArgs?: any, ...args: any[]) =>
      typeof objOrMsg === "string"
        ? logger.info(objOrMsg, msgOrArgs, ...args)
        : logger.info(objOrMsg, msgOrArgs, ...args),
    verbose: (objOrMsg: any, msgOrArgs?: any, ...args: any[]) =>
      typeof objOrMsg === "string"
        ? (logger as any).verbose(objOrMsg, msgOrArgs, ...args)
        : (logger as any).verbose(objOrMsg, msgOrArgs, ...args),
    debug: (objOrMsg: any, msgOrArgs?: any, ...args: any[]) =>
      typeof objOrMsg === "string"
        ? logger.debug(objOrMsg, msgOrArgs, ...args)
        : logger.debug(objOrMsg, msgOrArgs, ...args),
    raw: (msg: string) => logProgress(msg),
    silent: false,
    set level(val: string) {
      logger.level = val === "verbose" ? "verbose" : val;
    },
    get level() {
      return logger.level;
    },
  };
}
