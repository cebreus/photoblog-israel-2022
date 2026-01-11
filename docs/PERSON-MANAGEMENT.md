# Správa osob a manuální workflow

Tento dokument definuje principy správy osob, automatické detekce a manuálních zásahů v systému fotoblogu.

**Navigace:** [← INDEX](./INDEX.md) | [FACE-CLUSTERING →](./FACE-CLUSTERING.md) | [ARCH-BUILD →](./ARCH-BUILD.md)

## Slovník pojmů

| Pojem                        | Význam                                                                                                                                 |
| :--------------------------- | :------------------------------------------------------------------------------------------------------------------------------------- |
| **Osoba (Person)**           | Logická entita reprezentující konkrétního člověka, sochu nebo malbu. Sdružuje detekované tváře.                                        |
| **Tvář (Face)**              | Abstraktní pojem – detekovaná tvář na fotografii.                                                                                      |
| **FaceCrop**                 | Fyzický výřez tváře – `.jpg` soubor uložený ve `static-<gallery>/faces/<personId>/`.                                                   |
| **Odepnutí (Disconnect)**    | Akce rozbití vztahu mezi konkrétní tváří a skupinou. Tvář se oddělí do nové vlastní entity.                                            |
| **Sloučení (Merge)**         | Spojení dvou nebo více entit do jedné. Cílová entita absorbuje všechna vizuální data a pravidla.                                       |
| **Skrytí (Hidden)**          | Příznak (`hidden: true`), který entitu přesouvá do sekce "Skryté". Entita je stále v hlavní kategorii, ale vizuálně potlačena.         |
| **Koš (Junk Person)**        | "Nezajímavá" osoba (např. turista v pozadí). Má příznak `junk: true`. Clustering ji ignoruje. Lze kdykoliv vrátit.                     |
| **Zneplatnění (Invalidate)** | Oznaceni detekce jako "není tvář" (stín, kámen). Odstraní se z manifestu a souřadnice se zapíšou do `invalidDetections` v constraints. |
| **Přejmenování (Rename)**    | Změna jména a technického ID. Vyžaduje unikátnost.                                                                                     |

## 1. Uživatelské rozhraní (GUI)

Systém poskytuje dva hlavní prvky pro správu entit:

### 1.1 Sidebar (Postranní panel "Lidé")

- Zobrazuje seznam všech entit s jejich náhledy, jména a počtem tváří.
- Obsahuje filtry ("Vše", "Žádné", "Reset") pro zobrazování fotek podle přítomnosti osob.
- **Editace:** Kliknutím na jméno entity můžete přímo přejmenovat (v dev módu).
- **Skrytí:** Ikona oka (`EyeOff`) přepíná příznak `hidden`.
- **Sekce "Skryté":** Expandovatelný accordion pro entity s příznakem `hidden: true`.
- **Sekce "Koš":** Expandovatelný accordion pro nezajímavé osoby (`junk: true`).
- **Sekce "Zneplatněné detekce":** Seznam smazaných detekcí, u kterých AI v budoucnu nemá nic hledat.
- **Kategorie:** Accordiony pro "Osoby", "Sochy", "Malby".

### 1.2 Dialog detailu entity

Otevírá se kliknutím na miniaturu osoby v sidebaru.

- **Zobrazení všech výřezů:** Grid všech tváří přiřazených k dané entitě.
- **Výběr výřezů:** Kliknutím vyberte jednu nebo více tváří.
- **Hromadné akce:**
  - **Přiřadit k...** – Přesun vybraných tváří do jiné entity.
  - **Skrýt** – Odepne vybrané tváře a vytvoří novou skrytou entitu.
  - **Odepnout** – Odepne vybrané tváře do nové entity.
  - **Není tvář, ignorovat** (Zneplatnit) – Označí výřezy jako chybné (AI omyl). Zapíše se do `invalidDetections`.
- **Změna kategorie:** 3 tečky → Typ osoby → Osoba / Socha / Malba.

## 2. Kategorie a Typy

Každá entita má přiřazenou kategorii:

