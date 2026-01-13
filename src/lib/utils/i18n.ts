import * as m from "$lib/paraglide/messages";
import { getLocale as languageTag } from "$lib/paraglide/runtime";

type PluralKey = "osoba" | "tvar" | "fotka" | "autor" | "zastavka";

/**
 * Returns the correctly pluralized form for a given key and count.
 * Uses Paraglide's ICU-based messages with a safe fallback for SSR.
 */
export function getPlural(count: number, key: PluralKey): string {
  const currentLang = typeof languageTag === "function" ? languageTag() : "cs";

  // Safe mapping to Paraglide plural messages
  const messages = m as Record<string, unknown>;
  const pluralFn = messages[`plural_${key}`];

  if (typeof pluralFn === "function") {
    try {
      return pluralFn({ count });
    } catch (_e) {
      // Fallback if ICU pluralization fails during SSR/Prerendering
      return fallbackPlural(count, key, currentLang);
    }
  }

  return fallbackPlural(count, key, currentLang);
}

// WARNING: This fallback logic duplicates the ICU pluralization rules defined in messages/*.json.
// If you update pluralization rules there, you MUST update them here as well to ensure consistent SSR behavior.
function fallbackPlural(count: number, key: PluralKey, lang: string): string {
  const fallbacks: Record<string, Record<PluralKey, string>> = {
    cs: {
      osoba: count === 1 ? "osoba" : count > 1 && count < 5 ? "osoby" : "osob",
      tvar: count === 1 ? "tvář" : count > 1 && count < 5 ? "tváře" : "tváří",
      fotka: count === 1 ? "fotka" : count > 1 && count < 5 ? "fotky" : "fotek",
      autor: count === 1 ? "autor" : count > 1 && count < 5 ? "autoři" : "autorů",
      zastavka: count === 1 ? "zastávka" : count > 1 && count < 5 ? "zastávky" : "zastávek",
    },
    en: {
      osoba: count === 1 ? "person" : "people",
      tvar: count === 1 ? "face" : "faces",
      fotka: count === 1 ? "photo" : "photos",
      autor: count === 1 ? "author" : "authors",
      zastavka: count === 1 ? "stop" : "stops",
    },
  };

  return fallbacks[lang]?.[key] || key;
}
