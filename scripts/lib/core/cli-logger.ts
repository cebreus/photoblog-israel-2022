import { fileExists, writeFile } from "$scripts/utils/runtime";
import fs from "node:fs";
import path from "node:path";
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
  "25": "verbose",
  "20": "debug",
  "10": "trace",
};

// Lazy initialization of file stream
let fileStream: fs.WriteStream | null = null;
let fileStreamInitPromise: Promise<void> | null = null;

async function ensureFileStream(): Promise<fs.WriteStream> {
  if (fileStream) return fileStream;

  if (!fileStreamInitPromise) {
    fileStreamInitPromise = (async () => {
      const logsDir = path.resolve(process.cwd(), "logs");
      const cliLogPath = path.join(logsDir, "cli.log");

      // Ensure logs directory exists using runtime utilities
      const keepFile = path.join(logsDir, ".keep");
      if (!(await fileExists(keepFile))) {
        await writeFile(keepFile, "");
      }

      fileStream = fs.createWriteStream(cliLogPath, { flags: "a" });
    })();
  }

  await fileStreamInitPromise;
  if (!fileStream) {
    throw new Error("CLI Logger: Failed to initialize file stream");
  }
  return fileStream;
}

export interface Logger {
  error(obj: object, msg?: string, ...args: any[]): void;
  error(msg: string, ...args: any[]): void;
  warn(obj: object, msg?: string, ...args: any[]): void;
  warn(msg: string, ...args: any[]): void;
  info(obj: object, msg?: string, ...args: any[]): void;
  info(msg: string, ...args: any[]): void;
  verbose(obj: object, msg?: string, ...args: any[]): void;
  verbose(msg: string, ...args: any[]): void;
  debug(obj: object, msg?: string, ...args: any[]): void;
  debug(msg: string, ...args: any[]): void;
  raw(msg: string): void;
  silent: boolean;
  level: string;
}

export function createLogger(label: string): Logger {
  const traceId = process.env.TRACE_ID || process.env.X_REQUEST_ID;
  const baseContext: Record<string, string> = { label };
  if (traceId) {
    baseContext.traceId = traceId;
  }

  // Pokud je požadován JSON formát, použijte standardní výstup
  if (process.env.LOG_FORMAT === "json") {
    const logger = pino({ level: process.env.LOG_LEVEL || "info" });
    const child = logger.child(baseContext);

    return {
      error: (objOrMsg: any, msgOrArgs?: any, ...args: any[]) =>
        child.error(objOrMsg, msgOrArgs, ...args),
      warn: (objOrMsg: any, msgOrArgs?: any, ...args: any[]) =>
        child.warn(objOrMsg, msgOrArgs, ...args),
      info: (objOrMsg: any, msgOrArgs?: any, ...args: any[]) =>
        child.info(objOrMsg, msgOrArgs, ...args),
      verbose: (objOrMsg: any, msgOrArgs?: any, ...args: any[]) =>
        (child as any).verbose(objOrMsg, msgOrArgs, ...args),
      debug: (objOrMsg: any, msgOrArgs?: any, ...args: any[]) =>
        child.debug(objOrMsg, msgOrArgs, ...args),
      raw: (msg: string) => console.log(msg),
      silent: false,
      set level(val: string) {
        child.level = val === "verbose" ? "debug" : val;
      },
      get level() {
        return child.level;
      },
    } as unknown as Logger;
  }

  // Hezký formátovaný výstup pro terminál
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

  // Console stream - respects LOG_LEVEL for readability
  const consoleStream = {
    write(msg: string) {
      const obj = JSON.parse(msg);
      const level = pinoToWinstonLevel[obj.level] || "info";
      const traceId = obj.traceId ? pc.dim(`(${obj.traceId.slice(0, 8)}) `) : "";
      const formatted = formatMessage(level, `${traceId}${obj.msg}`);
      logProgress(formatted);
    },
  };

  // Create multistream: console with LOG_LEVEL, file with trace (everything)
  // File stream is lazy-initialized on first write
  const lazyFileStream = {
    write(msg: string) {
      ensureFileStream().then((stream) => stream.write(msg));
    },
  };

  let consoleLevel: pino.Level = (process.env.LOG_LEVEL || "info") as pino.Level;
  if (process.env.LOG_LEVEL === "verbose") {
    consoleLevel = "debug";
  }
  const streams = [
    { level: consoleLevel, stream: consoleStream },
    { level: "trace" as pino.Level, stream: lazyFileStream },
  ];

  const logger = pino(
    {
      level: "trace", // Set to lowest level so multistream filters work
      customLevels: {
        verbose: 25,
      },
      // IMPORTANT: No hooks needed here, we manually handle args in the wrapper below
    },
    pino.multistream(streams),
  ).child(baseContext);

  return {
    error: (objOrMsg: any, msgOrArgs?: any, ...args: any[]) =>
      logger.error(objOrMsg, msgOrArgs, ...args),
    warn: (objOrMsg: any, msgOrArgs?: any, ...args: any[]) =>
      logger.warn(objOrMsg, msgOrArgs, ...args),
    info: (objOrMsg: any, msgOrArgs?: any, ...args: any[]) =>
      logger.info(objOrMsg, msgOrArgs, ...args),
    verbose: (objOrMsg: any, msgOrArgs?: any, ...args: any[]) =>
      (logger as any).verbose(objOrMsg, msgOrArgs, ...args),
    debug: (objOrMsg: any, msgOrArgs?: any, ...args: any[]) =>
      logger.debug(objOrMsg, msgOrArgs, ...args),
    raw: (msg: string) => logProgress(msg),
    silent: false,
    set level(val: string) {
      logger.level = val === "verbose" ? "verbose" : val;
    },
    get level() {
      return logger.level;
    },
  } as unknown as Logger;
}
