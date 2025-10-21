Na základě vaší žádosti jsem provedl hloubkovou analýzu a porovnání dvou souborů `ARCHITECTURE.md` pro Gulp a SvelteKit verze projektu "Photoblog Israel 2022".

Níže je strukturovaná migrační analýza zaměřená na funkční hodnotu a klíčové koncepty, v souladu s vašimi pokyny.

---

## Strategická Migrační Analýza: Photoblog Israel 2022

### 1. Přehled klíčových konceptů obou projektů

#### Zdrojový projekt (Gulp)
Projekt je koncipován jako klasický statický generátor stránek (SSG) s oddělenými fázemi build procesu. Jeho architektura je založena na **pipeline zpracování**.

-   **Datový model**: Data (obrázky, texty) jsou transformována v několika krocích (extrakce EXIF, spojování s texty, generování JSON datasetů). Klíčovým prvkem je generování dvou oddělených datasetů: kompletního (`IMAGES`) a kurátorovaného (`BESTOF`).
-   **Uživatelské rozhraní**: Postaveno na Nunjucks šablonách a Bootstrapu. Interaktivita je dodána externími JavaScriptovými knihovnami (Fancybox pro lightbox, vlastní skripty pro off-canvas menu).
-   **Klíčová hodnota**: Robustní a detailní zpracování obsahu s důrazem na kontext (denní poznámky, oddělovače lokací) a kurátorovaný výběr "Best Of".

#### Nový projekt (SvelteKit)
Projekt využívá moderní integrovaný přístup, kde hranice mezi build-time a run-time je plynulejší. Architektura je **komponentově orientovaná**.

-   **Datový model**: Data jsou zpracována jediným skriptem (`generate-images.ts`), který produkuje komplexní manifest (`images.manifest.json`). Tento manifest je přímo konzumován SvelteKit aplikací a je typově bezpečný napříč celým systémem.
-   **Uživatelské rozhraní**: Postaveno na reaktivních Svelte komponentách a Tailwind CSS. Interaktivita je nativní součástí komponent (např. modální okna pro příběhy).
-   **Klíčová hodnota**: Výkon, moderní UX (OKLCH barvy, plynulé přechody), vynikající vývojářský zážitek (DX) a silná typová bezpečnost. Zpracování obrázků je vylepšeno o formát AVIF.

### 2. Chybějící funkce k migraci

Jedná se o kritické funkce ze zdrojového projektu, které přímo ovlivňují základní uživatelskou zkušenost a jejich absence v novém projektu představuje funkční regresi.

| Funkce/Koncept | Popis a hodnota | Zdůvodnění |
| :--- | :--- | :--- |
| **Lightbox Galerie** | Umožňuje uživateli zobrazit fotografii na celé obrazovce a procházet galerii daného dne bez opuštění stránky. Jedná se o základní funkci pro jakýkoliv fotoblog. | Nový projekt sice zobrazuje mřížku fotografií, ale kliknutí na ně nevyvolá žádnou akci. Chybí klíčová interakce pro prohlížení detailů. V Gulp projektu tuto funkci zajišťoval `Fancybox`. |
| **"Best Of" stránka** | Poskytuje kurátorovaný výběr nejlepších fotografií napříč celou cestou. Umožňuje rychlý přehled toho nejzajímavějšího a představuje alternativní pohled na obsah. | Gulp projekt generoval samostatný dataset (`BESTOF`) na základě klíčového slova `prio2` v EXIF metadatech a renderoval pro něj dedikovanou stránku. V novém projektu tato logika a stránka zcela chybí. |

### 3. Opomenuté prvky

Funkce, které nejsou absolutně kritické, ale jejich absence ochuzuje projekt o cenný kontext nebo bezpečnostní prvky, které již byly jednou implementovány.

| Funkce/Koncept | Popis a hodnota | Zdůvodnění |
| :--- | :--- | :--- |
| **Zobrazení mapy** | V Gulp projektu existovala komponenta `c-map-scroll.njk`, která zobrazovala obrázek mapy dané oblasti. To poskytovalo uživateli cenný geografický kontext. | V novém projektu není žádná zmínka o mapách ani komponenta, která by je zobrazovala. Data v `content/maps` existují, ale nejsou využita. |
| **Stránka Changelog** | Zobrazuje historii změn a verzí projektu. Zvyšuje transparentnost a profesionalitu projektu. | Gulp projekt generoval stránku `/changelog` z `CHANGELOG.md`. V novém projektu tato stránka a routa chybí. |
| **Subresource Integrity (SRI)** | Bezpečnostní prvek, který pomocí hashů zajišťuje, že načtené externí skripty a styly nebyly pozměněny (ochrana proti MiTM útokům). | Gulp projekt měl dedikovaný task (`gulp-sri-hash.js`) pro generování SRI hashů v produkčním buildu. Ve SvelteKit/Vite to není standardní součástí a bylo to opomenuto. |

### 4. Vhodné k migraci

Funkce, které nejsou nezbytné pro základní fungování, ale jejich implementace by zvýšila kvalitu, uživatelský komfort a celkovou "dokončenost" projektu.

