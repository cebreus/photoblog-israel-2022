# TODO

Centrální seznam zbývajících úkolů pro projekt.

## Features & Enhancements

### Special Media Support (Fáze 2 & 3)

- [ ] **360° Viewer Integration**: Integrovat webový viewer (např. Pannellum nebo Three.js) pro zobrazování `equirectangular` fotografií (`--sphere`). Aktuálně se detekují, ale chybí UI komponenta.
- [ ] **XMP GPano Parsing**: Rozšířit `scripts/lib/image/metadata.ts` o čtení Google PhotoSphere XMP dat (`GPano:ProjectionType`, `GPano:PoseHeadingDegrees`) pro autoritativní detekci panoramat.
- [ ] **Fisheye Correction**: Implementovat korekci zkreslení pro Rybí oko (`fisheye`) pomocí WebGL shaderu v lightboxu.
- [ ] **UI Indicators**: Přidat ikony do mřížky pro speciální typy médií (360°, Panorama, Sekvence).
- [ ] **Metadata Display**: Zobrazovat Horizontal FOV a kompas (Heading) v detailu fotky, pokud jsou metadata dostupná.

## Bugs & Tests

- [ ] **Opravit `tests/e2e/lightbox.spec.ts`**: Testy aktuálně selhávají, protože kliknutí na fotku neprobublá k akci `useFancybox` na rodičovské sekci.
  - Problém: V E2E prostředí (Playwright) se událost `click` zastaví/neprobublá, přestože v komponentě `PhotoGridItem` nejsou explicitně volány metody `stopPropagation()`.
  - Nutno prozkoumat interakci se Svelte 5 fragmenty a `ContextMenu.Trigger`.
  - Možné řešení: Připojit listenery přímo na elementy v `PhotoGridItem` místo delegace na úrovni sekce.
