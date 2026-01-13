<script lang="ts">
  import type { CleanApertureData, UserCrop } from "$shared/types/clap";
  import { nativeClapToUserCrop, userCropToNativeClap } from "$shared/utils/clap-transform";
  import Check from "@lucide/svelte/icons/check";
  import Loader2 from "@lucide/svelte/icons/loader-2";
  import RotateCcw from "@lucide/svelte/icons/rotate-ccw";
  import { toast } from "svelte-sonner";

  import AspectRatioPicker from "$lib/components/admin/AspectRatioPicker.svelte";
  import { Button } from "$lib/components/ui/button";
  import * as Dialog from "$lib/components/ui/dialog";
  import { getContentDir } from "$lib/config";
  import * as m from "$lib/paraglide/messages";
  import { manifest } from "$lib/stores/manifest.svelte";
  import type { ImageEntry } from "$lib/types/manifest";
  import { tracedFetch } from "$lib/utils/api";

  let {
    open = $bindable(false),
    image = undefined,
    onClose,
  } = $props<{
    open: boolean;
    image?: ImageEntry;
    onClose?: () => void;
  }>();

  let isLoading = $state(false);
  let previewUrl = $state<string | null>(null);
  let metadata = $state<{
    nativeWidth: number;
    nativeHeight: number;
    orientation: number;
    initialClap: CleanApertureData | null;
  } | null>(null);

  let selectedRatio = $state<string>("original");

  // Crop State (Percentages 0-100)
  let crop = $state<UserCrop>({ x: 0, y: 0, width: 100, height: 100 });
  let containerRef = $state<HTMLDivElement | null>(null);

  // Available space measurement for "Contain" sizing
  let previewAreaRef = $state<HTMLDivElement | null>(null);
  let availableWidth = $state(800);
  let availableHeight = $state(600);

  function findMatchingPreset(w: number, h: number, metaRatio?: string | null): string {
    // 1. Direct match if metadata provides curated aspectRatio key
    if (metaRatio) {
      if (metaRatio === "square") return "1:1";
      if (metaRatio.startsWith("landscape-") || metaRatio.startsWith("portrait-")) {
        return metaRatio.split("-").slice(1).join(":");
      }
    }

    // 2. Fallback to calculation if metadata is missing or generic
    const ratio = w / h;
    const presets = ["3:2", "4:3", "5:4", "16:9", "21:9", "1:1", "2:3", "3:4", "4:5"];

    for (const p of presets) {
      const [pw, ph] = p.split(":").map(Number);
      const pr = pw / ph;
      if (Math.abs(ratio - pr) < 0.01) return p;
    }
    return "original";
  }

  // Calculate target ratio once, reactively
  let targetRatio = $derived(getTargetRatioValue());

  // Effect to manage preview lifecycle
  // Effect to manage reset state
  $effect(() => {
    if (open && image) {
      loadPreview(image);
    } else {
      // Close/Reset state
      previewUrl = null;
      crop = { x: 0, y: 0, width: 100, height: 100 };
      selectedRatio = "original";
    }
  });

  async function loadPreview(img: ImageEntry) {
    isLoading = true;
    try {
      const contentDir = getContentDir();
      const baseUrl = `/api/images/clap-preview?id=${img.id}&contentDir=${contentDir}`;

      // 1. Fetch metadata first
      const res = await fetch(`${baseUrl}&metadata=true`);
      if (!res.ok) throw new Error("Failed to load metadata");

      const meta = await res.json();

      metadata = meta;

      // 2. Set Preview URL directly (no blobs)
      // Add timestamp to prevent caching old versions if we re-open same ID
      previewUrl = `${baseUrl}&t=${Date.now()}`;

      if (!metadata) throw new Error("Metadata not loaded");

      const isSwapped = metadata.orientation >= 5;
      const visualW = isSwapped ? metadata.nativeHeight : metadata.nativeWidth;
      const visualH = isSwapped ? metadata.nativeWidth : metadata.nativeHeight;

      if (meta.initialClap) {
        crop = nativeClapToUserCrop(
          meta.initialClap,
          meta.nativeWidth,
          meta.nativeHeight,
          meta.orientation,
        );
        const isFull = Math.abs(crop.width - 100) < 0.1 && Math.abs(crop.height - 100) < 0.1;
        if (isFull) {
          selectedRatio = findMatchingPreset(visualW, visualH, img.aspectRatio);
        } else {
          selectedRatio = "free";
        }
      } else {
        crop = { x: 0, y: 0, width: 100, height: 100 };
        selectedRatio = findMatchingPreset(visualW, visualH, img.aspectRatio);
      }
    } catch (e: any) {
      toast.error(e.message);
      open = false;
    } finally {
      isLoading = false;
    }
  }

  function getTargetRatioValue(): number | null {
    if (selectedRatio === "free") return null;
    if (selectedRatio === "original") {
      if (!metadata) return 1;
      // In User Space (CSS %), width and height are relative to the bounding box.
      // The bounding box ALREADY represents the aspect ratio of the image (rotated).
      // So "Original" ratio in % space implies keeping width% == height%.
      // Wait. If width=100%, height=100%, that IS the original ratio.
      // So constraint is simply W_pct = H_pct.
      // Ratio in PCT space is 1.
      return 1;
    }
    const [w, h] = selectedRatio.split(":").map(Number);
    // This is Visual Ratio.
    // We need to convert Visual Ratio to % Ratio.
    // VisualW / VisualH = TargetRatio
    // (W_pct * BoxW) / (H_pct * BoxH) = TargetRatio
    // W_pct / H_pct = TargetRatio * (BoxH / BoxW)
    // BoxH / BoxW = NativeH / NativeW (after rotation handling for Box)
    // Actually, simpler:
    // If we want 1:1 Visual, and image is 3:2.
    // Box is 300x200.
    // We want crop 200x200.
    // W_pct = 66.6%, H_pct = 100%.
    // W_pct / H_pct = 0.666
    // Formula: PctRatio = TargetRatio / ImageRatio

    if (!metadata) return 1;
    // Current Image Ratio (Native dimensions swapped if rotated)
    const isSwapped = metadata.orientation >= 5;
    const imgW = isSwapped ? metadata.nativeHeight : metadata.nativeWidth;
    const imgH = isSwapped ? metadata.nativeWidth : metadata.nativeHeight;
    const imgRatio = imgW / imgH;

    return w / h / imgRatio;
  }

  function handleRatioSelect(r: string) {
    selectedRatio = r;
    if (r === "free") return;

    const ratioVal = getTargetRatioValue();
    if (!ratioVal) return;

    // "MAXIMIZE" Strategy
    // Find largest rect that fits in 100x100 with W/H = ratioVal

    // Try Max Width (100)
    let newW = 100;
    let newH = newW / ratioVal;

    // If Height overflows 100, clamp Height to 100 and recalc Width
    if (newH > 100) {
      newH = 100;
      newW = newH * ratioVal;
    }

    // Center logic
    // We try to preserve the current center of interest
    const cx = crop.x + crop.width / 2;
    const cy = crop.y + crop.height / 2;

    let nx = cx - newW / 2;
    let ny = cy - newH / 2;

    // Shift to fit bounds (0-100)
    if (nx < 0) nx = 0;
    if (ny < 0) ny = 0;
    if (nx + newW > 100) nx = 100 - newW;
    if (ny + newH > 100) ny = 100 - newH;

    crop = { x: nx, y: ny, width: newW, height: newH };
  }

  async function save() {
    if (!image || !metadata) return;

    isLoading = true;
    try {
      // Check if full image (Reset)
      const isFull =
        Math.abs(crop.x) < 0.1 &&
        Math.abs(crop.y) < 0.1 &&
        Math.abs(crop.width - 100) < 0.1 &&
        Math.abs(crop.height - 100) < 0.1;

      let payloadClap: CleanApertureData | null = null;

      if (!isFull) {
        payloadClap = userCropToNativeClap(
          crop,
          metadata.nativeWidth,
          metadata.nativeHeight,
          metadata.orientation,
        );
      }

      const contentDir = getContentDir();
      const res = await tracedFetch("/api/images", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          // Provide a full-ish path so the backend can reliably detect the contentDir
          images: [{ id: image.id, src: `/images/${contentDir}/${image.src}` }],
          updates: { clap: payloadClap },
        }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        console.error("Save error response:", errorData);
        throw new Error(errorData.message || "Failed to save crop");
      }

      // Parse response to get updated image data
      const data = await res.json();
      if (data.updatedImages && Array.isArray(data.updatedImages)) {
        // Update local store with cache busting
        for (const updatedImg of data.updatedImages) {
          manifest.refreshItem(updatedImg);
        }
      }

      toast.success(m.clap_save_success());
      onClose?.(); // Still call this to close dialog
      open = false;
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      isLoading = false;
    }
  }

  function handleReset() {
    crop = { x: 0, y: 0, width: 100, height: 100 };
    selectedRatio = "original";
  }

  // --- Interaction Logic ---
  let isDragging = false;
  let isResizing = false;
  let dragStart = { x: 0, y: 0 };
  let startCrop = { x: 0, y: 0, width: 100, height: 100 };
  let startRect = { width: 0, height: 0 };
  let activeHandle: string | null = null;

  function onMouseDown(e: MouseEvent, type: "move" | "resize", handle?: string) {
    if (!containerRef) return;
    e.preventDefault();
    e.stopPropagation();

    const rect = containerRef.getBoundingClientRect();
    startRect = { width: rect.width, height: rect.height };

    isDragging = type === "move";
    isResizing = type === "resize";
    activeHandle = handle || null;
    dragStart = { x: e.clientX, y: e.clientY };
    startCrop = { ...crop };

    window.addEventListener("pointermove", onMouseMove);
    window.addEventListener("pointerup", onMouseUp);
  }

  function onMouseMove(e: PointerEvent) {
    if (!containerRef) return;
    const currentTargetRatio = targetRatio;

    // Calculate delta relative to the START of the drag
    const dxPx = e.clientX - dragStart.x;
    const dyPx = e.clientY - dragStart.y;

    // Convert pixels to percentages of the STARTING viewport size
    // dx/dy are now % of Viewport.
    const dxVp = (dxPx / startRect.width) * 100;
    const dyVp = (dyPx / startRect.height) * 100;

    // Scale to % of Original Image.
    // ViewportWidth = (startCrop.width/100) * OriginalWidth.
    // So 1% Viewport = (startCrop.width/100)% Original.
    const dx = dxVp * (startCrop.width / 100);
    const dy = dyVp * (startCrop.height / 100);

    if (isDragging) {
      // iPhone style: Dragging moves the IMAGE, so the crop box moves in OPPOSITE direction relative to image.
      let nx = startCrop.x - dx;
      let ny = startCrop.y - dy;

      // Clamp
      if (nx < 0) nx = 0;
      if (ny < 0) ny = 0;
      if (nx + startCrop.width > 100) nx = 100 - startCrop.width;
      if (ny + startCrop.height > 100) ny = 100 - startCrop.height;

      crop.x = nx;
      crop.y = ny;
    } else if (isResizing && activeHandle) {
      let { x, y, width, height } = startCrop;

      // Apply Free Resizing
      if (!targetRatio) {
        if (activeHandle.includes("n")) {
          const newY = y + dy > 0 ? y + dy : 0;
          if (newY > y + height - 5) return;
          height = height - (newY - y);
          y = newY;
        }
        if (activeHandle.includes("s")) {
          height = Math.min(100 - y, Math.max(5, height + dy));
        }
        if (activeHandle.includes("w")) {
          const newX = x + dx > 0 ? x + dx : 0;
          if (newX > x + width - 5) return;
          width = width - (newX - x);
          x = newX;
        }
        if (activeHandle.includes("e")) {
          width = Math.min(100 - x, Math.max(5, width + dx));
        }
      } else {
        const ratio = currentTargetRatio!;
        let newW = width;
        let newH = height;
        let newX = x;
        let newY = y;

        if (activeHandle === "se") {
          newW = Math.max(5, width + dx);
          newH = newW / ratio;
          if (x + newW > 100) {
            newW = 100 - x;
            newH = newW / ratio;
          }
          if (y + newH > 100) {
            newH = 100 - y;
            newW = newH * ratio;
          }
        } else if (activeHandle === "sw") {
          newW = Math.max(5, width - dx);
          newH = newW / ratio;
          if (newW > x + width) {
            newW = x + width;
            newH = newW / ratio;
          }
          if (x + width - newW < 0) {
            newW = x + width;
            newH = newW / ratio;
          }
          newX = x + width - newW;
          if (y + newH > 100) {
            newH = 100 - y;
            newW = newH * ratio;
            newX = x + width - newW;
          }
        } else if (activeHandle === "ne") {
          newW = Math.max(5, width + dx);
          newH = newW / ratio;
          if (x + newW > 100) {
            newW = 100 - x;
            newH = newW / ratio;
          }
          if (y + height - newH < 0) {
            newH = y + height;
            newW = newH * ratio;
          }
          newY = y + height - newH;
        } else if (activeHandle === "nw") {
          newW = Math.max(5, width - dx);
          newH = newW / ratio;
          if (x + width - newW < 0) {
            newW = x + width;
            newH = newW / ratio;
          }
          newX = x + width - newW;
          if (y + height - newH < 0) {
            newH = y + height;
            newW = newH * ratio;
            newX = x + width - newW;
          }
          newY = y + height - newH;
        }

        width = newW;
        height = newH;
        x = newX;
        y = newY;
      }

      crop = { x, y, width, height };
    }
  }

  function onMouseUp() {
    isDragging = false;
    isResizing = false;
    activeHandle = null;
    window.removeEventListener("pointermove", onMouseMove);
    window.removeEventListener("pointerup", onMouseUp);
  }

  function onWheel(e: WheelEvent) {
    e.preventDefault();
    e.stopPropagation();

    // Zoom In (Small DeltaY) -> Shrink Crop Box
    // Zoom Out (Pos DeltaY) -> Grow Crop Box
    const ZOOM_SPEED = 0.05;
    const delta = Math.sign(e.deltaY);

    // Current Aspect Ratio
    const ratio = crop.width / crop.height;

    // We want to zoom towards the MOUSE position if possible
    // Get mouse position relative to the container (0 to 1)
    const rect = containerRef?.getBoundingClientRect();
    let anchorX = 0.5;
    let anchorY = 0.5;

    if (rect) {
      anchorX = (e.clientX - rect.left) / rect.width;
      anchorY = (e.clientY - rect.top) / rect.height;
    }

    // New Width/Height
    const pChange = delta > 0 ? 1.1 : 0.9;
    let newW = crop.width * pChange;
    let newH = newW / ratio;

    // Constraints
    if (newW < 2) newW = 2; // Min 2%
    if (newW > 100) newW = 100;
    if (newH > 100) {
      newH = 100;
      newW = newH * ratio;
    }
    if (newW > 100) {
      // Re-check if width grew after height clamp
      newW = 100;
      newH = newW / ratio;
    }

    // Zoom towards anchor:
    // The point in image-space that is under the anchor should stay under the anchor.
    // ImagePoint = crop.x + anchorX * crop.width
    const imagePointX = crop.x + anchorX * crop.width;
    const imagePointY = crop.y + anchorY * crop.height;

    let newX = imagePointX - anchorX * newW;
    let newY = imagePointY - anchorY * newH;

    // Final boundary checks
    if (newX < 0) newX = 0;
    if (newY < 0) newY = 0;
    if (newX + newW > 100) newX = 100 - newW;
    if (newY + newH > 100) newY = 100 - newH;

    crop = { x: newX, y: newY, width: newW, height: newH };
  }
