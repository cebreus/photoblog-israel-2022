# Kritická analýza: plan-releasedate-sorting.md

## Shrnutí

Plán navrhuje nahradit současný systém `sortOrder` + `sortorder.manifest.json` přímým zápisem `xmp:ReleaseDate` do souborů. Tento dokument analyzuje návrh z hlediska **výkonu, spolehlivosti, komplexity a edge cases**.

---

## 🔴 KRITICKÉ PROBLÉMY

### 1. ~~Destruktivní zápis do originálních souborů~~ ✅ PŘIJATELNÉ

**Kontext projektu:**
Tento projekt již běžně zapisuje do originálů (collage API, metadata API používají exiftool).
Zápis `XMP:ReleaseDate` je konzistentní s existující praxí.

**Stav:** Není problém pro tento projekt.

---

### 2. ~~Výkon při reorderu~~ ✅ ŘEŠITELNÉ

**Původní odhad:** 100 fotek = 5-20 sekund

**Mitigace:**

1. ExifTool `-stay_open true` mode (již používáme `exiftool-vendored`)
2. Batch mode pro hromadné zápisy
3. Reorder není častá operace (1-2x za session)

**Stav:** Akceptovatelný trade-off.

---

### 3. Race conditions při simultánních operacích ✅ OŠETŘENO V PLÁNU

**Řešení v plánu (Phase 3.3):**

- `withManifestLock()` pro atomické operace
- Watchdog automaticky načte nové ReleaseDate při rebuildu
- Není potřeba speciální koordinace

**Stav:** Ošetřeno.

---

### 4. ~~Ztráta dat při DELETE~~ ✅ OPRAVENO V PLÁNU

**Původní problém:** DELETE mazal ReleaseDate úplně

**Oprava v plánu (Phase 3.2):**

- DELETE nyní **resetuje** ReleaseDate na hodnotu DateTimeOriginal
- ReleaseDate **nikdy není null**
- "Reset to EXIF order" = nastavit releaseDate = date

**Stav:** Opraveno.

---

## 🟠 VÝZNAMNÉ PROBLÉMY

### 5. Timestamp kolize

**Problém v calculateReleaseDates:**

```typescript
const seconds = i + 1;
date.setSeconds(seconds);
```

**Limit:** Pouze 86400 unikátních pozic za den (počet sekund).

**Edge case:**

- Den s > 86400 fotkami → kolize
- Prakticky nereálné, ale architektonicky nečisté

**Lepší řešení:**

```typescript
// Použít milisekundy
const ms = i * 10; // 10ms rozestupy = 8.6M pozic/den
date.setMilliseconds(ms);
```

---

### 6. Nekonzistence mezi manifestem a soubory

**Scénář:**

1. ExifTool write selže na 50. souboru z 100
2. Manifest je aktualizován pro všech 100

**Důsledek:**

- Manifest říká jedno, soubory říkají druhé
- Při příštím rebuildu se manifest přepíše ze souborů → Částečná ztráta řazení

**Řešení:**
Transakční přístup - nejdřív zapsat všechny soubory, pak manifest.

---

### 7. Chybějící fallback pro read-only soubory

**Problém:**
Některé soubory mohou být:

- Read-only (permissions)
- Locked by jiným procesem
- Na read-only filesystem

**Plán neřeší:**
Co se stane, když `exiftool.write()` selže?

---

### 8. Ztráta kompatibility s externími editory

**Problém:**
Pokud uživatel upraví fotku v Lightroomu a Lightroom přepíše XMP metadata:

- ReleaseDate může být odstraněno nebo změněno
- Řazení se ztratí

**Současný stav:**
`sortorder.manifest.json` je izolovaný od externích editorů.

---

## 🟡 MENŠÍ PROBLÉMY

### 9. Sémantický misuse ReleaseDate

**XMP specifikace:**

> `xmp:ReleaseDate` - Date the work was released or published.

**Naše použití:**
Arbitrární timestamp pro řazení v galerii.

**Důsledek:**

- Jiný software (Google Photos, iCloud) může tento field interpretovat jinak
- Metadata cleanup tools ho mohou smazat jako "nevalidní"

---

### 10. Migrace není atomická

**Problém v migračním scriptu:**

```typescript
for (const [imageId, releaseDate] of Object.entries(releaseDates)) {
  await exiftool.write(imagePath, { "XMP:ReleaseDate": releaseDate });
}
```

Pokud migrace selže uprostřed:

- Část fotek má ReleaseDate
- Část nemá
- `sortorder.manifest.json` stále existuje
- Nekonzistentní stav

