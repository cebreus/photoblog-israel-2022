Níže posílám kompaktní report a návrh migrace. Vzhledem k rozsahu zásahů navrhnu poté přepnutí do Code módu k implementaci.

Souhrn z výsledných šablon a DOM (fallback k Nunjucks)

- Mapa stránek
  - / (israel-2022) [src/templates/pages/israel-2022/index.html](src/templates/pages/israel-2022/index.html)
  - /best-of [src/templates/pages/best-of/index.html](src/templates/pages/best-of/index.html)
  - /changelog [src/templates/pages/changelog/index.html](src/templates/pages/changelog/index.html)
  - 404 [src/templates/pages/404.html](src/templates/pages/404.html)

- Globální layout
  - [layout-default.html](src/templates/layout-default.html): přidává head, preload fontů, SEO a meta partials, favicony, vkládání CSS/JS přes injektory a hlavní tělo
  - Hlavička: partial [o-header.njk](src/templates/partials/o-header.njk) s .o-header, brand odkaz na /, hlavní menu (Vše, Výběr fotek), “title-switch”, tlačítko .offcanvas menu
  - Patička: partial [o-footer.njk](src/templates/partials/o-footer.njk) s .o-footer a copyright
  - Offcanvas menu: macro [/\_offcanvas-menu.njk](src/templates/partials/_offcanvas-menu.njk) zobrazuje “Obsah této strany” – přehled dnů s odkazy na kotvy #day-YYYY-MM-DD
  - Meta: [meta-seo.njk](src/templates/partials/meta-seo.njk), [meta-open-graph.njk](src/templates/partials/meta-open-graph.njk), [meta-twitter-cards.njk](src/templates/partials/meta-twitter-cards.njk), [favicons.njk](src/templates/partials/favicons.njk)

- Struktura obsahu na / a /best-of
  - main obsahuje:
    - [c-jumbo.njk](src/templates/partials/c-jumbo.njk): .o-main .c-jumbo s h1 a texty (zdroj z page MD)
    - [c-article.njk](src/templates/partials/c-article.njk): .c-article volitelný HTML/MD blok
    - Pro každý den IMAGES[key] sekce <section id="day-YYYY-MM-DD">:
      - [c-day-content.njk](src/templates/partials/c-day-content.njk): H2 s dnem v týdnu a datem, seznam měst a “where” jako badge
      - [c-gallery.njk](src/templates/partials/c-gallery.njk): mísí textové bloky kind=markdown, mapové “scroll” bloky, a mřížku fotek kind=image (link na details, <picture> s sources do previews-xl, previews, fallback previews-xxs); special case “blurred-img” pro první den

- Opakovatelné patterny a komponenty
  - Organismy: .o-header, .o-footer, .o-main
  - Molekuly/komponenty: .c-jumbo, .c-article, .c-day-content, .c-gallery, .c-map-scroll
  - Navigace: makra [/\_main-nav.njk](src/templates/partials/_main-nav.njk) a [/\_offcanvas-menu.njk](src/templates/partials/_offcanvas-menu.njk)
  - Kotvy po dnech: id="day-YYYY-MM-DD"

- Hierarchie nadpisů
  - H1 v c-jumbo, H2 denní nadpisy v c-day-content, H3 uvnitř markdown akordeonů

Build proces Gulp a zdroje

- Vstupy a config
  - [gulpfile.js](gulpfile.js): orchestruje úlohy
  - Dev config [gulpconfig.js](gulpconfig.js) -> buildBase ./temp; Production [gulpconfig.build.js](gulpconfig.build.js) -> buildBase ./build
  - Šablony: pages v [src/templates/pages](src/templates/pages), partials v [src/templates/partials](src/templates/partials), layout [layout-default.html](src/templates/layout-default.html)

