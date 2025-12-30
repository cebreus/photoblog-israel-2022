/**
 * Fancybox integration with support for sequence playback.
 * Mounts SequencePlayer component into lightbox slides for special media types.
 */

import { mount, unmount } from "svelte";
import SequencePlayer from "$lib/components/SequencePlayer.svelte";
import type { ImageEntry } from "$lib/types/manifest";
import { getPhotoDays } from "$lib/utils/images";
import { getSequenceMembers, isSequenceMember, parseSequenceSuffix } from "$lib/utils/sequences";

/** Slide object from Fancybox carousel - extended with our custom properties */
interface FancyboxSlide {
  triggerEl?: HTMLElement;
  $trigger?: HTMLElement;
  el?: HTMLElement;
  type?: string;
  html?: string;
  _imageId?: string;
  _player?: ReturnType<typeof mount> | null;
}

/** Carousel object from Fancybox */
interface FancyboxCarousel {
  slides?: FancyboxSlide[];
  page?: number;
}

/** Main Fancybox instance */
interface FancyboxInstance {
  Carousel?: FancyboxCarousel;
}

/** Static Fancybox API */
interface FancyboxStatic {
  bind: (container: HTMLElement, selector: string, options: Record<string, unknown>) => () => void;
  destroy: () => void;
}

let cachedImages: ImageEntry[] | null = null;

function getAllImages(): ImageEntry[] {
  if (cachedImages) return cachedImages;

  const photoDays = getPhotoDays();
  const allImages: ImageEntry[] = [];

  for (const day of photoDays) {
    for (const item of day.items) {
      if (item.type !== "separator") {
        allImages.push(item);
      }
    }
  }

  cachedImages = allImages;
  return allImages;
}

function invalidateImageCache(): void {
  cachedImages = null;
}

function cleanupSlidePlayer(slide: FancyboxSlide): void {
  if (!slide._player) return;

  unmount(slide._player);
  slide._player = null;
}

function getImageIdFromTrigger(slide: FancyboxSlide): string | null {
  const triggerEl = slide.triggerEl || slide.$trigger;
  if (!triggerEl) return null;

  return triggerEl.dataset.imageId || triggerEl.getAttribute("data-image-id");
}

/**
 * Lookup an image entry by ID from the cached images.
 */
function getImageEntry(imageId: string): ImageEntry | null {
  const allImages = getAllImages();
  return allImages.find((img) => img.id === imageId) ?? null;
}

/**
 * Determine if the image should use SequencePlayer.
 * True for: sequences, panoramas, or 360 content.
 */
function shouldUseSequencePlayer(imageId: string): boolean {
  const image = getImageEntry(imageId);
  if (!image) return false;

  // Check suffix-based sequences
  if (isSequenceMember(imageId)) return true;

  // Check special media (panoramas, 360)
  if (image.specialMedia) return true;

  return false;
}

/**
 * Create the appropriate player component for a special media type.
 * Handles both suffix-based sequences (using members from manifest) and aspectRatio-based panoramas.
 */
function createSequencePlayer(imageId: string, host: HTMLElement): ReturnType<typeof mount> | null {
  const image = getImageEntry(imageId);
  if (!image) return null;

  let sequenceInfo = image.sequenceInfo || parseSequenceSuffix(imageId);
  let sequenceMembers: ImageEntry[] = [];

  if (sequenceInfo) {
    // Use members from manifest if available (handles different timestamps correctly)
    if (sequenceInfo.members && sequenceInfo.members.length > 0) {
      const allImages = getAllImages();
      const memberIds = new Set(sequenceInfo.members);
      sequenceMembers = allImages.filter((img) => memberIds.has(img.id));
      // Sort by sequence index
      sequenceMembers.sort((a, b) => {
        const aInfo = a.sequenceInfo || parseSequenceSuffix(a.id);
        const bInfo = b.sequenceInfo || parseSequenceSuffix(b.id);
        return (aInfo?.index ?? 0) - (bInfo?.index ?? 0);
      });
    } else {
      // Fallback to baseId matching (for same-timestamp sequences)
      const allImages = getAllImages();
      sequenceMembers = getSequenceMembers(allImages, sequenceInfo.baseId);
    }

    if (sequenceMembers.length === 0) return null;
  } else if (image.specialMedia?.isPanorama) {
    // Panorama / 360: single image with synthetic SequenceInfo
    sequenceInfo = {
      type: "pano",
      index: 1,
      total: 1,
      baseId: imageId,
    };
    sequenceMembers = [image];
  } else {
    return null;
  }

  try {
    return mount(SequencePlayer, {
      target: host,
      props: {
        images: sequenceMembers,
        sequenceInfo,
        autoplay: true,
        loop: true,
      },
    });
  } catch {
    return null;
  }
}

