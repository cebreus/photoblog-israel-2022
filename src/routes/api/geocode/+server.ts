import { json, error } from "@sveltejs/kit";
import lookup from "country-code-lookup";

export async function GET({ url, fetch }) {
  const lat = url.searchParams.get("lat");
  const lng = url.searchParams.get("lng");

  if (!lat || !lng) {
    throw error(400, "Missing 'lat' or 'lng' parameters");
  }

  try {
    const nominatimUrl = new URL("https://nominatim.openstreetmap.org/reverse");
    nominatimUrl.searchParams.set("format", "json");
    nominatimUrl.searchParams.set("lat", lat);
    nominatimUrl.searchParams.set("lon", lng);
    nominatimUrl.searchParams.set("zoom", "18");
    nominatimUrl.searchParams.set("addressdetails", "1");
    nominatimUrl.searchParams.set("namedetails", "1"); // Request name details for better localization
    nominatimUrl.searchParams.set("accept-language", "cs");

    // Nominatim requires a User-Agent identifying the application
    const res = await fetch(nominatimUrl, {
      headers: {
        "User-Agent": "PhotoblogIsrael2022/1.0 (internal dev tool)",
      },
    });

    if (!res.ok) {
      throw error(502, `Nominatim API error: ${res.statusText}`);
    }

    const data = await res.json();
    const address = data.address || {};
    const namedetails = data.namedetails || {};

    let countryCode = address.country_code
      ? address.country_code.toUpperCase()
      : undefined;

    // Convert to ISO 3166-1 alpha-3 if possible
    if (countryCode && countryCode.length === 2) {
      const countryData = lookup.byIso(countryCode);
      if (countryData) {
        countryCode = countryData.iso3;
      }
    }

    // Map fields
    const city =
      address.city || address.town || address.village || address.municipality;

    // Try to find a Czech name for the specific location if available in namedetails
    // This often helps with "location" (sublocation) field if the result is a specific POI
    const locationNameCs = namedetails["name:cs"];
    const locationNameEn = namedetails["name:en"]; // Fallback to English/Latin

    const locationName =
      locationNameCs ||
      locationNameEn ||
      data.name ||
      address.suburb ||
      address.neighbourhood ||
      address.tourism ||
      address.road;

    const mapped = {
      city: city,
      state: address.state,
      country: address.country,
      countryCode: countryCode,
      location: locationName,
    };

    return json(mapped);
  } catch (err: any) {
    // Re-throw SvelteKit errors
    if (err?.status && err?.body) {
      throw err;
    }
    console.error("Geocoding error:", err);
    throw error(500, "Failed to fetch geocoding data");
  }
}
