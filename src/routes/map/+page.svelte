<script lang="ts">
  import { PUBLIC_USE_LOCAL_TILES } from "$env/static/public";
  import type { MapManifest } from "$shared/types/map";
  import type { Fancybox } from "@fancyapps/ui";
  import type * as L from "leaflet";
  import { onMount } from "svelte";

  import LoadingOverlay from "$lib/components/ui/LoadingOverlay.svelte";
  import { createLogger } from "$lib/logger";

  import { browser } from "$app/environment";
  import { page } from "$app/state";

  const log = createLogger("map");

  // Eager import for SSR static build
  const mapGlob = import.meta.glob("$manifests/map.manifest.json", {
    eager: true,
    import: "default",
  });
  const mapManifest = Object.values(mapGlob)[0] as MapManifest | undefined;

  let mapContainer: HTMLDivElement;
  let isLoading = $state(false);
  let loadError = $state<string | null>(null);
  let activeLocationId = $state<string | null>(null);
  let hoveredLocationId = $state<string | null>(null);

  // Leaflet instances - top level so they're accessible everywhere
  let map: L.Map | null = null;
  let Leaflet: typeof L | null = null;
  let clusterGroup: L.MarkerClusterGroup | null = null;
  let markerMap = new Map<string, L.Marker>();
  let streetLayer: L.TileLayer | null = null;
  let satelliteLayer: L.TileLayer | null = null;

  /**
   * Get tile URL based on build configuration
   */
  function getTileUrl(type: "street" | "satellite"): string {
    if (PUBLIC_USE_LOCAL_TILES === "true") {
      return `/map-tiles-${type}/{z}/{x}/{y}.png`;
    }

    const cdnUrls = {
      street:
        "https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}",
      satellite:
        "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    };
    return cdnUrls[type];
  }

  // Handle location click from agenda (zoom to marker)
  function handleLocationClick(location: { id: string; lat: number; lng: number }) {
    if (!map || !mapManifest || !Leaflet) return;

    activeLocationId = location.id;

    // Get current map center and zoom
    const currentCenter = map.getCenter();
    const currentZoom = map.getZoom();
    const targetLatLng: [number, number] = [location.lat, location.lng];

    // Calculate distance between current center and target (in degrees)
    const distance = Math.sqrt(
      (currentCenter.lat - location.lat) ** 2 + (currentCenter.lng - location.lng) ** 2,
    );

    // Debug logging
    log.info(
      {
        from: { lat: currentCenter.lat, lng: currentCenter.lng },
        to: { lat: location.lat, lng: location.lng },
        distance: parseFloat(distance.toFixed(4)),
        currentZoom,
        targetId: location.id,
      },
      "Map navigation",
    );

    // Find marker - first try by ID, then by coordinates
    let marker = markerMap.get(location.id);

    // If not found by ID, find by matching coordinates
    if (!marker) {
      for (const [markerId, m] of markerMap.entries()) {
        const markerLatLng = m.getLatLng();
        if (
          Math.abs(markerLatLng.lat - location.lat) < 0.001 &&
          Math.abs(markerLatLng.lng - location.lng) < 0.001
        ) {
          marker = m;
          break;
        }
      }
    }

    // Skip animation for very close locations (< 0.005 degrees ≈ 500m)
    if (distance < 0.005) {
      // Just highlight the marker, no movement needed
      if (marker) highlightMarker(marker);
      return;
    }

    // Single smooth flyTo animation - duration scales with distance
    // Short distances: ~2s, Long distances: up to 5s for cinematic effect
    const duration = Math.max(2, Math.min(5, 1.5 + distance * 1.5));

    map.flyTo(targetLatLng, 15, {
      duration,
      easeLinearity: 0.25,
    });

    // Highlight marker after animation completes
    map.once("moveend", () => {
      if (marker) highlightMarker(marker);
    });
  }

  // Highlight marker with animation
  function highlightMarker(marker: L.Marker) {
    const icon = marker.getElement();
    if (!icon) return;

    icon.classList.add("marker-highlighted");

    const timeout = setTimeout(() => {
      icon.classList.remove("marker-highlighted");
      activeLocationId = null;
    }, 3000);
  }

  // Effect: Highlight active marker
  $effect(function highlightActiveMarker() {
    if (!activeLocationId) return;

    const marker = markerMap.get(activeLocationId);
    if (!marker) return;

    const icon = marker.getElement();
    if (!icon) return;

    icon.classList.add("marker-highlighted");

    const timeout = setTimeout(() => {
      icon.classList.remove("marker-highlighted");
      activeLocationId = null;
    }, 3000);

    return () => clearTimeout(timeout);
  });

  // Effect: Sync hover from timeline to map markers
  $effect(function syncTimelineHover() {
    if (!hoveredLocationId) {
      for (const marker of markerMap.values()) {
        marker.getElement()?.classList.remove("marker-hovered");
      }
    } else {
      const marker = markerMap.get(hoveredLocationId);
      marker?.getElement()?.classList.add("marker-hovered");
    }
  });

  // Zoom to day logic
  function zoomToDay(day: string) {
    if (!map || !mapManifest || !Leaflet) return;

    // Find locations present on this day
    const dayLocations = mapManifest.locations.filter((loc) => loc.days?.includes(day));

    if (dayLocations.length > 0) {
      if (dayLocations.length === 1) {
        handleLocationClick(dayLocations[0] as unknown as { id: string; lat: number; lng: number });
      } else {
        const bounds = Leaflet.latLngBounds(dayLocations.map((l) => [l.lat, l.lng]));
        if (map) {
          (map as L.Map).fitBounds(bounds, { padding: [50, 50], maxZoom: 15 });
        }

        // Highlight all markers for this day
        dayLocations.forEach((loc) => {
          const marker = markerMap.get(loc.id);
          if (marker) highlightMarker(marker);
        });
      }
    }
  }

  // Effect: Watch URL hash for day navigation (deep linking)
  $effect(() => {
    const hash = page.url.hash;
    if (hash?.startsWith("#day-") && map && mapManifest && Leaflet) {
      const day = hash.replace("#day-", "");
      zoomToDay(day);
    }
  });

  // Effect: Listen for agenda interactions (click mode)
  $effect(() => {
    const onZoomDay = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      zoomToDay(detail);
    };

    const onZoomToLocation = (e: Event) => {
      const { mapLocationId, lat, lng } = (e as CustomEvent).detail;
      if (lat && lng) {
        handleLocationClick({ id: mapLocationId, lat, lng });
      }
    };

    if (browser) {
      window.addEventListener("agenda:zoom-day", onZoomDay);
      window.addEventListener("agenda:zoom-to-map", onZoomToLocation);
    }
    return () => {
      if (browser) {
        window.removeEventListener("agenda:zoom-day", onZoomDay);
        window.removeEventListener("agenda:zoom-to-map", onZoomToLocation);
      }
    };
  });

  onMount(function handleMount() {
    if (!browser || !mapContainer || !mapManifest) {
      return;
    }

    let FancyboxInstance: typeof Fancybox | null = null;

    (async function initMap() {
      try {
        isLoading = true;
        log.info({ locationsCount: mapManifest.locations.length }, "Initializing map");

        // Load Leaflet core (default export)
        const leafletModule = await import("leaflet");
        const L = leafletModule.default;
        Leaflet = L;

        // Load styles
        await import("leaflet/dist/leaflet.css");

        // Load markercluster plugin as side-effect (it extends L automatically)
        await import("leaflet.markercluster");
        await import("leaflet.markercluster/dist/MarkerCluster.css");
        await import("leaflet.markercluster/dist/MarkerCluster.Default.css");

        // Load Fancybox
        const { Fancybox } = await import("@fancyapps/ui");
        FancyboxInstance = Fancybox; // Assign to local variable
        await import("@fancyapps/ui/dist/fancybox/fancybox.css");

        log.info({ step: "Creating map instance" }, "Libraries loaded");

        // Create map
        map = L.map(mapContainer).setView([0, 0], 2);

        // Base layers
        streetLayer = L.tileLayer(getTileUrl("street"), {
          attribution:
            "&copy; Esri &mdash; Source: Esri, DeLorme, NAVTEQ, USGS, Intermap, iPC, NRCAN, Esri Japan, METI, Esri China (Hong Kong), Esri (Thailand), TomTom, 2012",
          maxZoom: 19,
          keepBuffer: 2, // Retain loaded tiles for smoother animations
          updateWhenIdle: false, // Load tiles continuously during panning
        });

        satelliteLayer = L.tileLayer(getTileUrl("satellite"), {
          attribution:
            "&copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community",
          maxZoom: 16,
          keepBuffer: 2, // Retain loaded tiles for smoother animations
          updateWhenIdle: false, // Load tiles continuously during panning
        });

        // Add default layer (street)
        streetLayer.addTo(map);

        // Layer control
        const baseMaps = {
          Mapa: streetLayer,
          Satelit: satelliteLayer,
        };
        L.control.layers(baseMaps).addTo(map);

        log.info({ step: "Rendering markers" }, "Map instance created");

        // Create cluster group
        clusterGroup = L.markerClusterGroup({
          maxClusterRadius: 25,
          disableClusteringAtZoom: 15,
          spiderfyOnMaxZoom: true,
          showCoverageOnHover: false,
          zoomToBoundsOnClick: true,
        });

        const bounds: [number, number][] = [];

        // Add markers
        for (const location of mapManifest.locations) {
          bounds.push([location.lat, location.lng]);

          const icon = L.divIcon({
            className: "custom-marker-icon",
            html: `
              <div class="marker-wrapper">
                <img src="${location.thumbnail}" alt="${location.name}" />
                ${location.count > 1 ? `<span class="marker-count">${location.count}</span>` : ""}
              </div>
            `,
            iconSize: [60, 60],
            iconAnchor: [30, 30],
          });

          const marker = L.marker([location.lat, location.lng], { icon });

          // Track marker for programmatic access
          markerMap.set(location.id, marker);

          marker.on("click", function openGallery() {
            const galleryItems = location.images.map((img) => ({
              src: img.detail,
              thumb: img.thumb,
              caption: img.alt,
            }));
            if (FancyboxInstance) {
              FancyboxInstance.show(galleryItems);
            }
          });

          // Hover events for timeline sync
          marker.on("mouseover", function handleMarkerHover() {
            hoveredLocationId = location.id;
          });

          marker.on("mouseout", function handleMarkerUnhover() {
            hoveredLocationId = null;
          });

          clusterGroup.addLayer(marker);
        }

        map.addLayer(clusterGroup);

        if (bounds.length > 0) {
          map.invalidateSize();
          map.fitBounds(bounds, { padding: [50, 50] });
        }

        log.info({ markers: bounds.length }, "Map ready");
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        const errorStack = err instanceof Error ? err.stack : undefined;
        log.error(
          {
            error: errorMessage,
            stack: errorStack,
            errorType: err instanceof Error ? err.name : typeof err,
          },
          "Failed to initialize map",
        );
        loadError = "Failed to load map.";
      } finally {
        isLoading = false;
      }
    })();

    // Cleanup function
    return function cleanup() {
      if (map) {
        log.info({}, "Cleaning up map");
        map.remove();
        map = null;
        clusterGroup = null;
        FancyboxInstance = null;
      }
    };
  });
