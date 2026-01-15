<script lang="ts">
  import { PUBLIC_USE_LOCAL_TILES } from "$env/static/public";
  import type { MapManifest } from "$shared/types/map";
  import type { Fancybox } from "@fancyapps/ui";
  import type * as L from "leaflet";
  import { onMount } from "svelte";

  import LoadingOverlay from "$lib/components/ui/LoadingOverlay.svelte";
  import { createLogger } from "$lib/logger";
  import { agendaMapSync } from "$lib/stores/agenda-map-sync.svelte";

  import { browser } from "$app/environment";
  import { page } from "$app/state";

  // Map constants (inline - used only in this component)
  /** Distance threshold in degrees (~500m) below which we skip animation */
  const SHORT_DISTANCE_THRESHOLD = 0.005;
  /** Coordinate matching tolerance in degrees (~100m) */
  const COORDINATE_MATCH_TOLERANCE = 0.001;
  /** How long marker stays highlighted after click (ms) */
  const MARKER_HIGHLIGHT_DURATION_MS = 3000;
  /** Target zoom level when flying to a location */
  const FLY_TO_ZOOM_LEVEL = 15;
  /** Animation duration bounds */
  const ANIMATION_MIN_DURATION_S = 2;
  const ANIMATION_MAX_DURATION_S = 5;
  /** Animation ease linearity (Leaflet config) */
  const ANIMATION_EASE_LINEARITY = 0.25;
  /** Distance scale multiplier for animation duration */
  const ANIMATION_DISTANCE_SCALE = 1.5;
  /** Cluster group configuration */
  const CLUSTER_MAX_RADIUS = 25;
  const CLUSTER_DISABLE_AT_ZOOM = 15;
  /** Marker icon dimensions */
  const MARKER_ICON_SIZE = 60;
  const MARKER_ICON_ANCHOR = 30;
  /** Map bounds padding for fitBounds operations */
  const MAP_BOUNDS_PADDING: [number, number] = [50, 50];
  /** Default map center before fitBounds */
  const DEFAULT_MAP_CENTER: [number, number] = [0, 0];
  /** Default map zoom level on init */
  const DEFAULT_MAP_ZOOM = 2;
  /** Tile layer max zoom levels */
  const TILE_MAX_ZOOM_STREET = 19;
  const TILE_MAX_ZOOM_SATELLITE = 16;
  /** Tile buffer for smoother animations (Leaflet config) */
  const TILE_KEEP_BUFFER = 2;
  /** Coordinate precision for display */
  const COORD_DISPLAY_PRECISION = 4;
  /** Tile layer attributions */
  const STREET_LAYER_ATTRIBUTION =
    "&copy; Esri &mdash; Source: Esri, DeLorme, NAVTEQ, USGS, Intermap, iPC, NRCAN, Esri Japan, METI, Esri China (Hong Kong), Esri (Thailand), TomTom, 2012";
  const SATELLITE_LAYER_ATTRIBUTION =
    "&copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community";

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
  let hoveredLocationId = $state<string | null>(null);

  // Leaflet instances - top level so they're accessible everywhere
  let map: L.Map | null = null;
  let Leaflet: typeof L | null = null;
  let clusterGroup: L.MarkerClusterGroup | null = null;
  let markersByLocationId = new Map<string, L.Marker>();
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

  // Fly to location from agenda (zoom to marker with animation)
  function flyToLocation(location: { id: string; lat: number; lng: number }) {
    if (!map || !mapManifest || !Leaflet) return;

    // Get current map center
    const currentCenter = map.getCenter();
    const targetLatLng: [number, number] = [location.lat, location.lng];

    // Calculate distance between current center and target (in degrees)
    const distance = Math.sqrt(
      (currentCenter.lat - location.lat) ** 2 + (currentCenter.lng - location.lng) ** 2,
    );

    // Find marker by ID or coordinates
    const marker = findMarkerByIdOrCoords(location.id);

    // Skip animation for very close locations
    if (distance < SHORT_DISTANCE_THRESHOLD) {
      // Just highlight the marker, no movement needed
      if (marker) highlightMarker(marker);
      updateVisibleLocations();
      return;
    }

    // Single smooth flyTo animation - duration scales with distance
    const duration = Math.max(
      ANIMATION_MIN_DURATION_S,
      Math.min(
        ANIMATION_MAX_DURATION_S,
        ANIMATION_DISTANCE_SCALE + distance * ANIMATION_DISTANCE_SCALE,
      ),
    );

    map.flyTo(targetLatLng, FLY_TO_ZOOM_LEVEL, {
      duration,
      easeLinearity: ANIMATION_EASE_LINEARITY,
    });

    // Highlight marker after animation completes
    map.once("moveend", function handleMoveEnd() {
      if (marker) highlightMarker(marker);
      updateVisibleLocations();
    });
  }

  /**
   * Update the set of visible menu locations in the synchronization store
   * based on the current map viewport.
   */
  function updateVisibleLocations() {
    if (!map) return;

    const bounds = map.getBounds();
    const visibleIds = new Set<string>();

    for (const [id, marker] of markersByLocationId.entries()) {
      if (bounds.contains(marker.getLatLng())) {
        visibleIds.add(id);

        // Also add coordinate-based ID for better matching with menu manifest
        // Same logic as in map-manifest-builder to ensure consistency
        const latLng = marker.getLatLng();
        const coordId = `${latLng.lat.toFixed(COORD_DISPLAY_PRECISION)},${latLng.lng.toFixed(COORD_DISPLAY_PRECISION)}`;
        visibleIds.add(coordId);
      }
    }

    agendaMapSync.setVisibleMenuLocations(visibleIds);
  }

  // Highlight marker with animation
  function highlightMarker(marker: L.Marker) {
    const icon = marker.getElement();
    if (!icon) return;

    icon.classList.add("marker-highlighted");

    const timeout = setTimeout(function removeHighlight() {
      icon.classList.remove("marker-highlighted");
      // Don't set activeLocationId = null here - it conflicts with $effect
    }, MARKER_HIGHLIGHT_DURATION_MS);
  }

  /**
   * Find a marker by ID or coordinate string
   */
  function findMarkerByIdOrCoords(idOrCoords: string): L.Marker | undefined {
    // 1. Direct ID match
    let marker = markersByLocationId.get(idOrCoords);
    if (marker) return marker;

    // 2. Fuzzy match by coordinates
    const parts = idOrCoords.split(",");
    if (parts.length === 2) {
      const lat = Number.parseFloat(parts[0]);
      const lng = Number.parseFloat(parts[1]);
      if (!Number.isNaN(lat) && !Number.isNaN(lng)) {
        for (const m of markersByLocationId.values()) {
          const ml = m.getLatLng();
          if (
            Math.abs(ml.lat - lat) < COORDINATE_MATCH_TOLERANCE &&
            Math.abs(ml.lng - lng) < COORDINATE_MATCH_TOLERANCE
          ) {
            return m;
          }
        }
      }
    }
    return undefined;
  }

  // Effect: Sync hover from timeline to map markers
  $effect(function syncTimelineHover() {
    const hoveredId = agendaMapSync.hoveredMapLocationId;

    // Clean up all hover states first
    for (const marker of markersByLocationId.values()) {
      marker.getElement()?.classList.remove("marker-hovered");
    }

    if (hoveredId) {
      const marker = findMarkerByIdOrCoords(hoveredId);
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
        flyToLocation(dayLocations[0] as unknown as { id: string; lat: number; lng: number });
      } else {
        const bounds = Leaflet.latLngBounds(dayLocations.map((l) => [l.lat, l.lng]));
        if (map) {
          (map as L.Map).fitBounds(bounds, {
            padding: MAP_BOUNDS_PADDING,
            maxZoom: FLY_TO_ZOOM_LEVEL,
          });
        }

        // Highlight all markers for this day
        dayLocations.forEach((loc) => {
          const marker = findMarkerByIdOrCoords(loc.id);
          if (marker) highlightMarker(marker);
        });
      }
    }
  }

  // Effect: Watch URL hash for day navigation (deep linking)
  $effect(function syncUrlHashNavigation() {
    const hash = page.url.hash;
    if (hash?.startsWith("#day-") && map && mapManifest && Leaflet) {
      const day = hash.replace("#day-", "");
      zoomToDay(day);
    }
  });

  // Effect: Listen for agenda interactions (click mode)
  $effect(function setupAgendaEventListeners() {
    const onZoomDay = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      zoomToDay(detail);
    };

    const onZoomToLocation = (e: Event) => {
      const { mapLocationId, lat, lng } = (e as CustomEvent).detail;
      if (lat && lng) {
        flyToLocation({ id: mapLocationId, lat, lng });
      }
    };

    if (browser) {
      window.addEventListener("agenda:zoom-day", onZoomDay);
      window.addEventListener("agenda:zoom-to-map", onZoomToLocation);
    }
    return function cleanup() {
      if (browser) {
        window.removeEventListener("agenda:zoom-day", onZoomDay);
        window.removeEventListener("agenda:zoom-to-map", onZoomToLocation);
      }
    };
  });

  /**
   * Initialize map logic
   */
  async function initializeMap() {
    if (!mapContainer || !mapManifest) return;

    let FancyboxInstance: typeof Fancybox | null = null;

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
      map = L.map(mapContainer).setView(DEFAULT_MAP_CENTER, DEFAULT_MAP_ZOOM);

      // Base layers
      streetLayer = L.tileLayer(getTileUrl("street"), {
        attribution: STREET_LAYER_ATTRIBUTION,
        maxZoom: TILE_MAX_ZOOM_STREET,
        keepBuffer: TILE_KEEP_BUFFER, // Retain loaded tiles for smoother animations
        updateWhenIdle: false, // Load tiles continuously during panning
      });

      satelliteLayer = L.tileLayer(getTileUrl("satellite"), {
        attribution: SATELLITE_LAYER_ATTRIBUTION,
        maxZoom: TILE_MAX_ZOOM_SATELLITE,
        keepBuffer: TILE_KEEP_BUFFER, // Retain loaded tiles for smoother animations
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
        maxClusterRadius: CLUSTER_MAX_RADIUS,
        disableClusteringAtZoom: CLUSTER_DISABLE_AT_ZOOM,
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
          iconSize: [MARKER_ICON_SIZE, MARKER_ICON_SIZE],
          iconAnchor: [MARKER_ICON_ANCHOR, MARKER_ICON_ANCHOR],
        });

        const marker = L.marker([location.lat, location.lng], { icon });

        // Track marker for programmatic access
        markersByLocationId.set(location.id, marker);

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
        map.fitBounds(bounds, { padding: MAP_BOUNDS_PADDING });
      }

      // Initialize visible locations
      updateVisibleLocations();

      // Listen for map movements to update sidebar highlights
      map.on("moveend", updateVisibleLocations);
      map.on("zoomend", updateVisibleLocations);

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
  }

  /**
   * Cleanup map instance
   */
  function destroyMap() {
    if (map) {
      log.info({}, "Cleaning up map");
      map.remove();
      map = null;
      clusterGroup = null;
    }
  }

  onMount(function handleMount() {
    if (!browser) return;

    initializeMap();

    return destroyMap;
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
