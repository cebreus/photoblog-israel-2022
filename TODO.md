# TODO

Centrální seznam zbývajících úkolů pro projekt.

- [ ] **Opravit `tests/e2e/lightbox.spec.ts`**: Testy aktuálně selhávají, protože kliknutí na fotku neprobublá k akci `useFancybox` na rodičovské sekci.
  - Problém: V E2E prostředí (Playwright) se událost `click` zastaví/neprobublá, přestože v komponentě `PhotoGridItem` nejsou explicitně volány metody `stopPropagation()`.
  - Nutno prozkoumat interakci se Svelte 5 fragmenty a `ContextMenu.Trigger`.
  - Možné řešení: Připojit listenery přímo na elementy v `PhotoGridItem` místo delegace na úrovni sekce.
