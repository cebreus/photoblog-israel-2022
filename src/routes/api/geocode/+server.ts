import { error, json } from "@sveltejs/kit";
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
    nominatimUrl.searchParams.set("namedetails", "1");
    nominatimUrl.searchParams.set("accept-language", "cs");

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

    let countryCode = address.country_code ? address.country_code.toUpperCase() : undefined;

    if (countryCode && countryCode.length === 2) {
      const countryData = lookup.byIso(countryCode);
      if (countryData) {
        countryCode = countryData.iso3;
      }
    }

    const city = address.city || address.town || address.village || address.municipality;

    const locationNameCs = namedetails["name:cs"];
    const locationNameEn = namedetails["name:en"];

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
    if (err?.status && err?.body) {
      throw err;
    }
    console.error("Geocoding error:", err);
    throw error(500, "Failed to fetch geocoding data");
  }
}