function mountSequencePlayerIntoSlide(slide: FancyboxSlide): void {
  const imageId = slide._imageId;
  if (!imageId) return;
  if (slide._player) return;

  const playerHost = slide.el?.querySelector(".sequence-player-host") as HTMLElement | null;
  if (!playerHost) return;

  slide._player = createSequencePlayer(imageId, playerHost);
}

function handleCreateSlide(
  _fancybox: FancyboxInstance,
  _carousel: FancyboxCarousel,
  slide: FancyboxSlide,
): void {
  const imageId = getImageIdFromTrigger(slide);
  if (!imageId || !shouldUseSequencePlayer(imageId)) return;

  slide.type = "html";
  slide.html = `<div class="sequence-player-host" style="width:100%; height:100%; display:flex; flex-direction:column; background:black;"></div>`;
  slide._imageId = imageId;
}

function handleAttachSlideEl(
  _fancybox: FancyboxInstance,
  _carousel: FancyboxCarousel,
  slide: FancyboxSlide,
): void {
  if (!slide._imageId) return;
  mountSequencePlayerIntoSlide(slide);
}

function handleCarouselReady(fancybox: FancyboxInstance): void {
  const carousel = fancybox.Carousel;
  if (!carousel?.slides) return;

  for (const slide of carousel.slides) {
    if (slide._imageId) {
      mountSequencePlayerIntoSlide(slide);
    }
  }
}

function handleCarouselChange(_fancybox: FancyboxInstance, carousel: FancyboxCarousel): void {
  if (!carousel?.slides || carousel.page === undefined) return;

  const slide = carousel.slides[carousel.page];
  if (!slide?._imageId) return;

  mountSequencePlayerIntoSlide(slide);
}

function handleCarouselDestroy(_fancybox: FancyboxInstance, carousel: FancyboxCarousel): void {
  if (!carousel?.slides) return;

  for (const slide of carousel.slides) {
    cleanupSlidePlayer(slide);
  }

  invalidateImageCache();
}

const DEFAULT_OPTIONS = {
  Hash: false, // Disable hash plugin to avoid conflicts with SvelteKit router
  Carousel: {
    Thumbs: {
      showOnStart: false,
    },
  },
  on: {
    "Carousel.createSlide": handleCreateSlide,
    "Carousel.attachSlideEl": handleAttachSlideEl,
    "Carousel.ready": handleCarouselReady,
    "Carousel.change": handleCarouselChange,
    "Carousel.destroy": handleCarouselDestroy,
  },
};

export function useFancybox(
  node: HTMLElement,
  {
    selector = "[data-fancybox]",
    options = {},
  }: { selector?: string; options?: Partial<Record<string, unknown>> } = {},
) {
  let unbind: (() => void) | undefined;
  let fancyboxInstance: FancyboxStatic | undefined;

  async function initializeFancybox(): Promise<void> {
    if (typeof window === "undefined") return;

    const { Fancybox } = await import("@fancyapps/ui");
    await import("@fancyapps/ui/dist/fancybox/fancybox.css");

    fancyboxInstance = Fancybox as unknown as FancyboxStatic;

    const mergedOptions = {
      ...DEFAULT_OPTIONS,
      ...options,
      on: {
        ...DEFAULT_OPTIONS.on,
        ...(options.on as Record<string, unknown>),
      },
    };

    unbind = fancyboxInstance.bind(node, selector, mergedOptions);
    node.setAttribute("data-fancybox-initialized", "true");
  }

  initializeFancybox();

  return {
    destroy() {
      unbind?.();
      invalidateImageCache();
    },
  };
}
