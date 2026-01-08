/**
 * @fileoverview Geocoding API Unit Tests
 *
 * @description
 * Tests the server-side geocoding functionality (Nominatim wrapper).
 * Verifies correct parameter handling, country code conversion (ISO2 -> ISO3),
 * localization preference (Czech > English > Local), and error handling.
 *
 * @modules-tested
 * - src/routes/api/geocode/+server.ts
 */
import { describe, expect, it, vi } from "vitest";
import { GET } from "../../../../src/routes/api/geocode/+server";

describe("Geocode API", () => {
  it("should missing parameters error", async () => {
    const url = new URL("http://localhost/api/geocode");
    const res = await GET({
      url,
      fetch: vi.fn(),
      locals: { log: { warn: vi.fn(), info: vi.fn(), error: vi.fn(), debug: vi.fn() } },
    } as any);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("Missing 'lat' or 'lng' parameters");
  });

  it("should invoke nominatim and map data correctly with ISO3 country code conversion", async () => {
    const url = new URL("http://localhost/api/geocode?lat=10&lng=20");
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        address: {
          city: "Test City",
          state: "Test State",
          country: "Test Country",
          country_code: "cz", // Nominatim returns lowercase alpha-2
          suburb: "Test Suburb",
        },
      }),
    });

    const response = await GET({
      url,
      fetch: mockFetch,
      locals: {
        log: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
      },
    } as any);
    const data = await response.json();

    expect(mockFetch).toHaveBeenCalledWith(
      expect.objectContaining({
        href:
          expect.stringContaining("https://nominatim.openstreetmap.org/reverse") &&
          expect.stringContaining("accept-language=cs"),
      }),
      expect.objectContaining({
        headers: {
          "User-Agent": expect.stringContaining("PhotoblogIsrael2022"),
        },
      }),
    );

    expect(data).toEqual({
      city: "Test City",
      state: "Test State",
      country: "Test Country",
      countryCode: "CZE", // Expect conversion to CZE
      location: "Test Suburb",
    });
  });

  it("should handle error from nominatim", async () => {
    const url = new URL("http://localhost/api/geocode?lat=10&lng=20");
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      statusText: "Bad Gateway",
    });

    try {
      await GET({
        url,
        fetch: mockFetch,
        locals: { log: { warn: vi.fn(), info: vi.fn(), error: vi.fn(), debug: vi.fn() } },
      } as any);
      expect.fail("Should have thrown");
    } catch (e: any) {
      expect(e.status).toBe(502);
      expect(e.body?.message).toContain("Bad Gateway");
    }
  });

  it("should prefer English name (Latin) fallback if Czech is missing, avoiding local script", async () => {
    const url = new URL("http://localhost/api/geocode?lat=31.7767&lng=35.2278");
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        // Simulation of Jaffa Gate in Jerusalem
        name: "שער יפו", // Hebrew default (local)
        namedetails: {
          name: "שער יפו",
          "name:he": "שער יפו",
          "name:en": "Jaffa Gate",
          // "name:cs": missing
        },
        address: {
          city: "Jerusalem",
          country_code: "il",
        },
      }),
    });

    const response = await GET({
      url,
      fetch: mockFetch,
      locals: {
        log: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
      },
    } as any);
    const data = await response.json();

    expect(data.location).toBe("Jaffa Gate");
  });
});
