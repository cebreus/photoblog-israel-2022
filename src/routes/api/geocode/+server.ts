import { error, json, type RequestEvent } from "@sveltejs/kit";
import lookup from "country-code-lookup";
import { dev } from "$app/environment";

export async function GET({ url, fetch, locals }: RequestEvent) {
  // We don't really need logging for this check in dev, but let's be consistent
  if (!dev) {
    // Only log if something unexpected happens. Here it's expected.
    return json({ error: "Geocoding proxy is restricted to DEV mode." }, { status: 403 });
  }

  const { log } = locals;
  const lat = url.searchParams.get("lat");
  const lng = url.searchParams.get("lng");

  if (!lat || !lng) {
    log.warn({ lat, lng }, "Missing coordinates parameters");
    // Returning error JSON better for API clients than throwing HTML error page
    return json({ error: "Missing 'lat' or 'lng' parameters" }, { status: 400 });
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

    // Log external call start
    log.debug({ lat, lng }, "Calling Nominatim API");

    const res = await fetch(nominatimUrl, {
      headers: {
        "User-Agent": "PhotoblogIsrael2022/1.0 (internal dev tool)",
      },
    });

    if (!res.ok) {
      log.error({ status: res.status, statusText: res.statusText }, "Nominatim API error");
      // Use standard SvelteKit error for upstream failure
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

    log.info({ query: { lat, lng }, result: mapped }, "Geocoding successful");
    return json(mapped);
  } catch (err: unknown) {
    const typedError = err as { status?: number; body?: unknown };
    // If it's already a SvelteKit error, rethrow it
    if (typedError?.status && typedError?.body) {
      throw typedError;
    }

    // Log unexpected error
    log.error({ err }, "Geocoding failed");
    throw error(500, "Failed to fetch geocoding data");
  }
}
