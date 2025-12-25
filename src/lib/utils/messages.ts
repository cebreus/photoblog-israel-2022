/**
 * @fileoverview Centralized UI Messages
 *
 * Consolidates all toast messages and user-facing strings for i18n readiness.
 * Czech language strings for the photoblog application.
 */

// ============================================================================
// Czech Pluralization Helper
// ============================================================================

/**
 * Returns the correct Czech plural form based on count.
 * Czech has 3 forms: singular (1), few (2-4), many (5+, 0)
 *
 * @param count - The number to pluralize for
 * @param singular - Form for 1 (e.g., "osoba", "soubor", "profil")
 * @param few - Form for 2-4 (e.g., "osoby", "soubory", "profily")
 * @param many - Form for 0, 5+ (e.g., "osob", "souborů", "profilů")
 */
export function czechPlural(count: number, singular: string, few: string, many: string): string {
  const abs = Math.abs(count);
  if (abs === 1) return singular;
  if (abs >= 2 && abs <= 4) return few;
  return many;
}

/**
 * Common Czech plural patterns
 */
export const PLURALS = {
  osoba: (n: number) => czechPlural(n, "osoba", "osoby", "osob"),
  profil: (n: number) => czechPlural(n, "profil", "profily", "profilů"),
  soubor: (n: number) => czechPlural(n, "soubor", "soubory", "souborů"),
  obrazek: (n: number) => czechPlural(n, "obrázek", "obrázky", "obrázků"),
  fotka: (n: number) => czechPlural(n, "fotka", "fotky", "fotek"),
  detekce: (n: number) => czechPlural(n, "detekce", "detekce", "detekcí"),
} as const;

// ============================================================================
// Person Management Messages
// ============================================================================

export const PERSON_MESSAGES = {
  // Toggle visibility
  PERSON_HIDDEN: "Osoba byla skryta.",
  PERSON_RESTORED: "Osoba byla obnovena.",
  PERSON_RENAMED: "Osoba byla úspěšně přejmenována.",
  PERSON_IGNORED: "Osoba je nyní ignorována.",

  // Bulk operations
  bulkHidden: (count: number) =>
    count === 1
      ? `Byla skryta ${count} ${PLURALS.osoba(count)}.`
      : `Bylo skryto ${count} ${PLURALS.osoba(count)}.`,
  bulkRestored: (count: number) =>
    count === 1
      ? `Obnovena ${count} ${PLURALS.osoba(count)}.`
      : `Obnoveno ${count} ${PLURALS.osoba(count)}.`,
  bulkIgnored: "Vybrané profily jsou nyní ignorovány.",
  bulkRestoredFromJunk: (count: number) =>
    count === 1
      ? `Obnoven ${count} ${PLURALS.profil(count)} z junk.`
      : `Obnoveno ${count} ${PLURALS.profil(count)} z junk.`,
  bulkCategoryChanged: (count: number) => `Kategorie změněna pro ${count} ${PLURALS.osoba(count)}.`,

  // Merge operations
  MERGE_SUCCESS: "Osoby byly úspěšně sloučeny.",
  bulkMerged: (count: number) =>
    count === 1
      ? `Sloučen ${count} ${PLURALS.profil(count)}.`
      : `Sloučeno ${count} ${PLURALS.profil(count)}.`,

  // Error messages
  RENAME_FAILED: "Přejmenování se nezdařilo.",
  COMMUNICATION_ERROR: "Chyba při komunikaci se serverem.",
  BULK_HIDE_FAILED: "Hromadné skrytí selhalo.",
  BULK_RESTORE_FAILED: "Hromadné obnovení selhalo.",
  BULK_IGNORE_FAILED: "Hromadné ignorování selhalo.",
  BULK_CATEGORY_FAILED: "Hromadná změna kategorie selhala.",
  MERGE_FAILED: "Sloučení selhalo.",
} as const;

// ============================================================================
// Image/Photo Messages
// ============================================================================

export const IMAGE_MESSAGES = {
  // Metadata operations
  metadataCopied: (filename: string) => `Metadata zkopírována z "${filename}"`,
  METADATA_PASTED: "Metadata úspěšně vložena",
  METADATA_PASTE_FAILED: "Chyba při ukládání metadata",
  NO_CLIPBOARD_DATA: "Žádná metadata v clipboard",

  // Save operations
  imageSaved: (count: number) =>
    count === 1
      ? `Uložen ${count} ${PLURALS.obrazek(count)}.`
      : `Uloženo ${count} ${PLURALS.obrazek(count)}.`,

  // Delete/Archive operations
  actionSuccess: (action: string, count: number) =>
    `Úspěšně ${action} ${count} ${PLURALS.soubor(count)}. Stránka se obnoví.`,
  DELETE_FAILED: "Smazání selhalo.",
  ARCHIVE_FAILED: "Archivace selhala.",

  // Paste to self prevention
  PASTE_TO_SELF: "Nemůžete vkládat metadata do stejného obrázku, ze kterého jste je kopírovali",
  NO_IMAGES_TO_EDIT: "Žádné obrázky k úpravě.",

  // Geo operations
  NO_GPS_COORDINATES: "Obrázek nemá GPS souřadnice.",
  GEO_DATA_LOADED: "Data byla načtena z mapy (změny lze vrátit).",
  GEO_DATA_SAME: "Data z mapy se shodují s aktuálními.",
  GEO_FETCH_FAILED: "Chyba při stahování dat.",
} as const;

// ============================================================================
// Detection Messages
// ============================================================================

export const DETECTION_MESSAGES = {
  DETECTION_INVALIDATED: "Detekce byla označena jako neplatná a bude v budoucnu ignorována.",
  BULK_DETECTION_INVALIDATED: "Vybrané detekce byly označeny jako neplatné a budou ignorovány.",
  DETECTION_ERROR: "Nepodařilo se najít souřadnice detekce.",
  BULK_DETECTION_FAILED: "Chyba při hromadném označování detekcí.",

  // Reassignment
  assignedToPerson: (name: string) => `Fotky byly přiřazeny osobě ${name}.`,
  unmatchSuccess: (count: number, hidden: boolean) =>
    hidden ? `Fotky (${count}) byly úspěšně skryty.` : `Fotky (${count}) byly úspěšně vyjmuty.`,

  // Category change
  categoryChanged: (category: string) => {
    const labels: Record<string, string> = {
      person: "Osoba",
      statue: "Socha",
      painting: "Malba",
    };
    return `Kategorie změněna na ${labels[category] || category}.`;
  },
} as const;

// ============================================================================
// Generic Messages
// ============================================================================

export const GENERIC_MESSAGES = {
  COMMUNICATION_ERROR: "Chyba komunikace",
  COMMUNICATION_ERROR_DESCRIPTION: "Nelze kontaktovat server.",
  PROCESSING_ERROR: "Chyba při zpracování požadavku",
  OPERATION_FAILED: "Operace se nezdařila. Zkuste to prosím znovu.",
  DATA_LOADED_FROM_MAP: "Data byla načtena z mapy (změny lze vrátit).",

  // Partial success
  partialSuccess: (success: number, failed: number) =>
    `Dokončeno s chybami: ${success} úspěšných, ${failed} selhalo.`,
} as const;