</script>

{#snippet header()}
  <div class="flex items-center gap-4">
    <h2 class="text-lg font-semibold" data-testid="clap-editor-title">{m.clap_title()}</h2>
  </div>
{/snippet}

{#snippet preview()}
  <div
    bind:this={previewAreaRef}
    bind:clientWidth={availableWidth}
    bind:clientHeight={availableHeight}
    class="relative flex flex-1 items-center justify-center overflow-hidden bg-black/90 p-8 select-none"
    data-testid="clap-editor-preview-area"
  >
    {#if isLoading && !previewUrl}
      <Loader2 class="h-8 w-8 animate-spin text-white" />
    {:else if previewUrl && metadata}
      {@const cropRatio = crop.width / crop.height}
      {@const isSwapped = metadata.orientation >= 5}
      {@const imgW = isSwapped ? metadata.nativeHeight : metadata.nativeWidth}
      {@const imgH = isSwapped ? metadata.nativeWidth : metadata.nativeHeight}
      {@const nativeRatio = imgW / imgH}
      {@const viewportRatio = cropRatio * nativeRatio}

      <!-- "Contain" Algorithm: Fit viewport into available space while maintaining aspect ratio -->
      {@const padding = 32}
      <!-- 2rem = 32px (p-8 is applied, but we measure clientWidth which includes it) -->
      {@const maxW = Math.max(100, availableWidth - padding * 2)}
      {@const maxH = Math.max(100, availableHeight - padding * 2)}

      <!-- Try fitting by width first -->
      {@const fitByWidthW = maxW}
      {@const fitByWidthH = maxW / viewportRatio}

      <!-- If height overflows, fit by height instead -->
      {@const useWidthFit = fitByWidthH <= maxH}
      {@const computedW = useWidthFit ? fitByWidthW : maxH * viewportRatio}
      {@const computedH = useWidthFit ? fitByWidthH : maxH}

      <!-- Immersive Viewport with computed pixel dimensions -->
      <div
        bind:this={containerRef}
        class="relative box-content cursor-move overflow-hidden border-2 border-white bg-black shadow-2xl"
        style="
          width: {computedW}px;
          height: {computedH}px;
          touch-action: none;
        "
        onpointerdown={(e) => onMouseDown(e, "move")}
        onwheel={onWheel}
        role="button"
        tabindex="0"
        data-testid="clap-editor-crop-box"
      >
        <img
          src={previewUrl}
          alt="Preview"
          class="pointer-events-none absolute max-w-none select-none"
          draggable="false"
          style="
            transform-origin: 0 0;
            /* 
               Width is relative to the viewport.
               Viewport Width corresponds to crop.width % of the Image Width.
               So Image Width = Viewport Width * (100 / crop.width).
            */
            width: {10000 / crop.width}%;
            /* Height auto ensures we maintain native image aspect ratio, preventing squash/stretch */
            height: auto;
            
            /* 
               In CSS transform: translate(%), the percentage refers to the element's OWN size.
               Since the <img> contains the full image and its width is set to 100/crop.width%,
               shifting by -crop.x% correctly positions the desired crop window at 0,0 of the viewport.
            */
            transform: translate({-crop.x}%, {-crop.y}%);
          "
        />
        <!-- Handles (Only if free mode, otherwise hidden or specialized UI) -->
        <!-- For now, we keep handles but they manipulate the crop rectangle logic. -->
        <!-- In Immersive mode, handles should probably change the viewport size/ratio? -->
        <!-- If ratio is fixed, corner handles just scale the viewport? No. -->
        <!-- If ratio is free, handles change shape. -->

        <!-- Handles: Only visible and active in 'free' mode -->
        {#if selectedRatio === "free"}
          {#each ["nw", "ne", "sw", "se", "n", "s", "e", "w"] as h}
            <div
              class="absolute h-3 w-3 rounded-full border border-black bg-white cursor-{h}-resize"
              style="
                {h.includes('n') ? 'top: -6px;' : ''}
                {h.includes('s') ? 'bottom: -6px;' : ''}
                {h.includes('w') ? 'left: -6px;' : ''}
                {h.includes('e') ? 'right: -6px;' : ''}
                {h === 'n' || h === 's' ? 'left: 50%; transform: translateX(-50%);' : ''}
                {h === 'e' || h === 'w' ? 'top: 50%; transform: translateY(-50%);' : ''}
              "
              onpointerdown={(e) => onMouseDown(e, "resize", h)}
              role="button"
              tabindex="0"
              data-testid={`clap-editor-handle-${h}`}
            ></div>
          {/each}
        {/if}

        <!-- Thirds Grid -->
        <div class="pointer-events-none absolute inset-0 flex flex-col opacity-30">
          <div class="flex-1 border-b border-white"></div>
          <div class="flex-1 border-b border-white"></div>
          <div class="flex-1"></div>
        </div>
        <div class="pointer-events-none absolute inset-0 flex opacity-30">
          <div class="flex-1 border-r border-white"></div>
          <div class="flex-1 border-r border-white"></div>
          <div class="flex-1"></div>
        </div>
      </div>
    {/if}
  </div>
{/snippet}

{#snippet sidebar()}
  <div
    class="border-border/20 bg-background text-foreground z-10 flex w-80 flex-col gap-4 overflow-y-auto border-l p-4"
    data-testid="clap-sidebar"
  >
    <div class="flex flex-col gap-2">
      <h3 class="text-sm font-semibold">{m.clap_info_title()}</h3>
      {#if metadata}
        <div
          class="text-muted-foreground grid grid-cols-2 gap-1 text-xs"
          data-testid="clap-metadata"
        >
          <span>{m.clap_dimensions()}</span>
          <span class="text-right font-mono">{metadata.nativeWidth} × {metadata.nativeHeight}</span>
          <span>{m.clap_orientation()}</span>
          <span class="text-right font-mono">{metadata.orientation}</span>
        </div>
      {:else}
        <span class="text-muted-foreground text-xs">{m.clap_metadata_loading()}</span>
      {/if}
    </div>

    <div class="flex flex-col gap-2">
      <h3 class="text-sm font-semibold">{m.clap_aspect_ratio_title()}</h3>
      <AspectRatioPicker
        bind:value={selectedRatio}
        onSelect={handleRatioSelect}
        includeOriginal
        includeFree
        layout="grid"
      />
    </div>

    <div class="mt-auto flex flex-col gap-2">
      <Button variant="outline" onclick={handleReset} data-testid="clap-editor-reset">
        <RotateCcw class="mr-2 size-4" />
        {m.clap_action_reset()}
      </Button>
      <Button onclick={save} disabled={isLoading} data-testid="clap-editor-save">
        {#if isLoading}
          <Loader2 class="mr-2 size-4 animate-spin" />
        {:else}
          <Check class="mr-2 size-4" />
        {/if}
        {m.clap_action_save()}
      </Button>
    </div>
  </div>
{/snippet}

<Dialog.Root bind:open onOpenChange={(o) => !o && onClose?.()}>
  <Dialog.Content
    class="m-0 flex h-screen w-screen max-w-none flex-col gap-0 overflow-hidden rounded-none border-none bg-black/95 p-0 text-white sm:max-w-screen"
    data-testid="clap-editor-content"
  >
    <!-- Header -->
    <div
      class="border-border/20 bg-muted/10 flex items-center justify-between border-b p-4"
      data-testid="clap-editor-header"
    >
      {@render header()}
    </div>

    <!-- Main Content -->
    <div class="flex flex-1 gap-0 overflow-hidden">
      {@render preview()}
      {@render sidebar()}
    </div>
  </Dialog.Content>
</Dialog.Root>
