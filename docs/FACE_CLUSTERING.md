# Detekce a Shlukování Tváří (Face Clustering)

Tento projekt obsahuje funkcionalitu pro automatickou detekci tváří na fotografiích a jejich shlukování do osob (clustering).

## Jak to funguje

1. **Detekce:** Script projde všechny fotografie v galerii a pomocí AI modelu (SSD MobileNet V1) nalezne tváře.
2. **Embedding:** Pro každou tvář se vypočítá 128-rozměrný vektor (embedding), který reprezentuje rysy tváře.
3. **Clustering (Shlukování):**
   - Script porovnává nové tváře s již existujícími osobami.
   - Pokud je vzdálenost (Euclidean distance) mezi tváří a osobou menší než nastavený práh (`distanceThreshold`), tvář je přiřazena k osobě.
   - Pokud ne, vytvoří se nová osoba.

### Zachování Dat (Persistence)

Skript automaticky načítá existující `people.manifest.json`.

- **Existující osoby:** ID, jména, kategorie (osoba, socha, malba) a jejich "tvářové deskriptory" jsou zachovány.
- **Opakovaný běh:** Nové spuštění skriptu **nezruší** existující osoby ani jejich ručně nastavené vlastnosti (např. stav skrytí). Pouze k nim může přiřadit nové fotografie.
- **Změna prahu (Threshold):**
  - Pokud **snížíte** `distanceThreshold` (např. z 0.6 na 0.5), systém při příštím běhu může usoudit, že některé fotografie už nepatří k původní osobě. V takovém případě vytvoří pro tyto fotografie **novou osobu** (klon). Původní osoba a její metadata zůstávají. Tyto nové klony pak můžete v UI sloužit.
  - To je záměrné chování pro bezpečnost dat - raději duplikovat, než chybně sloučit.

## Spuštění

Pro spuštění procesu shlukování použijte příkaz:

```bash
bun scripts/face-clustering.ts
```

Tento skript:

- Načte manifest `people.manifest.json`, `images.manifest.json` a `embeddings.manifest.json` (pokud existují).
- Projde všechny fotografie.
- Aktualizuje manifesty o nové osoby a přiřazení.
- Vygeneruje náhledy (thumbnails) do `static/<GALLERY>/faces/`.

## Konfigurace

Nastavení se nachází přímo v souboru `scripts/face-clustering.ts` v objektu `FACE_CONFIG`.

- **minConfidence:** `0.5` (Minimální jistota detekce tváře)
- **distanceThreshold:** `0.5` (Práh pro shlukování. Menší hodnota = přísnější shlukování, více vzniklých osob. Větší hodnota = agresivnější slučování.)

> **Poznámka k threshold 0.5:** Tato hodnota byla zvolena pro minimalizaci chybných sloučení (false positives). Je bezpečnější nechat systém vytvořit více "osob" (které uživatel snadno sloučí), než aby systém chybně spojil různé lidi dohromady.

## Quality Control (QC)

Pro kontrolu správnosti detekce a shlukování systém ukládá **faceCrops** (výřezy tváří) jako `.jpg` soubory:

- Cesta: `static/<GALLERY>/faces/<personId>/`
- Obsah: FaceCrops všech tváří přiřazených k dané osobě.

Tuto strukturu můžete procházet a ověřit, zda ve složce jedné osoby nejsou faceCrops někoho jiného.

## Správa Osob v UI

- **Sloučení (Merge):** Pokud systém vytvořil více profilů pro jednu osobu, můžete je v záložce "Lidé" vybrat a sloučit.
- **Odpojení (Unmatch):** Pokud je k osobě chybně přiřazena cizí tvář, můžete ji v detailu osoby odpojit. Tím se vytvoří nová osoba.
- **Skrytí:** Osoby, které mají po sloučení 0 fotek (byly sloučeny do jiné), jsou v seznamu skryté.
- **Junk (Nezajímavá osoba):** Celou osobu lze označit jako `junk`. Systém ji při příštím běhu **clusteringu ignoruje** (nepoužívá ji jako vzor pro hledání shod), což zabraňuje opětovnému přiřazování náhodných lidí k této osobě. V UI je v sekci "Junk".
- **Chybná detekce (Invalidate):** Konkrétní detekci lze označit za chybnou (např. stín). Systém si zapamatuje souřadnice a příště toto místo zcela ignoruje.

Systém se učí z vašich manuálních zásahů. Tato pravidla se ukládají do `clustering-constraints.json` ve složce dat galerie:

1. **Odpojení (Unmatch):** Zaznamená se pravidlo: _"Tato konkrétní fotografie nikdy nesmí patřit této osobě"_.
2. **Chybná detekce (Invalidate):** Zaznamená se pravidlo do `invalidDetections`: _"Tato oblast na této fotce není tvář"_.
3. **Přiřazení (Connect):** Ruční propojení tváře k osobě, které systém sám nespojil.

Při dalším spuštění `face-clustering.ts` skript tato pravidla respektuje a zabrání AI v opakování stejných chyb.

## Řešení Problémů

### Chyby Skriptů (Missing Binding)

Pokud skript selže na chybějící `tfjs_binding.node` nebo `canvas.node`, viz **[Troubleshooting v SCRIPTS.md](./SCRIPTS.md#troubleshooting)**.

### Chybějící tváře

Pokud se zdá, že na fotce chybí osoby, je pravděpodobné, že byly detekovány, ale chybně přiřazeny k již existující osobě (sloučeny).

- Zkontrolujte složky ve `static/<GALLERY>/faces/`.
- Zkuste snížit `distanceThreshold`.

### Ladění (Debugging)

Pro detailní analýzu konkrétní fotografie můžete použít debug skript (pokud je available) nebo zkontrolovat logy `face-clustering.ts`, který vypisuje počet nalezených tváří na fotografii.