- **Osoba (person):** Výchozí kategorie pro lidské tváře. ID: `person-NNN-<hash>` nebo `person-<name>-<hash>`.
- **Socha (statue):** Pro tváře zachycené na sochách, pomnících. ID: `statue-NNN-<hash>` nebo `statue-<name>-<hash>`.
- **Malba (painting):** Pro tváře na obrazech, freskách, plakátech. ID: `painting-NNN-<hash>` nebo `painting-<name>-<hash>`.

**Poznámka:** Systém striktně vynucuje anglické prefixy (`person-`, `statue-`, `painting-`). Staré české prefixy (`osoba-`, `socha-`) jsou deprecated a automaticky se převádí.

**Změna kategorie:**

1.  Otevřete dialog detailu entity (klik na miniaturu v sidebaru).
2.  Klikněte na 3 tečky (vpravo).
3.  Vyberte "Typ osoby" → zvolte kategorii.

Při **Odepnutí** nově vzniklá entita **dědí kategorii** původní entity.

## 3. Životní cyklus entity

### 3.1 Vytvoření

- **Automaticky (Clustering):** Skript `face-clustering.ts` analyzuje tváře. Klastr může vzniknout i pro **jediný výskyt na jediné fotografii**.
- **Manuálně (Odepnutí):** Tvář je oddělena z klastru a získá vlastní identitu.

### 3.2 Skrytí vs. Junk vs. Invalida

- **Skrytí (Hide):**
  - Příznak `hidden: true`.
  - Entita se přesunuje do sekce "Skryté".
  - **Technicky stále aktivní:** Entita existuje a clustering k ní může přiřazovat nové fotky, jen není vidět v hlavním seznamu.

- **Koš (Junk Person):**
  - Příznak `junk: true`.
  - Entita se přesune do sekce "Koš".
  - **Ignorováno clusteringem:** Systém tuto osobu explicitně přeskakuje při hledání shody. Tváře, které by k ní patřily, vytvoří raději novou osobu.
  - Používá se pro náhodné kolemjdoucí, které nechcete mazat, ale ani k nim nic nového přiřazovat.

- **Zneplatnění detekce (Invalidate):**
  - Souřadnice jsou zapsány do pole `invalidDetections` v `clustering-constraints.json`.
  - Tvář zmizí z manifestu.
  - Používá se pro věci, které nejsou lidi (stíny, kameny, pařezy).

## 4. Manuální akce a omezení

### 4.1 Odepnutí ("Disconnect")

**Cíl:** Vytrhnout tvář z nesprávně přiřazené entity.

**Postup v GUI:**

1.  Otevřete dialog detailu entity (klik na miniaturu).
2.  Vyberte jednu nebo více tváří (kliknutím).
3.  Klikněte "Odepnout" (ikona koše, červené).

**Co se stane:**

- **Dědičnost příznaků:** Nově vzniklá entita (např. `Odpojeno od...`) **přebírá všechny vlastnosti** zdroje (kategorii, stav `hidden` atd.).
- Vytvoří se tvrdé pravidlo: "Původní osoba **není** na těchto fotkách."

**Proč vzniká více entit?** Aby se zabránilo náhodnému seskupení nepříbuzných tváří. Později je můžete sloučit.

### 4.2 Skrytí ("Hide")

**Cíl:** Potlačit zobrazování entity, ale zachovat její data.

**Postup v GUI:**

- **Jednotlivá entita:** V sidebaru klikněte na ikonu oka (`EyeOff`) vedle entity.
- **Hromadné:** Zaškrtněte checkboxy u více entit → Skrýt.

**Co se stane:**

- Nastaví se `hidden: true`.
- Entita zmizí z hlavního seznamu a přesune se do sekce "Skryté".

**Obnovení:** Klikněte znovu na ikonu oka.

### 4.3 Zneplatnění detekce ("Invalidate Detection")

**Cíl:** Trvalé vyřazení chybné detekce (např. vzor na tričku, reflex), kterou AI omylem považuje za tvář.

**Postup v GUI:**

1.  Otevřete dialog detailu entity.
2.  Vyberte tvář, která není validní.
3.  Klikněte 3 tečky → **Není tvář, ignorovat**.
    - Zobrazí se potvrzovací dialog.

