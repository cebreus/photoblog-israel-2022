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

- **Existující osoby:** ID, jména a jejich "tvářové deskriptory" jsou zachovány.
- **Opakovaný běh:** Nové spuštění skriptu **nezruší** existující osoby. Pouze k nim může přiřadit nové fotky (nebo odebrat, pokud se změní práh).
- **Změna prahu (Threshold):**
  - Pokud **snížíte** `distanceThreshold` (např. z 0.6 na 0.5), systém při příštím běhu může usoudit, že některé fotky už nepatří k původní osobě (protože 0.55 > 0.5). V takovém případě vytvoří pro tyto fotky **novou osobu** (klon). Původní osoba zůstává. Tyto nové klony pak musíte v UI ručně sloučit s původní osobou.
  - To je záměrné chování pro bezpečnost dat - raději duplikovat, než chybně sloučit.

## Spuštění

Pro spuštění procesu shlukování použijte příkaz:

```bash
bun scripts/face-clustering.ts
```

Tento skript:

- Načte manifest `people.manifest.json`, `images.manifest.json` a `embeddings.manifest.json` (pokud existují).
- Projde všechny fotky.
- Aktualizuje manifesty o nové osoby a přiřazení.
- Vygeneruje náhledy (thumbnails) do `static/<GALLERY>/faces/`.

## Konfigurace

Nastavení se nachází přímo v souboru `scripts/face-clustering.ts` v objektu `FACE_CONFIG`.

- **minConfidence:** `0.5` (Minimální jistota detekce tváře)
- **distanceThreshold:** `0.5` (Práh pro shlukování. Menší hodnota = přísnější shlukování, více vzniklých osob. Větší hodnota = agresivnější slučování.)

> **Poznámka k threshold 0.5:** Tato hodnota byla zvolena pro minimalizaci chybných sloučení (false positives). Je bezpečnější nechat systém vytvořit více "osob" (které uživatel snadno sloučí), než aby systém chybně spojil různé lidi dohromady.

## Quality Control (QC)

Pro kontrolu správnosti detekce a shlukování systém ukládá výřezy všech detekovaných tváří:

- Cesta: `static/<GALLERY>/faces/<personId>/`
- Obsah: Výřezy všech tváří přiřazených k dané osobě.

Tuto strukturu můžete procházet a ověřit, zda ve složce jedné osoby nejsou tváře někoho jiného.

## Správa Osob v UI

- **Sloučení (Merge):** Pokud systém vytvořil více profilů pro jednu osobu, můžete je v záložce "Lidé" vybrat a sloučit.
- **Odpojení (Unmatch):** Pokud je k osobě chybně přiřazena cizí tvář, můžete ji v detailu osoby odpojit. Tím se vytvoří nová osoba.
- **Skrytí:** Osoby, které mají po sloučení 0 fotek (byly sloučeny do jiné), jsou v seznamu skryté, ale v datech zůstávají zachovány pro stabilitu.
- **Ignorování:** Osobu lze označit jako ignorovanou. Systém ji pak při příštím běhu přeskočí a nebude k ní přiřazovat nové tváře.

### Persistentní Učení (Constraints)

Systém se učí z vašich manuálních zásahů. Pokud v UI provedete **odpojení (Unmatch)** tváře:

1. Vytvoří se `clustering-constraints.json` ve složce dat galerie.
2. Zaznamená se pravidlo: _"Tato konkrétní fotka nikdy nesmí patřit této osobě"_.
3. Při dalším spuštění `face-clustering.ts` skript toto pravidlo respektuje a zabrání AI v opětovném sloučení, i kdyby byla vizuální podobnost vysoká.

## Řešení Problémů

### Chyby Skriptů (Missing Binding)

Pokud skript selže na chybějící `tfjs_binding.node` nebo `canvas.node`, viz **[Troubleshooting v SCRIPTS.md](./SCRIPTS.md#troubleshooting)**.

### Chybějící tváře

Pokud se zdá, že na fotce chybí osoby, je pravděpodobné, že byly detekovány, ale chybně přiřazeny k již existující osobě (sloučeny).

- Zkontrolujte složky ve `static/<GALLERY>/faces/`.
- Zkuste snížit `distanceThreshold`.

### Ladění (Debugging)

Pro detailní analýzu konkrétní fotky můžete použít debug skript (pokud je available) nebo zkontrolovat logy `face-clustering.ts`, který vypisuje počet nalezených tváří na fotce.
