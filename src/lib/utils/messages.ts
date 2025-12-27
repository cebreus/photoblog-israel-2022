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
  METADATA_PASTE_FAILED: "Chyba při ukládání metadat",
  NO_CLIPBOARD_DATA: "Žádná metadata ve schránce",

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
  SAVING_METADATA: "Ukládám metadata...",
  SAVE_CHANGES: "Uložit změny",
  MAP_FETCH_FAILED: "Nepodařilo se načíst data z mapy.",
  ERROR_TITLE: (msg: string) => `Chyba: ${msg}`,
  UNKNOWN_ERROR: "Neznámá chyba",
  METADATA_UPDATE_FAILED: "Nepodařilo se aktualizovat metadata",
  KEYWORDS_PLACEHOLDER: "čárkou oddělené",
  LABEL_CAPTION: "Popisek",
  LABEL_TITLE: "Titulek",
  LABEL_AUTHOR: "Autor",
  LABEL_KEYWORDS: "Klíčová slova",
  GEO_LABEL: "Geografické údaje",
  LABEL_LOCATION: "Místo",
  LABEL_CITY: "Město",
  LABEL_STATE: "Stát / Provincie",
  LABEL_COUNTRY: "Země",
  LABEL_COUNTRY_CODE: "Kód",
  ORIGINAL_VALUE: "Původní:",
  FETCHING: "Načítám...",
  FETCH_FROM_MAP: "Načíst z mapy",
  RESTORE_VALUE_ARIA: "Kliknutím vrátíte původní hodnotu",
  OPEN_IN_MAPS_ARIA: "Otevřít v Google Maps",
  FETCH_FROM_GPS_ARIA: "Načíst adresu z GPS souřadnic",
} as const;

// ============================================================================
// Detection Messages
// ============================================================================

