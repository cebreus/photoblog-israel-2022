// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces

import type { Logger } from "$lib/logger";

declare global {
  namespace App {
    // interface Error {}
    interface Locals {
      log: Logger; // Logger s kontextem požadavku
      logContext: Record<string, unknown>; // Objekt pro sběr byznys kontextu
      skipRequestLog?: boolean; // Potlačení automatického logování požadavku
      paraglide: {
        lang: string;
        textDirection: "ltr" | "rtl";
      };
      requestId?: string;
    }
    // interface PageData {}
    // interface PageState {}
    // interface Platform {}
  }
}