- Data a šablonovací systém (Nunjucks)
  - Hlavní kompilace [buildHtml()](gulp-tasks/gulp-html-build.js:29):
    - Konfigurace Nunjucks, filtry ‘date’, ‘md’, global toDate
    - Vkládá data: SITE z temp/site.json, IMAGES z temp/\_dataset-images-notes.json, BESTOF z temp/\_dataset-images-notes-best-of.json, plus JSONy z content/pages markdownu
    - Přemapovává currentFile.dirname dle page SEO ‘slug’ pro adresáře
    - Injektuje CSS/JS soubory do placeholderů v layoutu a CDN JS do <!-- inject: bootstrap js -->
  - Dataset příprava
    - Markdown na JSON [datasetPrepare()](gulp-tasks/gulp-dataset-prepare.js:87) a [datasetPrepareNotes()](gulp-tasks/gulp-dataset-prepare.js:90) s enrich funkcí [modifyJson()](gulp-tasks/gulp-dataset-prepare.js:49) – doplňuje kind, groupBy, délky textů
    - EXIF + image JSON [datasetBuildImages()](gulp-tasks/gulp-dataset-images.js:208): čte JPGy, [exifr.parse], [probe-image-size], filtruje a vytváří metadata (date, groupBy, type: landscape/portrait/pano, ratio, city, where, keywords)
    - Merge notes a images [datasetNotesAndImages()](gulp-tasks/gulp-dataset-prepare.js:94): setřídí podle data, groupBy po dnech, vloží kind=location sentinel na začátky skupin shodného “where”, uloží do \_dataset-images-notes.json; varianta pro best-of filtruje keywords=prio2

- Styly a skripty
  - SASS: [compileSassCore()](gulpfile.js:56) bootstrap.scss -> bootstrap.css, [compileSassCustom()](gulpfile.js:72) custom.scss -> custom.css, [compileSassUtils()](gulpfile.js:87) u-\*.scss -> utils.css, postcss autoprefixer
  - JS: [processJs()](gulpfile.js:104) přes [gulp-tasks-build/gulp-process-js.js](gulp-tasks-build/gulp-process-js.js) Babel, uglify, concat volitelně

- Assety a výstupy
  - Obrázky: optimalizace jpg/png/svg a resize setů details, previews, previews-xl, previews-xxs a map varianty do static/assets/${DATA_DIR}/...
  - Fonty: [fontLoad()](gulpfile.js:287) + kopie do build assets/font
  - Výstupy: dev do ./temp, prod do ./build; HTML vychází z pages (adresáře dle SEO slug), CSS/JS do assets/css, assets/js, obrázky a maps do assets/${DATA_DIR}/...

Kde se definuje výsledná struktura a skládání

- Rozvržení stránky: [layout-default.html](src/templates/layout-default.html) a partialy (o-header, o-footer, meta…)
- Obsahové sekce: [israel-2022/index.html](src/templates/pages/israel-2022/index.html), [best-of/index.html](src/templates/pages/best-of/index.html) – 1) jumbo, 2) article, 3) cyklus IMAGES/BESTOF per day se sekcemi, c-day-content a c-gallery
- Data: jsony v temp/\_dataset… (spojení EXIF a MD) plus stránky v content/pages/\*\*

Návrh ekvivalentu ve Svelte (SvelteKit, Bun)
Cíle:

- Replikovat markup třídy a id z legacy DOM pro kompatibilitu se styly
- Přenést datovou logiku: EXIF, groupBy po dnech, best-of filtrování
- Udržet jednoduchost buildu obrázků (již existuje generátor) a rozšířit jej o EXIF

Architektura a routy

- Routy:
  - /: homepage (israel-2022)
  - /best-of
  - /changelog
  - 404 povýšit na +error.svelte
- Layout:
  - [src/routes/+layout.svelte](bun-svelte-photoblog/src/routes/+layout.svelte) bude používat legacy header/footer s třídami .o-header/.o-footer místo současné Tailwind-only verze; bez Bootstrap JS, offcanvas nahradíme Svelte komponentou
  - [src/routes/+layout.ts](bun-svelte-photoblog/src/routes/+layout.ts) zachová prerender=true

- Data vrstva:
  - Rozšíření generátoru obrázků o EXIF a keywords:
    - [scripts/generate-images.ts](bun-svelte-photoblog/scripts/generate-images.ts) doplnit exifr a per-soubor metadata: date, groupBy, type, city, where, caption, objectName, country, keywords; uložit do manifestu do nové větve entry.meta
    - Typy rozšířit v [src/lib/types/images.ts](bun-svelte-photoblog/src/lib/types/images.ts) a [src/lib/images.manifest.json.d.ts](bun-svelte-photoblog/src/lib/images.manifest.json.d.ts)
  - Runtime dataset modul:
    - Nový [src/lib/dataset.ts](bun-svelte-photoblog/src/lib/dataset.ts): načte manifest, zgrupuje dle meta.groupBy po dnech, vyrobí kolekce cities a wheres, vloží kind=location sentinel dle pravidel v [datasetNotesAndImages()](gulp-tasks/gulp-dataset-prepare.js:94); volitelný filtr bestOf=prio2
  - Page MD modul (pro jumbo a article):
    - Nový [src/lib/pages.ts](bun-svelte-photoblog/src/lib/pages.ts): načítá content/pages/{route}/index.md (front-matter: jumbo.title, jumbo.excerpt, body…), vrací pro rendering c-jumbo a c-article