export const DETECTION_MESSAGES = {
  DETECTION_INVALIDATED: "Detekce byla označena jako neplatná a bude v budoucnu ignorována.",
  BULK_DETECTION_INVALIDATED: "Vybrané detekce byly označeny jako neplatné a budou ignorovány.",
  DETECTION_ERROR: "Nepodařilo se najít souřadnice detekce.",
  BULK_DETECTION_FAILED: "Chyba při hromadném označování detekcí.",
  SAVE_SETTINGS_FAILED: "Nepodařilo se uložit nastavení.",

  // Reassignment
  assignedToPerson: (name: string) => `Fotky byly přiřazeny osobě ${name}.`,
  ASSIGNMENT_ERROR: "Chyba přiřazení",
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
  CATEGORY_CHANGE_FAILED: "Chyba při změně kategorie.",
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

// ============================================================================
// Collage Messages
// ============================================================================

export const COLLAGE_MESSAGES = {
  // Dialog
  TITLE: "Nová koláž",
  TEMPLATE_ROW: "Vedle sebe",
  TEMPLATE_COLUMN: "Pod sebou",
  TEMPLATE_GRID: "Mřížka 2x2",
  TEMPLATE_HERO_TOP: "Hero Top (3)",
  TEMPLATE_HERO_LEFT: "Hero Left (3)",
  TEMPLATE_HERO_RIGHT: "Hero Right (3)",
  TEMPLATE_SIDEBAR_HERO: "Sidebar Hero (4)",
  TEMPLATE_GRID_3X2: "Mřížka 3x2 (6)",
  TEMPLATE_MOSAIC_6: "Mozaika (6)",
  TEMPLATE_DENSITY_7: "Density (7)",
  RATIO_LABEL: "Poměr",
  RATIO_AUTO: "Auto",
  RATIO_GROUP_LABEL: "Poměry stran",

  // Settings
  BORDER_LABEL: "Ohraničení (Border)",
  BORDER_WIDTH_LABEL: "Referenční šířka (px)",
  BORDER_WIDTH_HINT: (actual: number) => `Skutečná šířka: ${actual}px podle originálních rozměrů`,
  BORDER_COLOR_LABEL: "Barva",

  // Preview
  PREVIEW_INFO: (width: number, height: number, ratio: string) =>
    `Koláž: ${width}x${height}px • Poměr: ${ratio}`,

  // Image List
  SELECTED_IMAGES: (count: number) => `Vybrané obrázky (${count})`,
  ORIGIN_LABEL: "Origin",
  DETAIL_LABEL: "Detail",
  MOVE_UP: "Posunout nahoru",
  MOVE_DOWN: "Posunout dolů",
  MIN_IMAGES_HINT: (min: number) => `Vyžaduje ${min} obrázky`,

  // Action Buttons
  CREATE_BUTTON: "Vytvořit koláž",
  SAVE_BUTTON: "Uložit změny",

  SAVING: "Ukládám...",

  CREATING: "Zpracovávám...",
  CREATE_HINT: "Výsledek bude uložen ve formátu JPEG (Q100). Metadata zachována.",
  CLOSE_CONFIRM: "Opravdu chcete zavřít editor? Změny nebudou uloženy.",

  // Toasts / Errors
  CREATED_SUCCESS: (path: string) => `Koláž vytvořena: ${path}`,
  RESTORED_DRAFT: "Obnoveno z konceptu",
  MIN_IMAGES: "Minimálně 2 obrázky jsou potřeba pro koláž.",
  GRID_MIN_IMAGES: "Šablona 2x2 vyžaduje alespoň 4 obrázky.",
  OPERATION_FAILED: "Operace selhala",
  DUPLICATES_WARNING: "Upozornění: Koláž obsahuje duplicitní obrázky.",

  // Backend errors & labels
  DEV_ONLY: "Koláže jsou dostupné pouze v dev módu",
  IMAGE_NOT_FOUND: (id: string) => `Obrázek nebyl nalezen: ${id}`,
  INVALID_DIMENSIONS: (path: string) => `Neplatné rozměry obrázku: ${path}`,
  USER_COMMENT: (names: string) => `Koláž z: ${names}`,
  SOFTWARE_LABEL: "Photoblog Collage Tool",
  NOT_AVAILABLE: "nedostupné",

  // Validation
  MAX_IMAGES_EXCEEDED: (max: number) => `Maximálně ${max} obrázků v koláži.`,
  INVALID_TEMPLATE: (template: string) => `Neplatná šablona: ${template}`,
  TEMPLATE_MIN_IMAGES: (template: string, min: number) =>
    `Šablona ${template} vyžaduje minimálně ${min} obrázků.`,
  MISSING_IMAGE_ID: "Každá položka musí mít platné imageId.",
  INVALID_CROP_SCALE: "Crop scale musí být v rozsahu 1-5.",
  INVALID_BORDER_WIDTH: "Border width nemůže být záporný.",
  INVALID_BORDER_COLOR: "Border color musí být validní hex kód (#RRGGBB).",
  TIMEOUT: "Zpracování koláže trvalo příliš dlouho.",

  // Loading & Selection
  LOAD_CONFIG_FAILED: "Nelze načíst konfiguraci koláže",
  SOURCE_IMAGES_NOT_FOUND: "Některé source obrázky nebyly nalezeny",
  LOAD_FAILED: (err: string) => `Chyba při načítání koláže: ${err}`,
  CANCELLED: "Vytváření koláže bylo zrušeno.",
  EMPTY_SLOT: "Prázdné",
  TOOLTIP_FLEXIBLE: "Flexibilní počet",
  TOOLTIP_REQUIRED: (count: number) => `Vyžaduje ${count} obrázky`,
  TOOLTIP_EXACT: (req: number, have: number) => `Vyžaduje přesně ${req} obrázků (máte ${have})`,
  LOG_SORTING_EXIF: (ms: number) => `[Collage] Seřazení podle EXIF: ${ms}ms`,
  LOG_METADATA_LOAD: (ms: number) => `[Collage] Načtení metadat: ${ms}ms`,
  LOG_RENDER_COMPLETE: (ms: number) => `[Collage] Renderování dokončeno: ${ms}ms`,
  LOG_ROLLBACK_START: "[Collage] Zahajuji rollback operací...",
  LOG_ROLLBACK_COMPLETE: "[Collage] Rollback dokončen.",
  LOG_QUALITY_SCALE: (percent: string) => `Škálování pro zachování kvality: ${percent}%`,
  LOG_LIMIT_8K: (percent: string) => `[Collage] Zmenšování na 8K limit (${percent}%)`,
  LOG_SUCCESS: (filename: string, ms: number) => `[Collage] Úspěch: ${filename} (Celkem: ${ms}ms)`,
  LOG_ERROR: (err: string) => `Chyba koláže: ${err}`,
  EDIT_BUTTON: "Upravit koláž",
  CREATE_TRIGGER_BUTTON: (count: number) => `Vytvořit koláž (${count})`,
  DIRECT_VIEW_HINT: "Otevřít v novém okně",
  DIRECT_VIEW_ACTION: "Otevřít",
} as const;
