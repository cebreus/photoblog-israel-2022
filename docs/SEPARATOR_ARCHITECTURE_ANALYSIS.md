# Kritická analýza architektury generování separátorů a menu

## Shrnutí

Současná architektura trpí **rozptýlenou odpovědností**, **implicitní logikou** a **nedostatečnou validací vstupních dat**. To vedlo k 4+ hodinám ladění problémů, které by měla architektura předcházet.

---

## 1. Architektura - Současný stav

### Tok dat

```
Markdown (.md)         Fotky (EXIF)
       ↓                    ↓
   loadStoryData()     processImages()
       ↓                    ↓
   StoryDataMap        ImageEntry[]
           ↘          ↙
        organizeDayItems()
               ↓
           PhotoDay.items[]
           (mixed Separator[] & ImageEntry[])
               ↓
        mapDayToMenu()
               ↓
        MenuManifest
```

### Klíčové funkce

| Funkce                          | Odpovědnost                                | Problém                                            |
| ------------------------------- | ------------------------------------------ | -------------------------------------------------- |
| `getMarkdownSeparatorsForDay()` | Vytváří separátory z markdown              | Žádná validace, tichá chyba při chybějících datech |
| `organizeDayItems()`            | Slučuje markdown + auto separátory + fotky | Příliš mnoho odpovědností v jedné funkci           |
| `compareItemsByTimestamp()`     | Řazení všech položek                       | Předpokládá konzistentní formát časů               |
| `hasPhotos` kalkulace           | Určuje viditelnost separátoru              | "Look-ahead" logika fragile vůči změnám řazení     |
| `mapDayToMenu()`                | Generuje menu položky                      | Duplikuje logiku `organizeDayItems`                |

---

## 2. Identifikované problémy

### 2.1 Rozptýlená odpovědnost (Scattered Responsibility)

**Problém:** Logika "co je separator" a "kdy se má zobrazit" je rozptýlena mezi:

- `builder.ts` - vytvoření separátorů
- `builder.ts` - kalkulace `hasPhotos`
- `PhotoGrid.svelte` - podmíněné zobrazení
- `sidebar-menu-sub-button.svelte` - zobrazení času

**Důsledek:** Změna v jednom místě vyžaduje změny v ostatních, což zvyšuje riziko regrese.

**Doporučení:** Vytvořit `SeparatorService` s jasně definovaným API:

```typescript
interface SeparatorService {
  createFromMarkdown(story: StoryData, dayDate: string): Separator[];
  createAuto(images: ImageEntry[]): Separator[];
  assignPhotosToSeparators(separators: Separator[], images: ImageEntry[]): SeparatorWithPhotos[];
  shouldDisplay(separator: Separator): boolean;
}
```

---

### 2.2 Implicitní chování → VYŘEŠENO ✅

**Stav:** Konstanta `minPhotosForAutoSeparator` a `minPhotosForDisplay` jsou nyní v `build.config.ts`:

```typescript
separator: {
  minPhotosForAutoSeparator: 3,  // Pro auto-generované separátory
  minPhotosForDisplay: 3,        // Pro zobrazení v photo gridu
}
```

---

### 2.3 Wall Clock Time - DESIGN DECISION (NEMĚNIT!)

**⚠️ KRITICKÉ: Tento přístup je ZÁMĚRNÝ a NESMÍ být změněn.**

#### Proč používáme string comparison místo Date objektů?

1. **Wall Clock principle:** Časy jsou interpretovány jako "co bylo na hodinách v daném místě", nikoli jako absolutní UTC čas. Když uživatel napíše `startDate: 2025-11-25T09:16:00`, znamená to "9:16 v Egyptě", ne "9:16 UTC".

2. **Google Maps Timeline:** Uživatel získává časy z Google Maps Timeline, který poskytuje **lokální časy** destinace. Tyto časy nechceme konvertovat.

3. **EXIF data:** exiftool-vendored vrací `rawValue` jako string (např. `2025:11:25 09:28:36`), který `metadata.ts` konvertuje na ISO formát BEZ změny hodin/minut. Tím zachováváme "wall clock" čas z fotoaparátu.

4. **Proč NE Date objekty?**
   - `new Date("2025-11-25T09:16:00")` interpretuje čas jako LOCAL timezone systému
   - Na buildu v CZ (UTC+1) by se 09:16 stalo 08:16 UTC
   - Porovnání s egyptským časem (UTC+2) by pak bylo nesprávné
   - String comparison `"09:16:00" < "09:28:36"` funguje správně pro ISO formát

#### Pravidla pro práci s časy:

```typescript
// ✅ SPRÁVNĚ - string comparison
if (time1.localeCompare(time2) < 0) { ... }

// ❌ ŠPATNĚ - Date comparison (způsobí timezone problémy)
if (new Date(time1) < new Date(time2)) { ... }

// ✅ SPRÁVNĚ - extrakce času z ISO stringu
const hour = isoString.split("T")[1].substring(0, 5); // "09:16"

// ❌ ŠPATNĚ - použití toLocaleTimeString (aplikuje local timezone)
const hour = new Date(isoString).toLocaleTimeString();
```

