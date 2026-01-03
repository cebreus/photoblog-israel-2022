# CLAP editor (Clean Aperture)

> Práce s HEIC clean aperture (CLAP atom) a ořezy v GUI.

**Navigace:** [← INDEX](./INDEX.md) | [SPECIAL-MEDIA →](./SPECIAL-MEDIA.md) | [ARCH-BUILD →](./ARCH-BUILD.md)

## Účel

- Udržet přesný výřez uložený v HEIC/HEIF přes **clean aperture (clap)** atom.
- Umožnit bezpečný převod mezi nativními souřadnicemi (raw orientace) a uživatelským cropem v UI (po aplikaci EXIF Orientation).
- Zdroj pravdy je **přímo HEIC soubor**; manifest se pro CLAP nepoužívá.

## Data a typy

- `shared/types/clap.ts`
  - `CleanApertureData`: nativní pixely, šířka/výška a offsety od středu.
  - `UserCrop`: UI reprezentace v procentech (0–100 %) po EXIF rotaci.
- `shared/utils/clap-transform.ts`
  - `nativeClapToUserCrop(...)`: převod nativních clap hodnot na UI crop (bere EXIF `orientation`).
  - `userCropToNativeClap(...)`: převod z UI zpět do nativních clap souřadnic.
  - `validateClap(...)`: kontrola, že crop zůstává v mezích zdrojové fotky.
- `scripts/lib/image/clap-parser.ts`: čtení CLAP atomu z HEIC (build-time).

## Převody a orientace

- EXIF orientace 1/3/6/8 jsou plně podporované; 5/7 fallback.
- Pro orientace s otočením se prohozuje osa W/H (isSwapped). Výstup je vždy v procentech 0–100 a ořez je clampován do rozsahu.
- Offsety `horizOffset` a `vertOffset` jsou definované **od středu** nativního obrázku.

## Workflow

1. Build/CLI načte CLAP z HEIC (`clap-parser`), uloží nativní hodnoty.
2. UI editor pracuje s `UserCrop` (procenta, po rotaci). Při ukládání se hodnoty převádějí na nativní clap a validují (`validateClap`).
3. CLAP se aplikuje při generování variant (sharp pipeline) pro konzistentní výřezy.

## Pravidla

- Nehardcodujte crop do manifestů; vždy čtěte/ukládejte CLAP přímo k souboru.
- Při zápisu vždy validujte (`validateClap`), aby ořez nepřetékal mimo zdrojové rozměry.
- Zachovávejte správnou EXIF orientaci při převodech (před i po úpravě v UI).

## Související dokumenty

- [SPECIAL-MEDIA.md](./SPECIAL-MEDIA.md) — Speciální média (panoramata, sekvence)
- [ARCH-BUILD.md](./ARCH-BUILD.md) — Build proces a image pipeline
- [ARCHITECTURE.md](./ARCHITECTURE.md) — Hlavní přehled architektury

---

_Poslední aktualizace: 2026-01-05_

- Multi-gallery: respektujte `CONTENT_DIR` pro vstupy/výstupy, i když CLAP je uložen v souboru.
