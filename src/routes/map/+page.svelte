<script lang="ts">
  import type { MapManifest } from "$shared/types/map";
  import type { Fancybox } from "@fancyapps/ui";
  import type * as L from "leaflet";
  import { onMount } from "svelte";

  import LoadingOverlay from "$lib/components/ui/LoadingOverlay.svelte";
  import { createLogger } from "$lib/logger";

  import { browser } from "$app/environment";

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

  onMount(function handleMount() {
    if (!browser || !mapContainer || !mapManifest) {
      return;
    }

    let map: L.Map | null = null;
    let clusterGroup: L.MarkerClusterGroup | null = null;
    let FancyboxInstance: typeof Fancybox | null = null; // Store Fancybox instance locally

    (async function initMap() {
      try {
        isLoading = true;
        log.info({ locationsCount: mapManifest.locations.length }, "Initializing map");

        // Load Leaflet core (default export)
        const leafletModule = await import("leaflet");
        const L = leafletModule.default;

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

        L.tileLayer("https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png", {
          attribution: "&copy; OpenStreetMap contributors &copy; CARTO",
          maxZoom: 20,
        }).addTo(map);

        log.info({ step: "Rendering markers" }, "Map instance created");

        // Create cluster group
        clusterGroup = L.markerClusterGroup({
          maxClusterRadius: 35,
          disableClusteringAtZoom: 16,
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
</style>
