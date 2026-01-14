// Re-export the Paraglide 2.x runtime
export * as m from "$lib/paraglide/messages";
export * from "$lib/paraglide/runtime";

// Backwards compatibility wrappers for components still using old API
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
  // In Paraglide 2.x, resolveRoute is essentially localizeHref with a specific locale
  resolveRoute: (path: string, locale: string) => localizeHref(path, { locale: locale as Locale }),
  get locale() {
    return getLocale();
  },
  set locale(value: Locale) {
    runtimeSetLocale(value);
  },
};
