// Re-export the Paraglide 2.x runtime
export * as m from "$lib/paraglide/messages";
export * from "$lib/paraglide/runtime";

// Backwards compatibility wrappers
import {
  getLocale,
  locales,
  localizeHref,
  setLocale as runtimeSetLocale,
  type Locale,
} from "$lib/paraglide/runtime";

// Export languageTag as a function that returns current locale
export const languageTag = getLocale;

// Export availableLanguageTags as the locales constant
export const availableLanguageTags = locales;

// Export i18n object with route helpers for compatibility
export const i18n = {
  route: (path: string) => localizeHref(path),
  resolveRoute: (path: string, locale: string) => localizeHref(path, { locale: locale as Locale }),
  get locale() {
    return getLocale();
  },
  set locale(value: Locale) {
    runtimeSetLocale(value);
  },
};

/**
 * Detects the language tag from the URL pathname.
 * If the path starts with a supported locale, returns it.
 * Otherwise returns the default/current locale.
 */
export function detectLanguageFromPath(pathname: string): Locale {
  for (const tag of locales) {
    if (pathname === `/${tag}` || pathname.startsWith(`/${tag}/`)) {
      return tag as Locale;
    }
  }
  // If no prefix is found, it implies the default language (cs)
  // Do NOT return getLocale() here as it reflects inconsistent runtime state
  return "cs";
}