Komponenty Svelte 1:1 k partialům

- Legacy (zachování tříd/id):
  - [HeaderLegacy.svelte](bun-svelte-photoblog/src/lib/legacy/HeaderLegacy.svelte): markup dle [o-header.njk](src/templates/partials/o-header.njk), .o-header, brand, hlavní menu, title-switch, tlačítko otevírá Offcanvas
  - [OffcanvasMenu.svelte](bun-svelte-photoblog/src/lib/legacy/OffcanvasMenu.svelte): analogie [/\_offcanvas-menu.njk](src/templates/partials/_offcanvas-menu.njk), generuje dnešní seznam s anchor odkazy
  - [FooterLegacy.svelte](bun-svelte-photoblog/src/lib/legacy/FooterLegacy.svelte): markup dle .o-footer s copyrightem
  - [Jumbo.svelte](bun-svelte-photoblog/src/lib/legacy/Jumbo.svelte): .o-main .c-jumbo, h1, excerpt, content
  - [Article.svelte](bun-svelte-photoblog/src/lib/legacy/Article.svelte): .c-article s {@html body}
  - [DayContent.svelte](bun-svelte-photoblog/src/lib/legacy/DayContent.svelte): H2, cities, badges wheres
  - [Gallery.svelte](bun-svelte-photoblog/src/lib/legacy/Gallery.svelte): .c-gallery mřížka a map scroll, “blurred-img” pro první den; <picture> zdroje mapovat na naše previews a details z manifestu

Stránky Svelte

