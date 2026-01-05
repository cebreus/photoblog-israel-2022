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

export function createLogger(label: string) {
  // Pokud je požadován JSON formát, použijte standardní výstup
  if (process.env.LOG_FORMAT === "json") {
    const logger = pino({ level: process.env.LOG_LEVEL || "info" });
    // Přidat label jako kontext
    const child = logger.child({ label });

    return {
      error: (msg: string, ...args: any[]) => child.error(msg, ...args), // hook-ignore: wrapper
      warn: (msg: string, ...args: any[]) => child.warn(msg, ...args), // hook-ignore: wrapper
      info: (msg: string, ...args: any[]) => child.info(msg, ...args), // hook-ignore: wrapper
      verbose: (msg: string, ...args: any[]) => child.debug(msg, ...args), // hook-ignore: wrapper
      debug: (msg: string, ...args: any[]) => child.trace(msg, ...args), // hook-ignore: wrapper
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

  // Map winston-like methods to pino if they differ or to provide a better API
  return {
    error: (msg: string, ...args: any[]) => logger.error(msg, ...args), // hook-ignore: wrapper
    warn: (msg: string, ...args: any[]) => logger.warn(msg, ...args), // hook-ignore: wrapper
    info: (msg: string, ...args: any[]) => logger.info(msg, ...args), // hook-ignore: wrapper
    verbose: (msg: string, ...args: any[]) => (logger as any).verbose(msg, ...args), // hook-ignore: wrapper
    debug: (msg: string, ...args: any[]) => logger.debug(msg, ...args), // hook-ignore: wrapper
    raw: (msg: string) => logProgress(msg),
    silent: false, // Compatibility for some scripts
    set level(val: string) {
      logger.level = val === "verbose" ? "verbose" : val;
    },
    get level() {
      return logger.level;
    },
  };
}