---

### 2.4 "hasPhotos" kalkulace - Look-ahead algoritmus

**Jak funguje:**

```
Seřazené položky:
[0] Separator "Hotel" (09:00)      ← Aktuální separator
[1] Fotka A (09:15) - Hotel        ← photoCount++
[2] Fotka B (09:30) - Hotel        ← photoCount++
[3] Fotka C (09:45) - Restaurace   ← Ignorováno (jiná lokace)
[4] Separator "Restaurace" (10:00) ← STOP (break)

Výsledek: photoCount = 2, threshold = 3 → hasPhotos = false
```

**Pravidla:**

1. Iteruj od separátoru dopředu
2. Počítej fotky SE STEJNOU LOKACÍ
3. Zastav se na dalším separátoru
4. `hasPhotos = photoCount >= config.separator.minPhotosForDisplay`

**Omezení:** Závisí na správném chronologickém řazení. Pokud je řazení špatné, výsledek bude špatný.

---

### 2.5 Menu generování - duplikovaná logika

**Problém:** `mapDayToMenu()` znovu iteruje přes `d.items` a vytváří vlastní logiku pro:

- Detekci separátorů (`locationsWithSeparators`)
- Deduplikaci (`seenIds`)
- Rozhodování o vložení položky

**Důsledek:** Dvě místa musí rozhodovat "co patří do menu", což vede k nekonzistencím.

**Doporučení:** Menu položky by měly být vytvořeny **přímo při vytváření separátorů**:

```typescript
// V organizeDayItems:
separator.menuEntry = {
  id: separator.id,
  label: separator.location,
  href: `#${separator.id}`,
  startDate: separator.startDate,
};
```

---

### 2.6 Chybějící validace vstupních dat → K IMPLEMENTACI

**Problém:** `loadStoryData()` a `getMarkdownSeparatorsForDay()` **neprovádějí žádnou validaci**:

- Markdown bez `startDate` i `endDate` → tiché přeskočení
- Nevalidní formát data → runtime crash nebo nesprávné chování
- Duplicitní visits → duplicitní separátory

**Doporučená implementace:**

```typescript
function validateStoryData(story: StoryData, filename: string): void {
  const warnings: string[] = [];

  // Check for dates
  if (!story.startDate && !story.endDate && !story.visits?.length) {
    warnings.push(`No dates defined (startDate, endDate, or visits required)`);
  }

  // Validate visit dates
  for (const visit of story.visits ?? []) {
    if (!visit.startDate && !visit.endDate) {
      warnings.push(`Visit has no dates`);
    }
    if (visit.startDate && visit.endDate && visit.startDate > visit.endDate) {
      warnings.push(`Visit startDate > endDate: ${visit.startDate} > ${visit.endDate}`);
    }
  }

  // Log warnings
  if (warnings.length > 0) {
    console.warn(`⚠️  Markdown issues in "${filename}":`);
    for (const w of warnings) {
      console.warn(`   - ${w}`);
    }
  }
}
```

---

## 3. Návrh refaktorizace

### Fáze 1: Immediate fixes (hotfix) ✅ HOTOVO

- [x] Odstranit inference logiku
- [x] Přidat warningy pro problematické separátory
- [x] Odstranit debug logy
- [x] Přesunout konstanty do `build.config.ts`

### Fáze 2: Konsolidace (short-term)

- [x] Centralizovat konstanty: `minPhotosForAutoSeparator`, `minPhotosForDisplay`
- [ ] Vytvořit `validateStoryData()` a volat při načtení
- [x] Dokumentovat Wall Clock principle

### Fáze 3: Architekturální refactoring (medium-term)

- [ ] Vytvořit `SeparatorService` s jasným API
- [ ] Změnit "look-ahead" kalkulaci na explicitní mapování
- [ ] Menu položky generovat přímo ze separátorů

### Fáze 4: Testing (ongoing)

- [ ] Unit testy pro `organizeDayItems()` se všemi edge cases
- [ ] Integration testy pro markdown → manifest → menu flow
- [ ] Snapshot testy pro stabilitu menu výstupu

---

## 4. Závěr

Současná architektura je **funkční, ale křehká**. Hlavní problémy:

1. ~~Příliš mnoho implicitní logiky~~ → **VYŘEŠENO** (konstanty v config)
2. **Chybějící validace** → K implementaci
3. **Rozptýlená odpovědnost** → Budoucí refactoring
4. **Závislost na přesném řazení** → Dokumentováno (Wall Clock principle)

---

_Vytvořeno: 2026-01-02_
_Aktualizováno: 2026-01-02_
