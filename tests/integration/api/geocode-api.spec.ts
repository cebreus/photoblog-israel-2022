/**
 * @fileoverview Geocoding API Integration Tests
 *
 * @description
 * Tests the geocoding integration with Nominatim (OpenStreetMap).
 * Verifies address parsing, country code conversion (ISO2 -> ISO3),
 * and Czech language preference.
 *
 * @modules-tested
 * - src/routes/api/geocode/+server.ts
 */

import { describe, expect, it, vi } from "vitest";
import { GET as geocodeGet } from "../../../src/routes/api/geocode/+server";

describe("Integration: Geocode API", () => {
  const createMockEvent = (params: Record<string, string>, mockFetch: any) =>
    ({
      url: new URL(`http://localhost/api/geocode?${new URLSearchParams(params)}`),
      fetch: mockFetch,
    }) as any;

  it("should correctly parse and map Nominatim response", async () => {
    // Mock successful response from Nominatim
    const mockNominatimResponse = {
      address: {
        city: "Tel Aviv-Jaffa",
        state: "Tel Aviv District",
        country: "Izrael",
        country_code: "il",
        suburb: "Neve Tzedek",
      },
      namedetails: {
        "name:cs": "Tel Aviv",
      },
      display_name: "Tel Aviv, Izrael",
    };

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockNominatimResponse,
    });

    const event = createMockEvent({ lat: "32.0853", lng: "34.7818" }, mockFetch);
    const res = await geocodeGet(event);
    const json = await res.json();

    // Verify mapping logic
    expect(json.city).toBe("Tel Aviv-Jaffa");
    expect(json.country).toBe("Izrael");
    expect(json.countryCode).toBe("ISR"); // il (ISO2) -> ISR (ISO3)
    expect(json.location).toBe("Tel Aviv"); // name:cs took priority
    expect(json.state).toBe("Tel Aviv District");

    // Check if fetch was called with correct params
    const calledUrl = new URL(mockFetch.mock.calls[0][0]);
    expect(calledUrl.searchParams.get("lat")).toBe("32.0853");
    expect(calledUrl.searchParams.get("lon")).toBe("34.7818");
    expect(calledUrl.searchParams.get("accept-language")).toBe("cs");
  });

  it("should return 400 if lat/lng are missing", async () => {
    const event = createMockEvent({}, vi.fn());

    try {
      await geocodeGet(event);
    } catch (e: any) {
      expect(e.status).toBe(400);
      expect(e.body.message).toContain("Missing 'lat' or 'lng'");
    }
  });

  it("should return 502 if Nominatim fails", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      statusText: "Bad Gateway",
    });

    const event = createMockEvent({ lat: "1", lng: "1" }, mockFetch);

    try {
      await geocodeGet(event);
    } catch (e: any) {
      expect(e.status).toBe(502);
    }
  });
});