| Funkce/Koncept | Popis a hodnota | Zdůvodnění |
| :--- | :--- | :--- |
| **Pokročilé generování Favicon** | Gulp projekt používal `gulp-favicons.js` k vygenerování kompletní sady favicon pro různé platformy a zařízení (Apple Touch, Android, atd.). | Nový projekt používá pouze jednu `favicon.svg`, což je funkční, ale neposkytuje tak optimalizovaný zážitek na všech zařízeních (např. při připnutí na plochu mobilu). |
| **Detailní SEO a sociální meta tagy** | Starý projekt měl specifické Nunjucks partials pro Twitter Cards (`meta-twitter-cards.njk`). | Nový projekt pravděpodobně spoléhá na základní meta tagy. Explicitní definice Twitter a dalších specifických tagů by zlepšila sdílení na sociálních sítích. |

### 5. K ignorování

Prvky zdrojového projektu, které jsou v novém projektu řešeny lépe, jsou zastaralé, nebo jejich funkci plně přebírá moderní technologický stack.

| Funkce/Koncept | Popis a hodnota | Zdůvodnění |
| :--- | :--- | :--- |
| **Celý Gulp build proces** | Gulp pipeline (`gulpfile.js`, `gulp-tasks/`) byl komplexní systém pro kompilaci, optimalizaci a správu assetů. | Nový projekt využívá integrovaný ekosystém Vite a SvelteKit, který řeší kompilaci, HMR, optimalizaci, code-splitting a asset hashing automaticky a efektivněji. |
| **Šablonovací systém (Nunjucks)** | Nunjucks sloužil k renderování HTML na straně serveru. | Svelte je sám o sobě šablonovací systém i komponentový framework, který plně nahrazuje a dalece přesahuje možnosti Nunjucks. |
| **CSS Framework (Bootstrap)** | Bootstrap poskytoval sadu hotových komponent a grid systém. | Tailwind CSS v novém projektu poskytuje utility-first přístup, který je flexibilnější a vede k menším CSS souborům. Komponenty jsou řešeny na úrovni Svelte. |
| **Manuální JS (`app.js`, `offcanvas-menu.js`)** | Samostatné JS soubory pro interaktivitu. | V novém projektu je veškerá logika zapouzdřena přímo v Svelte komponentách, což je čistší a udržitelnější. |
| **Lokální stahování fontů** | Gulp projekt stahoval Google Fonts a hostoval je lokálně. | Moderní přístup preferuje přímé linkování z Google Fonts CDN s využitím `font-display: swap`, což je pro výkon často lepší řešení. |
| **PurgeCSS, Asset Hashing, Minifikace** | Jednotlivé Gulp tasky pro optimalizaci. | Všechny tyto optimalizace jsou nativní součástí produkčního buildu Vite. |

### 6. Doporučení a akční plán

Pro dokončení migrace a dosažení funkční parity (a překonání) doporučuji následující kroky seřazené podle priority:

1.  **Priorita 1 (Kritické): Implementovat Lightbox Galerii.**
    *   **Akce:** Vybrat a integrovat moderní, lehkou lightbox knihovnu kompatibilní se Svelte (např. `photoswipe` nebo podobnou).
    *   **Cíl:** Po kliknutí na obrázek v mřížce se otevře celoobrazovkový náhled s možností procházení galerie daného dne.

2.  **Priorita 2 (Kritické): Vytvořit stránku "Best Of".**
    *   **Akce:**
        1.  Upravit skript `scripts/generate-images.ts` tak, aby identifikoval obrázky s klíčovým slovem `prio2` (nebo podobným) v EXIF datech.
        2.  Rozšířit `images.manifest.json` o samostatnou sekci pro "Best Of" nebo přidat příznak k jednotlivým obrázkům.
        3.  Vytvořit novou routu `/best-of` v SvelteKit, která bude načítat a zobrazovat pouze tyto vybrané fotografie.
    *   **Cíl:** Obnovit kurátorovaný výběr nejlepších fotografií jako alternativní vstupní bod do galerie.

3.  **Priorita 3 (Doporučené): Doplnit chybějící obsahové prvky.**
    *   **Akce:**
        1.  Vytvořit komponentu pro zobrazení mapy a integrovat ji do záhlaví dne.
        2.  Vytvořit statickou routu a stránku `/changelog`, která bude zobrazovat obsah z `CHANGELOG.md`.
    *   **Cíl:** Zvýšit informační hodnotu a kontext fotoblogu.

4.  **Priorita 4 (Optimalizace a bezpečnost): Dokončit produkční build.**
    *   **Akce:**
        1.  Prozkoumat možnost přidání Vite pluginu pro generování SRI hashů (např. `vite-plugin-sri`).
        2.  Zvážit použití nástroje pro generování kompletní sady favicon z jednoho zdrojového obrázku.
    *   **Cíl:** Dosáhnout stejné úrovně zabezpečení a optimalizace pro koncová zařízení jako v původním projektu.
