/**
 * @fileoverview Bridge between CLI IO helpers and application logger context.
 *
 * @description
 * Provides a generic interface and helpers to route IO debug/info logs into the active logger.
 */
import { getCurrentLogger } from "../../../src/lib/server/request-context";

/**
 * Interface that matches both Pino (App) and CLI Logger structure for the subset we need.
 */
export interface GenericLogger {
  debug(obj: object, msg?: string, ...args: any[]): void;
  debug(msg: string, ...args: any[]): void;
  info(obj: object, msg?: string, ...args: any[]): void;
  info(msg: string, ...args: any[]): void;
  warn(obj: object, msg?: string, ...args: any[]): void;
  warn(msg: string, ...args: any[]): void;
  error(obj: object, msg?: string, ...args: any[]): void;
  error(msg: string, ...args: any[]): void;
}

let ioLogger: GenericLogger | null = null;

export function setIoLogger(logger: GenericLogger) {
  ioLogger = logger;
}

export function getIoLogger(): GenericLogger | null {
  // Prefer context-aware logger if inside a request
  const contextLogger = getCurrentLogger();
  if (contextLogger) {
    return contextLogger as unknown as GenericLogger;
  }
  return ioLogger;
}

/**
 * Helper to log debug info safely even if logger isn't set
 */
export function logIoDebug(obj: object, msg?: string) {
  const logger = getIoLogger();
  if (logger) {
    logger.debug({ ...obj }, msg);
  }
}

/**
 * Helper to log info safely even if logger isn't set
 */
export function logIoInfo(obj: object, msg?: string) {
  const logger = getIoLogger();
  if (logger) {
    logger.info({ ...obj }, msg);
  }
}