**Co se stane:**

- Souřadnice výřezu jsou zapsány do pole `invalidDetections` v `clustering-constraints.json`.
- Tvář zmizí z manifestu.
- Při dalším spuštění `face-clustering.ts` bude tato oblast přeskočena.
- Fyzický soubor výřezu zůstane na disku pro revizi.

### 4.4 Sloučení ("Merge")

**Cíl:** Spojit více entit do jedné (např. "Person 1" + "Person 2" → "Jaruška").

**Postup v GUI:**

1.  V sidebaru zaškrtněte checkboxy u 2 nebo více entit.
2.  Klikněte "Sloučit".
3.  V dialogu potvrzení vidíte, která entita bude **cílová** (ta s nejvyšším počtem tváří nebo vlastním jménem).

**Co se stane:**

- **Cílová osoba:**
  - Absorbuje klastry zdrojových osob (Multi-Cluster učení).
  - Získá všechny tváře ze zdrojových osob.
  - Pokud neměla miniaturu a zdroj měl, použije se první dostupná.
- **Zdrojové osoby:**
  - Jsou smazány.
  - Jejich složky s výřezy jsou přesunuty do složky cílové osoby.
  - Manuální pravidla (connects/disconnects) jsou migrována na cílovou entitu.

**Jméno:** Zůstává jméno cílové osoby. Pokud chcete jiné jméno, přejmenujte cílovou osobu po sloučení.

### 4.5 Přejmenování ("Rename")

**Postup v GUI:**

- V sidebaru klikněte na jméno entity → přímo editujte → klikněte zaškrtnutí.

**Co se stane:**

- Změní se slug ID (např. `person-jaruska-<hash>`).
- Přejmenuje se fyzická složka `static-<gallery>/faces/<old-id>` → `<new-id>`.
- Aktualizují se všechny odkazy v manifestech.

**Konflikt:** Pokud již existuje entita s daným slugem, operace selže (409). V takovém případě použijte Sloučení.

## 5. Proces sestavení a opakování clusteringu

Příkaz `pnpm process` je **inkrementální**.

### 5.1 Jak funguje cache?

- **Kontrola deskriptorů:** Při novém spuštění systém nejprve kontroluje `faces.manifest.json`. Pokud tam jsou deskriptory, AI detekce se přeskakuje a použijí se cachovaná data.
- **Kontrola hash:** U každé fotografie se kontroluje `xxhash`. Pokud se soubor nezměnil, přeskakuje se zpracování.
- **Vynucení pravidel:** Na konci každého běhu jsou aplikována všechna manuální propojení a odpojení z `clustering-constraints.json`. **Vaše manuální korekce mají vždy absolutní přednost.**

### 5.2 Jak vyvolat opakovaný clustering?

Pokud chcete znovu přeskupit tváře od nuly (např. po úpravě parametrů clusteringu):

1.  Smažte soubor `src/data/<galerie>/people.manifest.json`.
2.  Spusťte `pnpm process`.
    - Systém znovu vytvoří klastry na základě podobnosti.
    - Následně aplikuje vaše uložená manuální pravidla z `clustering-constraints.json`.
    - **Vaše práce nepřijde vniveč.**

3.  Pro úplné přegenerování všeho (včetně náhledů): `pnpm process --clean`.

## 6. API odkazy

Pro související operace existují API endpointy používané v GUI i skriptech:

- Čtení/mazání constraintů: viz [API-REFERENCE.md › GET `/api/people/constraints`](./API-REFERENCE.md#get-apipeopleconstraints) a [DELETE `/api/people/constraints`](./API-REFERENCE.md#delete-apipeopleconstraints)
- Zneplatnění detekce: viz [API-REFERENCE.md › POST `/api/people/invalidate-detection`](./API-REFERENCE.md#post-apipeopleinvalidate-detection)
- Spuštění re-clusteringu: viz [API-REFERENCE.md › POST `/api/people/run-clustering`](./API-REFERENCE.md#post-apipeoplerun-clustering)

### 5.3 Co se stane při opakovaném spuštění bez změn?

- Fotky, které se nezměnily, se **nepřegenerují**.
- Klastry se **nezmění**, pokud nedošlo k novým detekcím.
- Manuální pravidla jsou **znovu vynutěna** (pro případ, že došlo k manuální úpravě manifestů).
- **Existující přiřazení osob k fotkám jsou zachována** (pokud nejsou explicitně odpojeny v constraints).

## 6. Řešení problémů a údržba

### 6.1 Audit a úklid

**Jednorázový úklid:**

Pokud narazíte na "duchy" (osoby bez fotek v sidebaru), spusťte:

```bash
bun scripts/clean-empty-people.ts
```

**Hloubkový audit:**

Pro kontrolu a opravu nekonzistencí v datech použijte:

```bash
# Kontrola bez oprav
bun scripts/audit-people.ts

# Automatická oprava
bun scripts/audit-people.ts --fix
```

Skript kontroluje:

- **faceCount** – zda hodnota odpovídá skutečnému počtu fotek s danou osobou.
- **Osiřelé složky** – složky ve `static-<gallery>/faces/` bez odpovídajících záznamů v manifestu.
- **Zastaralá omezení** – odkazy na smazané osoby v `clustering-constraints.json`.

### 6.2 Známá omezení a pravidla

| Scénář                                 | Chování                                                                                            |
| :------------------------------------- | :------------------------------------------------------------------------------------------------- |
| **Odepnutí od junk osoby**             | Nová entita dědí příznak `junk: true`.                                                             |
| **Sloučení s junk osobou**             | Pokud je zdrojová osoba junk, cílová se stane také junk.                                           |
| **Re-clustering bez mazání manifestu** | Existující přiřazení jsou zachována, pokud nejsou v disconnects.                                   |
| **Konzistence dat v DEV**              | **Opraveno (2025-12-31):** Všechny akce (merge, rename, unmatch) nyní automaticky reloadují cache. |

### 6.3 Bezpečnostní mechanismy

#### Automatický backup constraints

Před každým spuštěním face clusteringu se automaticky zálohuje `clustering-constraints.json`:

```
src/data/<galerie>/.constraints-backups/
├── constraints-2024-12-29T09-00-00.json
├── constraints-2024-12-29T10-00-00.json
└── ... (posledních 5 verzí)
```

**Obnovení ze zálohy:**

```bash
cp src/data/egypt-2025/.constraints-backups/constraints-TIMESTAMP.json \
   src/data/egypt-2025/clustering-constraints.json
```

#### Pre-build kontroly

Před zpracováním se automaticky spustí kontroly konzistence:

- Osoby s `faceCount=0` ale s thumbnail
- Osoby bez validních deskriptorů
- Faces manifest reference na neexistující obrázky
- Zastaralé odkazy v constraints

#### Dry-run mód

Pro náhled změn bez jejich uložení:

```bash
bun scripts/face-clustering.ts --dry-run
```

Zobrazí:

- Počet osob (celkem, pojmenované, junk, skryté)
- Počet obrázků s tváří
- Celkový počet face referencí

### 6.4 Úplný reset (nuclear option)

Pokud jsou data v nekonzistentním stavu a audit nepomáhá:

1.  Smažte:
    - `src/data/<galerie>/people.manifest.json`
    - `src/data/<galerie>/faces.manifest.json`
2.  **Nezapomeňte zachovat** `clustering-constraints.json` (obsahuje vaše manuální pravidla!).
3.  Spusťte: `pnpm process`

Systém znovu provede detekci tváří, vytvoří nové klastry a následně aplikuje vaše uložená manuální pravidla.

## Související dokumenty

- [ARCHITECTURE.md](./ARCHITECTURE.md) — Hlavní přehled architektury
- [FACE-CLUSTERING.md](./FACE-CLUSTERING.md) — Technické detaily clusteringu
- [INTERACTIVITY.md](./INTERACTIVITY.md) — UI interakce
- [SCRIPTS.md](./SCRIPTS.md) — CLI příkazy

---

_Poslední aktualizace: 2026-01-05_