</script>

<svelte:head>
  <title>Map</title>
</svelte:head>

<div class="map-page-container">
  <LoadingOverlay visible={isLoading} label="Loading map..." />

  {#if loadError}
    <div class="error-message" data-testid="map-error">
      <p>Failed to load map data: {loadError}</p>
    </div>
  {/if}

  <div bind:this={mapContainer} class="map-container" data-testid="leaflet-map"></div>
</div>

<style>
  .map-page-container {
    position: relative;
    width: 100%;
    height: calc(100vh - 4rem); /* Subtract header height */
  }

  .map-container {
    width: 100%;
    height: 100%;
  }

  .error-message {
    position: absolute;
    top: 20px;
    left: 50%;
    transform: translateX(-50%);
    background: rgba(239, 68, 68, 0.95);
    color: white;
    padding: 1rem 2rem;
    border-radius: 0.5rem;
    z-index: 1001;
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.3);
  }

  :global(.custom-marker-icon) {
    background: none;
    border: none;
  }

  :global(.marker-wrapper) {
    position: relative;
    width: 60px;
    height: 60px;
    border-radius: 50%;

    border: 3px solid white;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
    cursor: pointer;
    transition: transform 0.2s ease;
  }

  :global(.marker-wrapper:hover) {
    transform: scale(1.1);
  }

  :global(.marker-wrapper img) {
    border-radius: 50%;
    width: 100% !important;
    height: 100%;
    object-fit: cover;
  }

  :global(.marker-count) {
    position: absolute;
    top: -8px;
    right: -8px;
    background: #ef4444;
    color: white;
    border-radius: 50%;
    width: 24px;
    height: 24px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 11px;
    font-weight: bold;
    border: 2px solid white;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
  }

  /* Darker Clustering styles */
  :global(.marker-cluster-small) {
    background-color: rgba(71, 85, 105, 0.45) !important;
  }
  :global(.marker-cluster-small div) {
    background-color: rgba(51, 65, 85, 0.9) !important;
    color: white !important;
  }

  :global(.marker-cluster-medium) {
    background-color: rgba(30, 41, 59, 0.45) !important;
  }
  :global(.marker-cluster-medium div) {
    background-color: rgba(15, 23, 42, 0.9) !important;
    color: white !important;
  }

  :global(.marker-cluster-large) {
    background-color: rgba(15, 23, 42, 0.45) !important;
  }
  :global(.marker-cluster-large div) {
    background-color: rgba(2, 6, 23, 0.9) !important;
    color: white !important;
  }

  :global(.marker-cluster span) {
    font-weight: 600;
  }

  /* Highlighted marker (from timeline click) */
  :global(.marker-highlighted .marker-wrapper) {
    border-color: #3b82f6 !important;
    border-width: 4px !important;
    transform: scale(1.15);
    box-shadow: 0 0 20px rgba(59, 130, 246, 0.8);
    z-index: 10000 !important;
    animation: pulse-highlight 1.5s ease-in-out 2;
  }

  @keyframes pulse-highlight {
    0%,
    100% {
      box-shadow: 0 0 20px rgba(59, 130, 246, 0.8);
      border-color: #3b82f6;
    }
    50% {
      box-shadow: 0 0 35px rgba(59, 130, 246, 1);
      border-color: #60a5fa;
    }
  }

  /* Hovered marker (from timeline hover) */
  :global(.marker-hovered .marker-wrapper) {
    border-color: #3b82f6;
    border-width: 3px;
    filter: brightness(1.2);
    z-index: 9999;
    animation: pulse-hover 1.5s ease-in-out infinite;
  }

  @keyframes pulse-hover {
    0%,
    100% {
      transform: scale(1);
    }
    50% {
      transform: scale(1.1);
    }
  }
</style>
