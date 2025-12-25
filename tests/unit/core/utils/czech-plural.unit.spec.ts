/**
 * @fileoverview Unit tests for Czech plural helper
 */

import { describe, expect, it } from "vitest";
import { czechPlural, PLURALS } from "$lib/utils/messages";

describe("czechPlural", () => {
  it("returns singular for 1", () => {
    expect(czechPlural(1, "osoba", "osoby", "osob")).toBe("osoba");
  });

  it("returns few for 2-4", () => {
    expect(czechPlural(2, "osoba", "osoby", "osob")).toBe("osoby");
    expect(czechPlural(3, "osoba", "osoby", "osob")).toBe("osoby");
    expect(czechPlural(4, "osoba", "osoby", "osob")).toBe("osoby");
  });

  it("returns many for 0", () => {
    expect(czechPlural(0, "osoba", "osoby", "osob")).toBe("osob");
  });

  it("returns many for 5+", () => {
    expect(czechPlural(5, "osoba", "osoby", "osob")).toBe("osob");
    expect(czechPlural(10, "osoba", "osoby", "osob")).toBe("osob");
    expect(czechPlural(100, "osoba", "osoby", "osob")).toBe("osob");
  });

  it("handles negative numbers using absolute value", () => {
    expect(czechPlural(-1, "osoba", "osoby", "osob")).toBe("osoba");
    expect(czechPlural(-3, "osoba", "osoby", "osob")).toBe("osoby");
    expect(czechPlural(-5, "osoba", "osoby", "osob")).toBe("osob");
  });
});

describe("PLURALS", () => {
  it("osoba - returns correct forms", () => {
    expect(PLURALS.osoba(1)).toBe("osoba");
    expect(PLURALS.osoba(2)).toBe("osoby");
    expect(PLURALS.osoba(5)).toBe("osob");
  });

  it("profil - returns correct forms", () => {
    expect(PLURALS.profil(1)).toBe("profil");
    expect(PLURALS.profil(3)).toBe("profily");
    expect(PLURALS.profil(10)).toBe("profilů");
  });

  it("soubor - returns correct forms", () => {
    expect(PLURALS.soubor(1)).toBe("soubor");
    expect(PLURALS.soubor(4)).toBe("soubory");
    expect(PLURALS.soubor(7)).toBe("souborů");
  });

  it("obrazek - returns correct forms", () => {
    expect(PLURALS.obrazek(1)).toBe("obrázek");
    expect(PLURALS.obrazek(2)).toBe("obrázky");
    expect(PLURALS.obrazek(6)).toBe("obrázků");
  });

  it("fotka - returns correct forms", () => {
    expect(PLURALS.fotka(1)).toBe("fotka");
    expect(PLURALS.fotka(4)).toBe("fotky");
    expect(PLURALS.fotka(0)).toBe("fotek");
  });

  it("detekce - returns correct forms", () => {
    expect(PLURALS.detekce(1)).toBe("detekce");
    expect(PLURALS.detekce(3)).toBe("detekce");
    expect(PLURALS.detekce(5)).toBe("detekcí");
  });
});
