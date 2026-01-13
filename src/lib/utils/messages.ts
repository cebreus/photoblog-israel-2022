import { dev } from "$app/environment";
import { createLogger } from "$lib/logger";
import * as m from "$lib/paraglide/messages";

const logger = createLogger("i18n-proxy");

function makeProxy(prefix?: string) {
  return new Proxy(
    {},
    {
      get(_target, prop: string) {
        const key = String(prop);
        const lower = key.toLowerCase();

        const messages = m as unknown as Record<string, unknown>;
        const keys = Object.keys(messages);

        // 1. prefixed match e.g. COLLAGE_MESSAGES.TITLE -> collage_title
        if (prefix) {
          const cand = `${prefix}_${lower}`;
          if (keys.includes(cand)) {
            const fn = messages[cand];
            return typeof fn === "function"
              ? (...args: unknown[]) => (fn as (...args: unknown[]) => unknown)(...args)
              : fn;
          }
        }

        // 2. direct match like `plural_osoba_one`
        if (keys.includes(lower)) {
          const fn = messages[lower];
          return typeof fn === "function"
            ? (...args: unknown[]) => (fn as (...args: unknown[]) => unknown)(...args)
            : fn;
        }

        // fallback: return a function that returns the key (so code can still call it)
        return (..._args: unknown[]) => {
          if (dev) {
            logger.warn({ key, prefix: prefix || "none" }, `Missing message key: ${key}`);
          }
          return key;
        };
      },
    },
  ) as Record<string, (...args: unknown[]) => string>;
}

export const COLLAGE_MESSAGES = makeProxy("collage");
export const IMAGE_MESSAGES = makeProxy("image");
export const EMPTY_MESSAGES = makeProxy("empty");

export default {
  COLLAGE_MESSAGES,
  IMAGE_MESSAGES,
  EMPTY_MESSAGES,
};