---

### 11. Zoom sekvence - členové nejsou nezávislí

**Problém:**
Zoom sekvence (`--zoom1from3`, `--zoom2from3`, `--zoom3from3`) by měly být řazeny jako **skupina**.

**Plán neřeší:**
Jak zajistit, že při přeřazení `--zoom3from3` (reprezentativní člen) se přeřadí i hidden členové?

---

### 12. Velikost změn v souborech

**Problém:**
XMP write může změnit:

- File size (padding adjustment)
- mtime (modification time)
- Může triggerovat backup systémy

---

## 📊 SROVNÁNÍ PŘÍSTUPŮ

| Aspekt               | Současný (sortorder.manifest) | Navrhovaný (ReleaseDate) |
| -------------------- | ----------------------------- | ------------------------ |
| Rychlost reorderu    | ~10ms                         | ~5-20s (100 fotek)       |
| Perzistence          | Přežije rebuild               | Přežije rebuild          |
| Integrita originálu  | ✅ Nedotčen                   | ❌ Modifikován           |
| Offline/Backup       | ✅ Jednoduchý                 | ❌ Komplikovaný          |
| Race conditions      | ✅ Manifest lock              | ⚠️ File-level            |
| Undo možnost         | ✅ Ano                        | ❌ Ne                    |
| Komplexita           | Střední                       | Vyšší                    |
| External editor safe | ✅ Ano                        | ⚠️ Může přepsat          |

---

## 💡 ALTERNATIVNÍ NÁVRHY

### Alternativa A: Zachovat sortorder.manifest + opravit edge cases

Místo kompletního přepisu:

1. Opravit collage inheritance (již existuje plán)
2. Opravit zoom sequence handling
3. Přidat robustnější sync mezi ID změnami

**Výhody:**

- Menší změna
- Zachová rychlost
- Nemodifikuje originály

---

### Alternativa B: XMP Sidecar soubory

Místo zápisu do JPG → vytvořit `image.xmp` vedle originálu:

```xml
<?xpacket begin='' id='...'?>
<x:xmpmeta xmlns:x='adobe:ns:meta/'>
  <rdf:RDF xmlns:rdf='http://www.w3.org/1999/02/22-rdf-syntax-ns#'>
    <rdf:Description rdf:about='' xmlns:xmp='http://ns.adobe.com/xap/1.0/'>
      <xmp:ReleaseDate>2025-11-25T00:00:01Z</xmp:ReleaseDate>
    </rdf:Description>
  </rdf:RDF>
</x:xmpmeta>
<?xpacket end='w'?>
```

**Výhody:**

- Originály nedotčeny
- Respektuje Adobe workflow
- Snadný cleanup

**Nevýhody:**

- Více souborů
- Nutné řešit sync mezi JPG a XMP

---

### Alternativa C: Hybridní přístup

1. **Primárně** použít `sortorder.manifest.json`
2. **Sekundárně** zapisovat do XMP sidecar (jako backup)
3. Při rebuildu: priorita manifest > XMP > EXIF date

---

## 🎯 DOPORUČENÍ

### Krátkodobé (Quick fix)

1. Opravit stávající collage/zoom problémy bez přepisu architektury
2. Přidat testy pro edge cases

### Střednědobé (Pokud je nutná změna)

1. Použít **Alternativu B** (XMP sidecar) místo přímého zápisu
2. Implementovat batch mode pro ExifTool
3. Přidat rollback mechanismus

### Vyhýbat se

1. Přímému zápisu do originálních souborů
2. Sekvenčnímu zpracování bez batch mode
3. Destruktivnímu DELETE bez možnosti undo

---

## ✅ CO PLÁN DĚLÁ SPRÁVNĚ

1. **Identifikace problému** - Správně pojmenovaný problém s collage/zoom
2. **Inventura souborů** - Kompletní seznam dotčených míst
3. **Initialization strategy** - ReleaseDate nesmí být prázdné
4. **Migration path** - Existující data nebudou ztracena
5. **Testing plan** - Definované test cases

---

## 📝 ZÁVĚR

Navrhovaná architektura **řeší symptomy** (problémy s collage/zoom), ale **vytváří nové problémy** (výkon, integrita, race conditions).

**Doporučuji:**

1. Nejdřív analyzovat, zda nelze opravit stávající systém
2. Pokud je nutná změna, preferovat XMP sidecar přístup
3. Vyhnout se přímé modifikaci originálů

---

_Analýza vytvořena: 2024-12-31_
_Autor: Gemini Code Review_
