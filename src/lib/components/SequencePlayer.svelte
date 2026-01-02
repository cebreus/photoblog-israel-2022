<script lang="ts">
  import Pause from "@lucide/svelte/icons/pause";
  import Play from "@lucide/svelte/icons/play";
  import { untrack } from "svelte";
  import { Button } from "$lib/components/ui/button";
  import type { ImageEntry, SequenceInfo } from "$lib/types/manifest";
  import { SEQUENCE_MESSAGES } from "$lib/utils/messages";
  import {
    DEFAULT_FRAME_DELAY_MS,
    PANO_PROGRESS_MAX,
    PANO_PROGRESS_MIN,
    PANO_START_DELAY_MS,
    PANO_STEP_PER_TICK,
    PANO_UPDATE_INTERVAL_MS,
    SEQUENCE_PLAYBACK_CONFIG,
  } from "$shared/constants/sequences";

  let {
    images,
    sequenceInfo,
    autoplay = true,
    loop = true,
  }: {
    images: ImageEntry[];
    sequenceInfo: SequenceInfo;
    autoplay?: boolean;
    loop?: boolean;
  } = $props();

  let currentIndex = $state(0);
  let isPlaying = $state(untrack(() => autoplay));
  let panoProgress = $state(0);
  let scrollDirection = $state<1 | -1>(1);
  let delayCompleted = $state(false);

  let sequenceTimer: ReturnType<typeof setInterval> | null = null;
  let panoTimer: ReturnType<typeof setInterval> | null = null;
  let startDelayTimer: ReturnType<typeof setTimeout> | null = null;

  const isPano = $derived(sequenceInfo.type === "pano");
  const isZoom = $derived(sequenceInfo.type === "zoom");

  const frameDelay = $derived(
    SEQUENCE_PLAYBACK_CONFIG[sequenceInfo.type]?.delay ?? DEFAULT_FRAME_DELAY_MS,
  );

  const typeLabel = $derived.by(function getTypeLabel(): string {
    const labels: Record<string, string> = {
      pano: SEQUENCE_MESSAGES.TYPE_PANORAMA,
      zoom: SEQUENCE_MESSAGES.TYPE_ZOOM,
      timelapse: SEQUENCE_MESSAGES.TYPE_TIMELAPSE,
      "focus-stack": SEQUENCE_MESSAGES.TYPE_FOCUS_STACK,
      pan: SEQUENCE_MESSAGES.TYPE_PAN,
      burst: SEQUENCE_MESSAGES.TYPE_BURST,
    };
    return labels[sequenceInfo.type] ?? SEQUENCE_MESSAGES.TYPE_SEQUENCE;
  });

  function advanceFrame(): void {
    if (currentIndex < images.length - 1) {
      currentIndex++;
      return;
    }

    if (loop) {
      currentIndex = 0;
    } else {
      isPlaying = false;
    }
  }

  function updatePanoPosition(): void {
    const step = PANO_STEP_PER_TICK * scrollDirection;
    const nextValue = Math.max(PANO_PROGRESS_MIN, Math.min(PANO_PROGRESS_MAX, panoProgress + step));

    panoProgress = nextValue;

    const hitBoundary = nextValue >= PANO_PROGRESS_MAX || nextValue <= PANO_PROGRESS_MIN;
    if (!hitBoundary) return;

    if (loop) {
      scrollDirection = (scrollDirection * -1) as 1 | -1;
    } else {
      isPlaying = false;
    }
  }

  function onPanoDelayComplete(): void {
    delayCompleted = true;
    startDelayTimer = null;
    if (isPlaying) {
      panoTimer = setInterval(updatePanoPosition, PANO_UPDATE_INTERVAL_MS);
    }
  }

  function clearAllTimers(): void {
    if (sequenceTimer) clearInterval(sequenceTimer);
    if (panoTimer) clearInterval(panoTimer);
    if (startDelayTimer) clearTimeout(startDelayTimer);
    sequenceTimer = null;
    panoTimer = null;
    startDelayTimer = null;
  }

  function startPanoPlayback(): void {
    if (panoTimer || startDelayTimer) return;

    if (!delayCompleted) {
      startDelayTimer = setTimeout(onPanoDelayComplete, PANO_START_DELAY_MS);
      return;
    }

    panoTimer = setInterval(updatePanoPosition, PANO_UPDATE_INTERVAL_MS);
  }

  function startSequencePlayback(): void {
    if (sequenceTimer) return;
    sequenceTimer = setInterval(advanceFrame, frameDelay);
  }

  function startPlayback(): void {
    if (isPano) {
      startPanoPlayback();
    } else {
      startSequencePlayback();
    }
  }

  function togglePlay(): void {
    isPlaying = !isPlaying;
  }

  function handleScrub(event: Event): void {
    const target = event.target as HTMLInputElement;
    const value = parseFloat(target.value);

    if (isPano) {
      panoProgress = value;
    } else {
      currentIndex = Math.round(value);
    }
    isPlaying = false;
  }

  $effect(function managePlayback() {
    if (isPlaying) {
      startPlayback();
    } else {
      clearAllTimers();
    }

    return clearAllTimers;
  });

  $effect(function preloadNextFrame() {
    if (images.length <= 1 || isPano) return;

    const nextIdx = (currentIndex + 1) % images.length;
    const img = new Image();
    const src =
      images[nextIdx].sources.find((s) => s.variant === "detail") || images[nextIdx].sources[0];
    img.src = src.path;
  });
