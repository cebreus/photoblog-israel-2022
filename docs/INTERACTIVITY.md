# 1. Uživatelská Interaktivita a Systémová Odezva

Tento dokument popisuje interaktivní prvky uživatelského rozhraní a odpovídající reakce systému.

**Obsah**

- [1. Uživatelská Interaktivita a Systémová Odezva](#1-uživatelská-interaktivita-a-systémová-odezva)
  - [1.1. Klíčové Koncepty](#11-klíčové-koncepty)
    - [1.1.1. Vývojářský režim (Dev Mode)](#111-vývojářský-režim-dev-mode)
    - [1.1.2. Filtrační logika](#112-filtrační-logika)
    - [1.1.3. Editační režim (Edit Mode)](#113-editační-režim-edit-mode)
    - [1.1.4. Kurátorský režim (Curation Mode)](#114-kurátorský-režim-curation-mode)
    - [1.1.5. Ladící režim (Debug Mode)](#115-ladící-režim-debug-mode)
  - [1.2. Hlavička (Header)](#12-hlavička-header)
  - [1.3. Hlavní zobrazení (Timeline)](#13-hlavní-zobrazení-timeline)
  - [1.4. Postranní panel (Sidebar)](#14-postranní-panel-sidebar)
  - [1.5. Patička (Footer)](#15-patička-footer)
  - [1.6. Manifesty (Datová vrstva)](#16-manifesty-datová-vrstva)

---

## 1.1. Klíčové Koncepty

### 1.1.1. Vývojářský režim (Dev Mode)

Základní podmínka pro přístup k editačním a kurátorským funkcím.

Dostupné pouze v lokálním vývojovém prostředí. Produkční verze tyto prvky zcela odstraňuje.

### 1.1.2. Filtrační logika

Nezávislá funkční vrstva určující výslednou množinu zobrazených fotografií. Je oddělena od grafického rozhraní (např. karet v panelu).

- **Autoři** → výběr alespoň jednoho (Vztah OR).
- **Kvalita** → povolení kategorií Excellent/Good/Poor (Vztah OR).
- **Lidé** → výběr konkrétních osob (Vztah OR).
- **None** → zobrazení pouze fotek bez lidí (krajinky).
- **Průnik** → kombinace všech výše uvedených kritérií (Vztah AND).

**Systémová odezva:**

- **Prerekvizity** → Načtené manifesty (viz sekce [1.6](#16-manifesty-datová-vrstva)).
- **Průběh** → Změna stavu ve filtru storu → aktualizace URL parametrů → reaktivní přepočet a filtrace dat na klientovi.
- **Výsledek** → Okamžitá změna zobrazení v prohlížeči.

### 1.1.3. Editační režim (Edit Mode)

Slouží k hromadné správě metadat a manipulaci s obsahem (dostupné v Dev Mode).

- **Aktivace** → výběr záložky **»Editace«** v postranním panelu.
- **Mřížka** → přepnutí na čtvercový formát 1:1.
- **Klik na fotku** → přidání do výběru / odebrání z výběru.
- **Shift + Klik** → hromadný výběr rozsahu fotek.
- **Pravý klik** → vyvolání kontextového menu s akcemi:
  - **Smazat / Archivovat** → odstranění snímku z galerie.
  - **Kopírovat metadata** → uložení metadat snímku do schránky aplikace.
  - **Vložit metadata** → aplikace metadat ze schránky na konkrétní snímek nebo na celou vybranou skupinu (pokud je cíl součástí výběru).
- **Správa výběru** → informační řádek v horní části záložky **»Editace«** zobrazující vybrané snímky s možností jejich odebrání nebo hromadného vložení metadat.

**Systémová odezva:**

- **Prerekvizity** → Aktivní Dev Mode.
- **Průběh** → Interakce uživatele → změna stavu výběru v `editor` storu.
- **Výsledek** → Vizuální zvýraznění vybraných fotek v mřížce (modrý overlay).

### 1.1.4. Kurátorský režim (Curation Mode)

Slouží výhradně k řešení vizuálních duplicit a podobných sérií (dostupné v Dev Mode).

- **Aktivace** → kliknutí na ikonu **»Jiskry«** v hlavičce.
- **Jantarový okraj** → označení fotky s nalezenou duplicitou.
- **Štítek »DOPORUČENO«** → zelené označení nejlepšího kandidáta v sérii.
- **Tlačítko »Porovnat«** → otevření srovnávacího dialogu.
- **Doporučení** → systém navrhuje nejlepší snímek dle rozlišení, AI skóre a ostrosti.

**Systémová odezva:**

- **Prerekvizity** → Aktivní Dev Mode + `curation.manifest.json`.
- **Průběh** → Načtení skupin podobnosti → zvýraznění v UI → uživatelské rozhodnutí o smazání/zachování.
- **Výsledek** → Aktualizace mřížky a případné odstranění duplicit.

### 1.1.5. Ladící režim (Debug Mode)

Odhaluje vnitřní stav aplikace pro potřeby vývoje.

- **Aktivace** → ikona **»Brouk«** v hlavičce.
- **JSON Viewer** → zobrazení surových dat (ID, EXIF, AI parametry) pod každou fotografií.
- **Technické info** → technické detaily buildu a verze přístupné v surových datech JSON vieweru.

---

## 1.2. Hlavička (Header)

Navigační a ovládací prvky v horní části stránky.

- **Logo** → navigace na kořenovou URL `/`. Tato akce vymaže všechny aktivní filtry a nastavení (reset stavu).
- **Ikona »Tagy«** → viz [1.1.3](#113-editační-režim-edit-mode) (zapnutí overlay vrstvy s metadaty).
- **Ikona »Jiskry«** → viz [1.1.4](#114-kurátorský-režim-curation-mode) (aktivace Kurátorského režimu).
- **Ikona »Brouk«** → viz [1.1.5](#115-ladící-režim-debug-mode) (aktivace Ladícího režimu).
- **Ikona »Šipka«** → otevření/zavření postranního panelu.

**Systémová odezva:**

- **Prerekvizity** → Aktivní Dev Mode pro editační/kurátorské ikony.
- **Průběh** → Klik na tlačítko → změna `ui` nebo `editor` storu → synchronizace s URL query.
- **Výsledek** → Změna stavu komponent, update URL (`?overlay`, `?curation`, `?debug`, `?sidebar`).

---

## 1.3. Hlavní zobrazení (Timeline)

Centrální mřížka s fotografiemi a dělicími prvky.

- **Scroll** → automatická detekce viditelného dne a místa. Tato informace se propisuje do navigace v **Záložce Agenda** v sidebaru.
- **Položka gridu** → otevření Lightboxu (v režimu prohlížení).
- **Položka gridu** → výběr/označení (v režimu editace).
- **Separátor** → zobrazení názvu lokality a města.
- **Story dialog** → u separátorů obsahujících doprovodný text se zobrazí odkaz **»Zobrazit příběh«**. Kliknutí otevře dialogové okno s formátovaným textem, který je čerpán z manifestu (`story`).

**Systémová odezva:**

- **Prerekvizity** → Vyfiltrovaná data z `filters` storu.
- **Průběh** → Detekce elementu v viewportu (Scrollspy) → update URL hashe.
- **Výsledek** → URL se mění na `#RRRR-MM-DD` nebo `#RRRR-MM-DD-loc`.

---

## 1.4. Postranní panel (Sidebar)

UI kontejner pro nástroje interagující s nezávislými logickými celky.

- **Záložka Agenda** → rychlá navigace na dny/místa. Zvýrazňuje aktuální polohu detekovanou pomocí [Scrollu](#13-hlavní-zobrazení-timeline).
- **Záložka Filtry** → rozhraní pro nastavení [Filtrační logiky](#112-filtrační-logika).
- **Záložka Lidé** → správa osob a jejich filtraci (propojeno s [Filtrační logikou](#112-filtrační-logika)).
  - **Shift + Klik** → hromadný výběr osob pro filtraci (výběr rozsahu).
  - **Checkboxy »Slučování«** → výběr osob pro spojení do jednoho profilu.
  - **Shift + Klik na checkbox** → hromadné označení osob pro sloučení (výběr rozsahu).
  - **Sekce »Junk«** → správa nezajímavých osob (příznak `junk`).
  - **Sekce »Chybné detekce«** → seznam ignorovaných výřezů (AI omyly).
- **Záložka Editace** → nástroje pro [Editační režim](#113-editační-režim-edit-mode) (jen v Dev Mode).

**Systémová odezva:**

- **Prerekvizity** → Inicializace synchronizace URL parametrů.
- **Průběh** → Interakce v záložce → změna parametrů v příslušném storu → reaktivní reakce aplikace.
- **Výsledek** → Okamžité překreslení mřížky fotek nebo změna výběru.

---

## 1.5. Patička (Footer)

Statický prvek na konci stránky.

- **Text** → zobrazení copyrightu z manifestu.

**Systémová odezva:**

- **Prerekvizity** → Data v `siteManifest`.
- **Průběh** → Vykreslení statického obsahu.
- **Výsledek** → Zobrazení informací na konci stránky.

---

## 1.6. Manifesty (Datová vrstva)

Aplikace funguje na principu »Split & Link« manifestů generovaných během buildu:

- `images.manifest.json` → Hlavní struktura časové osy a EXIF metadata fotografií.
- `people.manifest.json` → Katalog identifikovaných osob (včetně příznaků `hidden` a `junk`).
- `curation.manifest.json` → Skupiny duplicit a doporučení **bestCandidate**.
- `analysis.manifest.json` → AI analýza obrazu (estetika, ostrost, PHash).
- `embeddings.manifest.json` → Vektorové otisky CLIP pro vyhledávání podobnosti.
- `faces.manifest.json` → Deskriptory (128-dim) pro clustering tváří.
- `clustering-constraints.json` → Manuální pravidla, propojení, odpojení a `invalidDetections`.
