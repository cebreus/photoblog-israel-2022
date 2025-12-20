# Uživatelská Interaktivita a Systémová Odezva

Tento dokument popisuje interaktivní prvky uživatelského rozhraní, jejich chování z pohledu uživatele a odpovídající reakce systému (změny stavu, URL parametrů atd.).

## Obsah

- [Hlavička (Header.svelte)](#hlavička-header.svelte)
  - [Logo](#logo)
  - [Přepínač zobrazení metadat (Overlay)](#přepínač-zobrazení-metadat-overlay)
  - [Přepínač režimu kurátora (Curation)](#přepínač-režimu-kurátora-curation)
  - [Přepínač režimu ladění (Debug)](#přepínač-režimu-ladění-debug)
  - [Přepínač postranního panelu (Sidebar)](#přepínač-postranního-panelu-sidebar)
- [Postranní panel (AppSidebar.svelte)](#postranní-panel-appsidebar.svelte)
  - [Přepínání záložek (Tabs)](#přepínání-záložek-tabs)
  - [Záložka Agenda](#záložka-agenda-agendatab.svelte)
  - [Záložka Filtry](#záložka-filtry-filterstab.svelte)

---

## Hlavička (Header.svelte)

Přehled interaktivních prvků umístěných v horní navigační liště.

### Logo

- **Element:** `data-testid="header-logo"`
- **Dostupnost:** Všechny režimy.
- **Co to dělá:** Odkaz na domovskou stránku.
- **Akce uživatele:** Kliknutí na logo/název stránky.
- **Reakce systému:** Navigace na kořenovou URL `/`.

### Přepínač zobrazení metadat (Overlay)

- **Element:** `data-testid="header-metadata-overlay-trigger"`
- **Dostupnost:** Pouze v `dev` režimu.
- **Co to dělá:** Zapíná/vypíná vrstvu s technickými metadaty nad fotografiemi (EXIF, skóre, tagy).
- **Akce uživatele:** Kliknutí na ikonu "Tagy".
- **Reakce systému:**
  - Vizuálně přepne stav tlačítka (aktivní/neaktivní).
  - Zobrazí/skryje overlay komponenty na fotkách v mřížce.
  - **URL Sync:** Přidá/odebere parametr `?overlay` (přítomnost značí zapnuto).

### Přepínač režimu kurátora (Curation)

- **Element:** `data-testid="header-curation-trigger"`
- **Dostupnost:** Pouze v `dev` režimu.
- **Co to dělá:** Aktivuje nástroje pro správu obsahu (výběr fotek, hromadné akce).
- **Akce uživatele:** Kliknutí na ikonu "Jiskry".
- **Reakce systému:**
  - Vizuálně přepne stav tlačítka.
  - Povolí výběr fotografií kliknutím.
  - Zobrazí kontextové menu pro kurátorské akce.
  - **URL Sync:** Přidá/odebere parametr `?curation`.

### Přepínač režimu ladění (Debug)

- **Element:** `data-testid="header-debug-trigger"`
- **Dostupnost:** Pouze v `dev` režimu.
- **Co to dělá:** Zobrazí detailní ladící informace v UI.
- **Akce uživatele:** Kliknutí na ikonu "Brouk".
- **Reakce systému:**
  - Vizuálně přepne stav tlačítka.
  - Zobrazí technické detaily o stavu aplikace, storech a datech.
  - **URL Sync:** Přidá/odebere parametr `?debug`.

### Přepínač postranního panelu (Sidebar)

- **Element:** `data-testid="header-sidebar-trigger"`
- **Dostupnost:** Všechny režimy.
- **Co to dělá:** Otevírá nebo zavírá postranní panel s filtry a navigací.
- **Akce uživatele:** Kliknutí na ikonu šipky/panelu vpravo.
- **Reakce systému:**
  - Vysune nebo zasune postranní panel z pravé strany.
  - Přizpůsobí šířku hlavního obsahu (gridu).
  - **URL Sync:**
    - Panel otevřen: Parametr `?sidebar` je **přítomen**.
    - Panel zavřen: Parametr `?sidebar` je **odstraněn**.
    - _Poznámka: Výchozí stav při čisté URL je otevřeno._

## Postranní panel (AppSidebar.svelte)

Ovládání záložek v postranním panelu.

### Přepínání záložek (Tabs)

- **Elementy:**
  - **Agenda** (Všechny režimy): `data-testid="app-sidebar-agenda-tab"`
  - **Filtry** (Všechny režimy): `data-testid="app-sidebar-filters-tab"`
  - **Lidé** (Všechny režimy): `data-testid="app-sidebar-people-tab"`
  - **Editace** (Pouze v `dev`): `data-testid="app-sidebar-edit-tab"`
- **Co to dělá:** Přepíná obsah postranního panelu mezi různými pohledy.
- **Akce uživatele:** Kliknutí na sémantickou záložku (ikonu/text).
- **Reakce systému:**
  - Zobrazí příslušný obsah panelu (navigace po dnech, filtrování, seznam lidí, editační nástroje).
  - Při přepnutí na "Editace" se aktivuje editační režim (`editor.editMode = true`).
  - **URL Sync:** Parametr `?tab=název` (agenda, filters, people, edit). Pokud je aktivní "agenda" (výchozí), parametr se odstraní.

### Záložka Agenda (AgendaTab.svelte)

- **Element:** `data-testid="agenda-tab"`
- **Dostupnost:** Pouze v režimu záložky "Agenda".
- **Co to dělá:** Zobrazuje hierarchický seznam dnů a lokalit (míst) v galerii.
- **Interakce:**
  - **Navigace na den:** Kliknutí na den (rozbalovací) posune grid na začátek daného dne. (Aktualizuje URL hash u prohlížeče)
  - **Navigace na lokalitu:** Kliknutí na pod-položku (místo) posune grid na konkrétní sekci fotografií. (Aktualizuje URL hash u prohlížeče)
  - **Rozbalení/Sbalení:** Šipka vpravo u dne sbalí nebo rozbalí seznam lokalit.
  - **URL Sync (Hash):** Kliknutí na den/lokalitu nastaví `#YYYY-MM-DD` nebo `#YYYY-MM-DD-loc`.

### Záložka Filtry (FiltersTab.svelte)

- **Element:** `data-testid="filters-tab"`
- **Dostupnost:** Pouze v režimu záložky "Filtry".
- **Co to dělá:** Umožňuje filtrování fotografií a nastavení zobrazení a je plně synchronizovaná s URL pro možnost sdílení stavu aplikace.
- **Reaktivita a URL Sync:**
  - **Zobrazit popisky:**
    - **Akce:** Přepínač "Zobrazit popisky".
    - **Reakce:** Zobrazí/skryje textový popis místa u každé fotografie.
    - **URL Query:** `?labels` (přítomen = popisky zobrazeny).
  - **Zobrazit zastávky:**
    - **Akce:** Přepínač "Zobrazit zastávky".
    - **Reakce:** Zobrazí/skryje oddělovací hlavičky v mřížce fotografií (seskupení podle místa).
    - **URL Query:** `?no-separators` (přítomen = zastávky skryty; _inverted logic_).
  - **Autoři:**
    - **Akce:** Přepínače u jednotlivých jmen v sekci "Autoři".
    - **Reakce:** Filtruje mřížku pouze na fotografie od vybraných autorů.
    - **URL Query:** `?authors=karel,petr` (obsahuje slugy vybraných autorů oddělené čárkou). Pokud jsou vybráni všichni (výchozí stav), parametr se v URL nenachází.
  - **Kvalita fotek:**
    - **Akce:** Přepínače "Excellent", "Good", "Poor" v sekci "Kvalita fotek".
    - **Reakce:** Filtruje fotografie podle jejich technické kvality.
    - **URL Query:** `?quality=excellent,good` (obsahuje id vybraných kategorií). Výchozí stav je "vše zapnuto", tehdy parametr v URL není. Pokud uživatel vypne "Poor", v URL bude `?quality=excellent,good`.
    - **Výpočet kvality:**
      - **Aesthetic Score:** Počítáno pomocí AI modelu CLIP.
        > **CLIP** (Contrastive Language-Image Pre-training) je AI model od OpenAI, který propojuje text a obraz. Zde hodnotí, jak moc fotografie odpovídá pozitivním (např. 'ostré', 'dobrá kompozice') vs. negativním (např. 'rozmazané') textovým popisům, a generuje tak estetické skóre.
      - **Sharpness:** Počítáno pomocí Laplacian variance (detekce hran).
      - **Excellent:** Aesthetic ≥ 65 A Sharpness ≥ 80.
      - **Poor:** Aesthetic < 45 NEBO Sharpness < 40.
      - **Good:** Vše ostatní mezi tím.
  - **Vzhled (Téma):**
    - **Akce:** Tlačítka Slunce/Monitor/Měsíc v patičce panelu.
    - **Reakce:** Přepíná vizuální téma aplikace (Světlý/Systémový/Tmavý).
    - **Persistenece:** Stav se ukládá do `localStorage` prohlížeče (pomocí knihovny `mode-watcher`), **nepropisuje** se do URL query, protože jde o globální uživatelskou preferenci, nikoliv o stav obsahu galerie.

### Záložka Lidé (PeopleTab.svelte)

- **Element:** `data-testid="people-tab"`
- **Dostupnost:** Pouze v režimu záložky "Lidé".
- **Co to dělá:** Zobrazuje seznam detekovaných osob, umožňuje jejich filtrování, správu a detailní prohlížení.
- **Hlavní funkce:**
  - **Seznam osob:** Zobrazuje jméno, miniaturu tváře a počet fotografií.
  - **Filtrování (Výběr):**
    - Kliknutím na řádek osoby se tato osoba vybere.
    - **Logika:** Zobrazí se POUZE fotografie, na kterých je alespoň jedna z vybraných osob.
    - **Předvolby (Tlačítka nahoře):**
      - **Vše (Check):** Vybere všechny osoby = Zobrazí jen fotky s lidmi (skryje krajinky).
      - **Žádné (X-Circle):** Nevybere nikoho (zvolí speciální stav "none") = Zobrazí jen fotky BEZ lidí (krajinky).
      - **Reset (X):** Zruší výběr = Zobrazí všechny fotografie (výchozí stav).
  - **URL Sync:**
    - Výběr se propisuje do `?people=id1,id2`.
    - Stav "Žádné" se propisuje jako `?people=none`.
- **Detail osoby:**
  - Kliknutím na miniaturu (nebo jméno) se otevře dialog s detaily (`PersonDetailDialog`).
  - Zobrazuje všechny výřezy tváří dané osoby.
  - **URL Sync:** Otevření detailu přidá parametr `?person=id`.
- **Vývojářské nástroje (Dev Mode):**
  - **Přejmenování:** Kliknutím na jméno lze osobu přejmenovat (input field).
  - **Slučování (Merge):**
    - Zaškrtnutím checkboxů u více osob se objeví tlačítko "Sloučit".
    - Otevře `PersonMergeDialog`.
    - Logika automaticky vybere cílovou osobu (preferuje uživatelské jméno před generickým, pak vyšší počet fotek).
  - **Ignorování:**
    - Tlačítko koše (nebo hromadné "Ignorovat").
    - Přesune osobu do sekce "Ignorované osoby" (ve spodní části panelu).
    - Tyto osoby se nezobrazují v hlavním seznamu ani ve filtrech (pokud nejsou explicitně obnoveny).
