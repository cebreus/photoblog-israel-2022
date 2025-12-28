/**
 * Fancybox integration with support for sequence playback.
 * Mounts SequencePlayer component into lightbox slides for special media types.
 */

import { mount, unmount } from "svelte";
import SequencePlayer from "$lib/components/SequencePlayer.svelte";
import type { ImageEntry } from "$lib/types/manifest";
import { getPhotoDays } from "$lib/utils/images";
import { getSequenceMembers, parseSequenceSuffix } from "$lib/utils/sequences";

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

function isSequenceImage(imageId: string | null): boolean {
  return imageId?.includes("--") ?? false;
}

function createSequencePlayer(imageId: string, host: HTMLElement): ReturnType<typeof mount> | null {
  const sequenceInfo = parseSequenceSuffix(imageId);
  if (!sequenceInfo) return null;

  const allImages = getAllImages();
  const sequenceMembers = getSequenceMembers(allImages, sequenceInfo.baseId);
  if (sequenceMembers.length === 0) return null;

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
  if (!isSequenceImage(imageId)) return;

  slide.type = "html";
  slide.html = `<div class="sequence-player-host" style="width:100%; height:100%; display:flex; flex-direction:column; background:black;"></div>`;
  slide._imageId = imageId ?? undefined;
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