- / (+page.server.js): načíst page MD israel-2022 a dataset days; +page.svelte složí: <Jumbo> <Article> {#each days} <section id="day-..."><DayContent/><Gallery/></section> {/each}
- /best-of: totéž s flagem bestOf
- /changelog: jen Jumbo + Article z MD
- +error.svelte: ekvivalent [src/templates/pages/404.html](src/templates/pages/404.html)

Mapování Gulp -> Svelte

- Gulp šablony Nunjucks -> Svelte komponenty [Jumbo.svelte](bun-svelte-photoblog/src/lib/legacy/Jumbo.svelte), [Article.svelte](bun-svelte-photoblog/src/lib/legacy/Article.svelte), [DayContent.svelte](bun-svelte-photoblog/src/lib/legacy/DayContent.svelte), [Gallery.svelte](bun-svelte-photoblog/src/lib/legacy/Gallery.svelte), [HeaderLegacy.svelte](bun-svelte-photoblog/src/lib/legacy/HeaderLegacy.svelte), [FooterLegacy.svelte](bun-svelte-photoblog/src/lib/legacy/FooterLegacy.svelte), [OffcanvasMenu.svelte](bun-svelte-photoblog/src/lib/legacy/OffcanvasMenu.svelte)
- Gulp dataset [datasetBuildImages()](gulp-tasks/gulp-dataset-images.js:208) + [datasetNotesAndImages()](gulp-tasks/gulp-dataset-prepare.js:94) -> generátor [scripts/generate-images.ts](bun-svelte-photoblog/scripts/generate-images.ts) rozšířený o EXIF a runtime [src/lib/dataset.ts](bun-svelte-photoblog/src/lib/dataset.ts)
- Inject CSS/JS -> řeší Vite/SvelteKit; favicony a meta lze přenést do +layout.svelte <svelte:head> (volitelně)
- Bootstrap třídy -> markup zachován; JS interakce offcanvas nahradíme Svelte logikou

Mermaid diagramy

- Legacy build
  - graph TD
    A[content md] --> D[dataset json]
    B[images jpg] --> C[exif merge]
    C[exif merge] --> D[dataset json]
    D[dataset json] --> E[nunjucks pages]
    E[nunjucks pages] --> F[html css js]
- Svelte build
  - graph TD
    A2[content pages md] --> D2[page data]
    B2[images manifest] --> C2[dataset.ts group]
    C2[dataset.ts group] --> S1[svelte routes]
    D2[page data] --> S1[svelte routes]
    S1[svelte routes] --> S2[components]
    S2[components] --> F2[pre-rendered html]

Co bude přidáno/upraveno v bun-svelte-photoblog

- Závislosti: přidat exifr do [package.json](bun-svelte-photoblog/package.json)
- Generátor:
  - Upravit [scripts/generate-images.ts](bun-svelte-photoblog/scripts/generate-images.ts) pro zápis EXIF a keywords do manifestu entry.meta{date,groupBy,city,where,caption,objectName,country,keywords,type}
  - Upravit typy [src/lib/types/images.ts](bun-svelte-photoblog/src/lib/types/images.ts) a [src/lib/images.manifest.json.d.ts](bun-svelte-photoblog/src/lib/images.manifest.json.d.ts)
- Runtime data:
  - Nový [src/lib/dataset.ts](bun-svelte-photoblog/src/lib/dataset.ts) s groupBy po dnech, cities, wheres, sentinel location, bestOf filtr
  - Nový [src/lib/pages.ts](bun-svelte-photoblog/src/lib/pages.ts) pro načítání MD stránek (jumbo, body)
- Komponenty legacy markup:
  - Přidat [src/lib/legacy/HeaderLegacy.svelte](bun-svelte-photoblog/src/lib/legacy/HeaderLegacy.svelte), [src/lib/legacy/OffcanvasMenu.svelte](bun-svelte-photoblog/src/lib/legacy/OffcanvasMenu.svelte), [src/lib/legacy/FooterLegacy.svelte](bun-svelte-photoblog/src/lib/legacy/FooterLegacy.svelte), [src/lib/legacy/Jumbo.svelte](bun-svelte-photoblog/src/lib/legacy/Jumbo.svelte), [src/lib/legacy/Article.svelte](bun-svelte-photoblog/src/lib/legacy/Article.svelte), [src/lib/legacy/DayContent.svelte](bun-svelte-photoblog/src/lib/legacy/DayContent.svelte), [src/lib/legacy/Gallery.svelte](bun-svelte-photoblog/src/lib/legacy/Gallery.svelte)
- Routy:
  - Upravit [src/routes/+layout.svelte](bun-svelte-photoblog/src/routes/+layout.svelte) na legacy komponenty a vložit OffcanvasMenu do footeru
  - Upravit [src/routes/+page.server.js](bun-svelte-photoblog/src/routes/+page.server.js) a [src/routes/+page.svelte](bun-svelte-photoblog/src/routes/+page.svelte) na nový dataset days a page MD
  - Upravit [src/routes/best-of/+page.server.js](bun-svelte-photoblog/src/routes/best-of/+page.server.js) a [+page.svelte](bun-svelte-photoblog/src/routes/best-of/+page.svelte) stejně s bestOf
  - Přidat [src/routes/+error.svelte](bun-svelte-photoblog/src/routes/+error.svelte) jako 404

Instrukce ke spuštění a buildu

- Generace obrázků s EXIF:
  - bun run images:build
  - volitelně: bun run images:blur
- Dev server:
  - bun run dev
- Build:
  - bun run build
- Preview:
  - bun run preview

Známé rozdíly a omezení

- Bootstrap JS se nenahrává; offcanvas funkčnost řeší jednoduchá Svelte komponenta. Třídy zůstávají zachovány kvůli kompatibilitě stylů.
- Fancybox není součástí; markup data-fancybox ponecháme. Lightbox lze doplnit dodatečně.
- Favicony a meta lze migrovat do <svelte:head> v layoutu; případně ponechat stávající.

Navrhovaný plán prací k provedení v Code módu

1. Upravit typy a generátor obrázků o EXIF a keywords, aktualizovat manifest
2. Implementovat [src/lib/dataset.ts](bun-svelte-photoblog/src/lib/dataset.ts) s groupBy a bestOf
3. Implementovat [src/lib/pages.ts](bun-svelte-photoblog/src/lib/pages.ts) pro jumbo/body z MD
4. Přidat legacy komponenty 1:1 dle Nunjucks partials a aktualizovat layout, homepage a best-of
5. Přidat +error.svelte a stránku changelog z MD
6. Otestovat routování, kotvy #day-YYYY-MM-DD a offcanvas seznam
7. Shrnutí změn, dify a příkazů pro běh

Chcete-li pokračovat rovnou implementací dle výše uvedeného plánu, přepnu se do Code módu.
