/**
 * @fileoverview Centralized UI Messages
 *
 * Consolidates all toast messages and user-facing strings for i18n readiness.
 * Czech language strings for the photoblog application.
 */

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
  bulkHidden: (count: number) => `Bylo skryto ${count} osob.`,
  bulkRestored: (count: number) => `Obnoveno ${count} osob.`,
  bulkIgnored: "Vybrané profily jsou nyní ignorovány.",
  bulkRestoredFromJunk: (count: number) => `Obnoveno ${count} profilů z junk.`,
  bulkCategoryChanged: (count: number) => `Kategorie změněna pro ${count} osob.`,

  // Merge operations
  MERGE_SUCCESS: "Osoby byly úspěšně sloučeny.",
  bulkMerged: (count: number) => `Sloučeno ${count} profilů.`,

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

  // Delete/Archive operations
  actionSuccess: (action: string, count: number) =>
    `Úspěšně ${action} ${count} souborů. Stránka se obnoví.`,
  DELETE_FAILED: "Smazání selhalo.",
  ARCHIVE_FAILED: "Archivace selhala.",

  // Paste to self prevention
  PASTE_TO_SELF: "Nemůžete vkládat metadata do stejného obrázku, ze kterého jste je kopírovali",
  NO_IMAGES_TO_EDIT: "Žádné obrázky k úpravě.",
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