</script>

<div class="sequence-player" class:is-pano={isPano} class:zoom-mode={isZoom}>
  <div class="image-stack">
    {#if isPano && images.length > 0}
      {@const src =
        images[0].sources.find((s) => s.variant === "pano_detail") ||
        images[0].sources.find((s) => s.variant === "detail") ||
        images[0].sources[0]}
      <div class="pano-container">
        <img
          src={src.path}
          alt={images[0].alt || "Panorama"}
          class="pano-image"
          style:transform={`translateX(calc(${panoProgress / 100} * (100vw - 100%)))`}
        />
      </div>
    {:else}
      {#each images as img, i}
        {@const src = img.sources.find((s) => s.variant === "detail") || img.sources[0]}
        <img
          src={src.path}
          alt={img.alt || `Snímek ${i + 1}`}
          class="frame"
          class:active={i === currentIndex}
        />
      {/each}
    {/if}
  </div>

  <div class="controls-panel">
    <div class="controls-inner">
      <Button
        variant="ghost"
        size="icon-sm"
        onclick={togglePlay}
        aria-label={isPlaying ? "Pause" : "Play"}
        class="text-white hover:bg-white/20"
      >
        {#if isPlaying}
          <Pause size={20} />
        {:else}
          <Play size={20} />
        {/if}
      </Button>

      <div class="scrubber-wrapper">
        <input
          type="range"
          class="scrubber sequence-scrubber"
          min="0"
          max={isPano ? 100 : images.length - 1}
          step={isPano ? 0.1 : 1}
          value={isPano ? panoProgress : currentIndex}
          oninput={handleScrub}
        />

        <div
          class="progress-fill"
          style:width={`${
            isPano ? panoProgress : (currentIndex / Math.max(1, images.length - 1)) * 100
          }%`}
        ></div>
      </div>

      {#if !isPano}
        <div class="frame-info">
          <span class="counter">{currentIndex + 1}/{images.length}</span>
        </div>
      {/if}

      <div class="frame-info ml-auto">
        <span class="type-badge">{typeLabel}</span>
      </div>
    </div>
  </div>
</div>

<style>
  .sequence-player {
    position: relative;
    width: 100%;
    height: 100%;
    background: #000;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .sequence-player.zoom-mode .frame {
    transition: opacity 1s ease-in-out;
  }

  .image-stack {
    flex: 1;
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
    width: 100%;
    height: 100%;
  }

  .frame {
    position: absolute;
    max-width: 100%;
    max-height: 100%;
    object-fit: contain;
    opacity: 0;
    transition: opacity 0.5s ease-in-out;
    will-change: opacity;
  }

  .frame.active {
    opacity: 1;
    z-index: 1;
  }

  .pano-container {
    width: 100%;
    height: 100%;
    overflow: hidden;
    position: relative;
  }

  .pano-image {
    height: 100%;
    width: auto;
    max-width: none;
    position: absolute;
    left: 0;
    top: 0;
    will-change: transform;
  }

  .controls-panel {
    position: absolute;
    bottom: 1.5rem;
    left: 50%;
    transform: translateX(-50%);
    width: calc(100% - 3rem);
    max-width: 500px;
    z-index: 10;
  }

  .controls-inner {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.75rem 1rem;
    background: hsl(var(--background) / 0.8);
    backdrop-filter: blur(12px);
    border: 1px solid hsl(var(--border));
    border-radius: var(--radius);
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
  }

  .scrubber-wrapper {
    flex: 1;
    position: relative;
    height: 20px;
    display: flex;
    align-items: center;
  }

  .scrubber {
    width: 100%;
    height: 6px;
    appearance: none;
    background: hsl(var(--muted));
    border-radius: 3px;
    cursor: pointer;
    position: relative;
    z-index: 2;
  }

  .scrubber::-webkit-slider-thumb {
    appearance: none;
    width: 14px;
    height: 14px;
    background: hsl(var(--primary));
    border-radius: 50%;
    cursor: grab;
    border: 2px solid white;
    box-shadow: 0 1px 4px rgba(0, 0, 0, 0.3);
  }

  .progress-fill {
    position: absolute;
    left: 0;
    top: 50%;
    transform: translateY(-50%);
    height: 6px;
    background: hsl(var(--primary));
    border-radius: 3px 0 0 3px;
    pointer-events: none;
    z-index: 1;
  }

  .frame-info {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.75rem;
    color: hsl(var(--muted-foreground));
    white-space: nowrap;
  }

  .type-badge {
    padding: 0.125rem 0.375rem;
    background: hsl(var(--primary) / 0.15);
    color: hsl(var(--primary));
    border-radius: calc(var(--radius) - 2px);
    font-weight: 500;
    font-size: 0.625rem;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .ml-auto {
    margin-left: auto;
  }

  @media (max-width: 640px) {
    .controls-panel {
      bottom: 1rem;
      width: calc(100% - 2rem);
    }
  }
</style>
