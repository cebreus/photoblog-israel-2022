<script lang="ts">
  import { Move } from "@lucide/svelte";
  import { untrack } from "svelte";
  import { toast } from "svelte-sonner";

  import CollageTemplateIcon from "$lib/components/icons/CollageTemplateIcon.svelte";
  import { Button } from "$lib/components/ui/button";
  import * as ButtonGroup from "$lib/components/ui/button-group";
  import * as Dialog from "$lib/components/ui/dialog";
  import { Input } from "$lib/components/ui/input";
  import { Label } from "$lib/components/ui/label";
  import { Switch } from "$lib/components/ui/switch";
  import { getContentDir } from "$lib/config";
  import { log } from "$lib/logger";
  import type {
    CollageCrop,
    CollageRequest,
    CollageResponse,
    CollageTemplateId,
  } from "$lib/types/collage";
  import type { ImageEntry } from "$lib/types/manifest";
  import { cn } from "$lib/utils";
  import {
    calculateCollageLayout,
    calculateDenormalizedBorderWidth,
    calculateNormalizedBorderWidth,
    determineAutoTemplate,
    formatDimensionLabel,
    formatRatioLabel,
    getDetailSource,
    getImageAspectRatio,
    parsePresetRatio,
  } from "$lib/utils/collage";
  import { COLLAGE_MESSAGES } from "$lib/utils/messages";

  import { invalidateAll } from "$app/navigation";

  // Props
  let {
    open = $bindable(false),
    images = [],
    existingConfig = undefined,
  }: {
    open: boolean;
    images: ImageEntry[];
    existingConfig?: CollageRequest;
  } = $props();

  // Constants
  const templates: {
    id: CollageTemplateId;
    capacity: number; // Max items allowed (Infinity for row/col)
  }[] = [
    { id: "row", capacity: Infinity },
    { id: "column", capacity: Infinity },
    { id: "grid-2x2", capacity: 4 },
    { id: "hero-top", capacity: 3 },
    { id: "hero-left", capacity: 3 },
    { id: "hero-right", capacity: 3 },
    { id: "sidebar-hero", capacity: 4 },
    { id: "grid-3x2", capacity: 6 },
    { id: "mosaic-6", capacity: 6 },
    { id: "density-7", capacity: 7 },
  ];

  const ratioPresets = [
    { id: "auto", label: COLLAGE_MESSAGES.RATIO_AUTO },
    { id: "3:2", label: "3:2" },
    { id: "4:3", label: "4:3" },
    { id: "1:1", label: "1:1" },
    { id: "16:9", label: "16:9" },
    { id: "21:9", label: "21:9" },
  ] as const;

  type RatioPresetId = (typeof ratioPresets)[number]["id"];

  interface CollageItem {
    uniqueId: string;
    data: ImageEntry;
    /** Original imageId from config (for re-edits) - preserves correct file extension */
    originalImageId?: string;
  }

  // State
  let collageItems = $state<CollageItem[]>([]);
  let loading = $state(false);
  let selectedTemplate = $state<CollageTemplateId>("row");
  let imageConfigs = $state<Record<string, CollageCrop>>({});
  let borderEnabled = $state(true);
  let borderWidth = $state(10);
  let borderColor = $state("#ffffff");
  let selectedRatioPreset = $state<RatioPresetId>("auto");
  let aspectMode = $state<"auto" | "landscape" | "portrait">("auto");
  let userPickedTemplate = $state(false);
  let draggedIndex = $state<number | null>(null);
  let activeImageId = $state<string | null>(null);
  let startX = 0;
  let startY = 0;

  let abortController: AbortController | null = null;

  // Derived: Are we editing an existing collage?
  let isEditMode = $derived(!!existingConfig);

  // Track initialization to prevent infinite loops
  let initialized = false;

  // Init effects
  $effect(function initCollageItems() {
    if (open && !initialized) {
      log.info(`[CollageDialog] Initializing. open=${open}, init=${initialized}`);
      initialized = true;
      // If existingConfig provided, load it for re-editing
      if (existingConfig) {
        log.info(
          `[CollageDialog] Loading existing config:`,
          JSON.parse(JSON.stringify(existingConfig)),
        );
        // Use untrack to prevent triggering this effect again
        untrack(() => {
          selectedTemplate = existingConfig.template;
          userPickedTemplate = true; // Prevent determineAutoTemplate from overwriting
          log.info(`[CollageDialog] Set template: ${selectedTemplate}`);
          if (existingConfig.border) {
            borderEnabled = true;
            borderColor = existingConfig.border.color;
            if (existingConfig.border.userSetting !== undefined) {
              borderWidth = existingConfig.border.userSetting;
              log.info(`[CollageDialog] Set border from userSetting: ${borderWidth}`);
            } else {
              // Fallback: try to guess original setting from pixel value
              // We need the images to calculate scale
              const originalImages = existingConfig.items
                .map((itemConf) =>
                  images.find((img) => img.src === itemConf.imageId || img.id === itemConf.id),
                )
                .filter((img): img is ImageEntry => !!img);

              borderWidth = calculateDenormalizedBorderWidth(
                existingConfig.border.width,
                originalImages,
              );
              log.info(
                `[CollageDialog] Denormalized border: ${existingConfig.border.width}px -> ${borderWidth}`,
              );
            }
          } else {
            borderEnabled = false;
            log.info(`[CollageDialog] Border disabled`);
          }

          // Load image configs (crop data) & Items
          const configs: Record<string, CollageCrop> = {};
          // Load aspect ratio if present
          if (existingConfig.aspectRatio) {
            selectedRatioPreset = existingConfig.aspectRatio as any;
            log.info(`[CollageDialog] Set aspect ratio: ${selectedRatioPreset}`);
          }

          const items: CollageItem[] = [];
          const notFound: string[] = [];

          for (const itemConf of existingConfig.items) {
            const originalImg = images.find(
              (img) => img.src === itemConf.imageId || img.id === itemConf.id,
            );
            if (originalImg) {
              log.info(`[CollageDialog] Found image for ${itemConf.id}`);
              const uniqueId = crypto.randomUUID();
              // Preserve original imageId (with correct extension like .heic) for re-save
              items.push({ uniqueId, data: originalImg, originalImageId: itemConf.imageId });
              const crop = itemConf.crop || { x: 50, y: 50, scale: 1 };
              configs[uniqueId] = crop;
              log.info(`[CollageDialog] Initialized item ${itemConf.id} with crop:`, crop);
            } else {
              notFound.push(itemConf.id || "unknown");
              log.warn(
                `[Collage] Source image not found: ${itemConf.id || "unknown"} (imageId: ${itemConf.imageId})`,
              );
            }
          }

          if (notFound.length > 0) {
            log.error(`[Collage] Missing ${notFound.length} images: ${notFound.join(", ")}`);
            toast.error(COLLAGE_MESSAGES.SOURCE_IMAGES_NOT_FOUND, {
              description: `Chybějící: ${notFound.join(", ")}`,
            });
          }

          collageItems = items;
          imageConfigs = configs;
          log.info(`[CollageDialog] Loaded ${collageItems.length} items`);
        });
      } else if (images.length > 0) {
        log.info(`[CollageDialog] Creating fresh items from ${images.length} images`);
        // Always initialize fresh from selection
        untrack(() => {
          collageItems = images.map((img) => ({ uniqueId: crypto.randomUUID(), data: img }));
        });
      }
    } else if (!open && initialized) {
      log.info(`[CollageDialog] UI Closed - resetting state`);
      // Reset initialization flag when dialog closes
      initialized = false;
    }
  });

  $effect(function initImageConfigs() {
    const newConfigs = { ...imageConfigs };
    let changed = false;

    for (const item of collageItems) {
      if (!newConfigs[item.uniqueId]) {
        newConfigs[item.uniqueId] = { x: 50, y: 50, scale: 1 };
        changed = true;
      }
    }

    if (changed) {
      imageConfigs = newConfigs;
    }
  });

  $effect(function autoSelectTemplate() {
    if (collageItems.length === 0) return;
    if (aspectMode === "auto" && !userPickedTemplate && !isEditMode) {
      log.info(
        `[CollageDialog] Auto-selecting template. userPicked=${userPickedTemplate}, editMode=${isEditMode}`,
      );
      selectedTemplate = determineAutoTemplate(collageItems.map((i) => i.data));
      return;
    }
    if (!userPickedTemplate) {
      selectedTemplate = aspectMode === "portrait" ? "column" : "row";
    }
  });

  // Derived state
  function getNormalizedBorderWidth() {
    // Prefer full list reference logic
    const referenceItems = images.length > 0 ? images : collageItems.map((i) => i.data);
    if (referenceItems.length === 0) return borderWidth;
    return calculateNormalizedBorderWidth(borderWidth, referenceItems);
  }

  let layout = $derived.by(() => {
    const activeTemplate = templates.find((t) => t.id === selectedTemplate);
    const capacity = activeTemplate?.capacity ?? Infinity;

    // Use current items references
    let itemsToProcess = collageItems.map((i) => i.data);

    if (capacity !== Infinity && itemsToProcess.length < capacity) {
      const paddingCount = capacity - itemsToProcess.length;
      for (let i = 0; i < paddingCount; i++) {
        itemsToProcess.push({
          id: `placeholder-${i}`,
          width: 1000,
          height: 1000,
          src: "",
        } as ImageEntry);
      }
    }

    return calculateCollageLayout(
      itemsToProcess,
      selectedTemplate,
      borderEnabled ? getNormalizedBorderWidth() : 0,
    );
  });

  let ratioInfo = $derived(
    selectedRatioPreset === "auto"
      ? { w: layout.width, h: layout.height, val: layout.width / layout.height }
      : parsePresetRatio(selectedRatioPreset),
  );

  let ratioValue = $derived(
    "val" in ratioInfo ? ratioInfo.val : ratioInfo.width / ratioInfo.height,
  );
  let isLandscape = $derived(ratioValue > 1);

  // Auto-save to localStorage (draft)
  $effect(function autoSaveCollageDraft() {
    if (!open || collageItems.length === 0) return;

    const draft = {
      orderedImageIds: collageItems.map((i) => i.data.id),
      selectedTemplate,
      borderEnabled,
      borderWidth,
      borderColor,
      selectedRatioPreset,
    };

    try {
      localStorage.setItem("collage-draft", JSON.stringify(draft));
    } catch (e) {
      log.warn(`${COLLAGE_MESSAGES.LOAD_CONFIG_FAILED}: ${String(e)}`);
    }
  });

  // Event handlers
  function handleTemplateSelect(template: CollageTemplateId) {
    selectedTemplate = template;
    userPickedTemplate = true;
  }

  function handleRatioSelect(presetId: RatioPresetId) {
    selectedRatioPreset = presetId;
  }

  // --- Drag & Drop State ---
  let dragSourceType = $state<"internal" | "source" | null>(null);
  let draggedSourceIndex = $state<number | null>(null);

  function handleDragStart(e: DragEvent, index: number) {
    draggedIndex = index;
    dragSourceType = "internal";
    draggedSourceIndex = null;
    if (e.dataTransfer) {
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.dropEffect = "move";
      e.dataTransfer.setData("application/x-collage-internal", index.toString());
    }
  }

  function handleSourceDragStart(e: DragEvent, index: number) {
    draggedSourceIndex = index;
    dragSourceType = "source";
    draggedIndex = null;
    if (e.dataTransfer) {
      e.dataTransfer.effectAllowed = "copy";
      e.dataTransfer.dropEffect = "copy";
      e.dataTransfer.setData("application/x-collage-source", index.toString());
    }
  }

  function handleDragOver(e: DragEvent, index: number) {
    e.preventDefault();
    if (e.dataTransfer) {
      e.dataTransfer.dropEffect = dragSourceType === "source" ? "copy" : "move";
    }
  }

  function handleDrop(e: DragEvent, dropIndex: number) {
    e.preventDefault();

    // Internal Swap
    if (dragSourceType === "internal" && draggedIndex !== null) {
      if (draggedIndex === dropIndex) return;
      const newItems = [...collageItems];
      const draggedItem = newItems[draggedIndex];
      newItems[draggedIndex] = newItems[dropIndex];
      newItems[dropIndex] = draggedItem;
      collageItems = newItems;
      draggedIndex = null;
    }

    // Source Drop (Replace)
    else if (dragSourceType === "source" && draggedSourceIndex !== null) {
      const sourceImg = images[draggedSourceIndex];
      if (sourceImg) {
        const newItems = [...collageItems];
        const newItem = { uniqueId: crypto.randomUUID(), data: sourceImg };

        imageConfigs = {
          ...imageConfigs,
          [newItem.uniqueId]: { x: 50, y: 50, scale: 1 },
        };

        if (dropIndex >= 0 && dropIndex < newItems.length) {
          newItems[dropIndex] = newItem;
        }
        collageItems = newItems;
      }
      draggedSourceIndex = null;
    }
    dragSourceType = null;
  }

  // --- Pan & Zoom ---

  function debounce<T extends (...args: any[]) => void>(func: T, wait: number) {
    let timeout: ReturnType<typeof setTimeout>;
    return (...args: Parameters<T>) => {
      clearTimeout(timeout);
      timeout = setTimeout(() => func(...args), wait);
    };
  }

  const debouncedUpdateConfig = debounce((id: string, conf: CollageCrop) => {
    imageConfigs = {
      ...imageConfigs,
      [id]: conf,
    };
  }, 10); // 10ms debounce (very fast but throttles sync updates)

  function handleMouseDown(e: MouseEvent, id: string) {
    e.preventDefault();
    activeImageId = id;
    startX = e.clientX;
    startY = e.clientY;
  }

  // Use a global effect for listeners when active image exists
  $effect(() => {
    if (activeImageId) {
      const handleGlobalMouseMove = (e: MouseEvent) => {
        if (!activeImageId || !imageConfigs[activeImageId]) return;

        const conf = imageConfigs[activeImageId];
        const dx = e.clientX - startX;
        const dy = e.clientY - startY;
        const factor = 0.2 / conf.scale;

        const newX = Math.max(0, Math.min(100, conf.x - dx * factor));
        const newY = Math.max(0, Math.min(100, conf.y - dy * factor));

        // Direct update for responsiveness? Or debounced?
        // For drag/pan, we want smooth visual feedback.
        // Svelte 5 runes should handle fine-grained updates efficiently.
        // But if `imageConfigs` change triggers layout...
        // Layout depends on `collageItems` and template/border/crop logic?
        // Layout engine usually doesn't need crop unless 'Smart Crop' is enabled.
        // Currently layout engine uses `cropStrategy: simple`.

        // So we can update directly without debouncing if it doesn't re-run heavy layout.
        // BUT, `imageConfigs` is reactive.
        // Layout calculation DOES NOT depend on `imageConfigs` (it uses `collageItems` which has `data`).
        // Wait, `calculateCollageLayout` takes `itemsToProcess`.

        // Ah, if layout doesn't depend on crop, then updating config is cheap!
        // We only update `imageConfigs` which updates the `style:object-position` in DOM.
        // This is cheap. Debouncing might cause laggy feel.
        // I will SKIP debouncing for Pan to keep it smooth, as layout doesn't re-run.
        // Check `layout` derived: `const calculated = calculateCollageLayout(...)`.
        // It depends on `collageItems` (which doesn't change on pan) and `selectedTemplate` etc.
        // It DOES NOT depend on `imageConfigs`.
        // So pan is optimized by architecture!

        imageConfigs = {
          ...imageConfigs,
          [activeImageId]: { ...conf, x: newX, y: newY },
        };

        startX = e.clientX;
        startY = e.clientY;
      };

      const handleGlobalMouseUp = () => {
        activeImageId = null;
      };

      window.addEventListener("mousemove", handleGlobalMouseMove);
      window.addEventListener("mouseup", handleGlobalMouseUp);

      return () => {
        window.removeEventListener("mousemove", handleGlobalMouseMove);
        window.removeEventListener("mouseup", handleGlobalMouseUp);
      };
    }
  });

  function handleWheel(e: WheelEvent, uniqueId: string) {
    if (!imageConfigs[uniqueId]) return;
    e.preventDefault();
    e.stopPropagation();

    const conf = imageConfigs[uniqueId];
    const delta = -Math.sign(e.deltaY) * 0.1;
    const newScale = Math.max(1, Math.min(5, conf.scale + delta));

    imageConfigs = {
      ...imageConfigs,
      [uniqueId]: { ...conf, scale: newScale },
    };
  }

  // --- Actions ---

  async function createCollage() {
    if (collageItems.length < 2) return;

    const uniqueImages = new Set(collageItems.map((i) => i.data.id));
    if (uniqueImages.size < collageItems.length) {
      toast.info(
        COLLAGE_MESSAGES.DUPLICATES_WARNING || "Upozornění: Koláž obsahuje duplicitní obrázky.",
      );
    }

    loading = true;
    const startTotal = Date.now();
    abortController = new AbortController();

    try {
      const items = [];
      for (const item of collageItems) {
        items.push({
          // Use originalImageId from config (correct extension) if editing, otherwise use src
          imageId: item.originalImageId || item.data.src,
          id: item.data.id,
          crop: imageConfigs[item.uniqueId] || { x: 50, y: 50, scale: 1 },
        });
      }

      const normalizedWidth = getNormalizedBorderWidth();
      const payload: CollageRequest = {
        items,
        template: selectedTemplate,
        border: borderEnabled
          ? { width: normalizedWidth, color: borderColor, userSetting: borderWidth }
          : undefined,
        aspectRatio: selectedRatioPreset,
        // Metadata handled by backend mostly
      };

      const startAPI = Date.now();
      const res = await fetch("/api/images/collage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: abortController.signal,
      });

      if (!res.ok) {
        // Parse error body first if possible
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || COLLAGE_MESSAGES.OPERATION_FAILED);
      }

      const data = (await res.json()) as CollageResponse;
      log.debug(`[Collage] Doba volání API: ${Date.now() - startAPI}ms`);

      if (!data.success) {
        throw new Error(data.error || COLLAGE_MESSAGES.OPERATION_FAILED);
      }

      const outputPath = data.outputPath;
      const directUrl = outputPath
        ? new URL(`/${getContentDir()}/${outputPath}`, window.location.origin).href
        : null;

      toast.success(COLLAGE_MESSAGES.CREATED_SUCCESS(outputPath || ""), {
        duration: 10000,
        description: directUrl ? COLLAGE_MESSAGES.DIRECT_VIEW_HINT : undefined,
        action: directUrl
          ? {
              label: COLLAGE_MESSAGES.DIRECT_VIEW_ACTION,
              onClick: () => window.open(directUrl, "_blank", "noopener"),
            }
          : undefined,
      });

      try {
        localStorage.removeItem("collage-draft");
      } catch (e) {
        log.warn(`${COLLAGE_MESSAGES.OPERATION_FAILED}: ${String(e)}`);
      }

      // Only invalidate (reload page) when creating NEW collage
      // When editing, we just overwrote the file, no need to reload
      if (!isEditMode) {
        await invalidateAll();
      }

      log.info(`[Collage] Celkový čas na frontendu: ${Date.now() - startTotal}ms`);

      // Only close dialog when creating NEW collage, keep open when editing
      if (!isEditMode) {
        open = false;
      }
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") {
        toast.info(COLLAGE_MESSAGES.CANCELLED);
      } else {
        toast.error(e instanceof Error ? e.message : String(e));
      }
    } finally {
      loading = false;
      abortController = null;
    }
  }

  function handleOpenChange(newOpen: boolean) {
    if (!newOpen) {
      if (loading && abortController) {
        abortController.abort();
      }

      if (confirm(COLLAGE_MESSAGES.CLOSE_CONFIRM)) {
        // Reset state when user closes dialog
        collageItems = [];
        imageConfigs = {};
        selectedTemplate = "row";
        borderEnabled = true;
        borderWidth = 10;
        borderColor = "#ffffff";
        selectedRatioPreset = "auto";
        userPickedTemplate = false;
        draggedIndex = null;
        activeImageId = null;

        open = false;
      }
    } else {
      open = true;
    }
  }
</script>

{#snippet header()}
  <div class="flex items-center gap-4">
    <h2 class="text-lg font-semibold transform-none tracking-tight">{COLLAGE_MESSAGES.TITLE}</h2>
    <div class="h-6 w-px bg-white/20"></div>
    <div
      class="flex items-center gap-2 bg-white/5 p-1 rounded-lg"
      data-testid="collage-template-buttons"
    >
      {#each templates as t}
        {@const count = collageItems.length}
        {@const disabled = t.capacity !== Infinity && t.capacity !== count}

        <Button
          variant={selectedTemplate === t.id ? "secondary" : "outline"}
          class={cn(
            "relative flex items-center justify-center gap-1 p-0 transition-all",
            selectedTemplate === t.id
              ? "border-transparent bg-white/10 text-foreground ring-1 ring-white/20"
              : "border-white/10 text-muted-foreground hover:border-white/50 hover:bg-white/5",
          )}
          onclick={() => !disabled && handleTemplateSelect(t.id)}
          {disabled}
          title={disabled
            ? COLLAGE_MESSAGES.TOOLTIP_EXACT(t.capacity, count)
            : t.capacity === Infinity
              ? COLLAGE_MESSAGES.TOOLTIP_FLEXIBLE
              : COLLAGE_MESSAGES.TOOLTIP_REQUIRED(t.capacity)}
          data-testid={`collage-template-${t.id}`}
        >
          <CollageTemplateIcon template={t.id} className="w-12 h-12 opacity-90" />

          <span class="text-[12px] font-mono leading-none opacity-60">
            {t.capacity === Infinity ? "∞" : t.capacity}
          </span>
        </Button>
      {/each}
    </div>
  </div>

  <div class="mt-3 flex flex-wrap items-center gap-3 text-xs" data-testid="collage-ratio-controls">
    <span class="uppercase tracking-[0.3em] text-muted-foreground"
      >{COLLAGE_MESSAGES.RATIO_LABEL}</span
    >
    <ButtonGroup.Root aria-label={COLLAGE_MESSAGES.RATIO_GROUP_LABEL}>
      {#each ratioPresets as preset}
        <Button
          variant={selectedRatioPreset === preset.id ? "secondary" : "outline"}
          size="sm"
          onclick={function selectRatio() {
            handleRatioSelect(preset.id);
          }}
          data-testid={`collage-ratio-${preset.id.replace(":", "-")}`}
        >
          {preset.label}
        </Button>
      {/each}
    </ButtonGroup.Root>
  </div>
{/snippet}

{#snippet preview()}
  <div
    class="flex flex-1 flex-col gap-4 bg-neutral-900/50 relative overflow-hidden p-8 select-none"
    data-testid="collage-preview-area"
  >
    <div class="flex flex-1 w-full items-center justify-center min-h-55">
      <div
        class="shadow-lg transition-all duration-300 relative bg-white ring-1 ring-white/10"
        data-testid="collage-preview-canvas"
        style={`
           aspect-ratio: ${ratioValue};
           width: ${isLandscape ? "100%" : "auto"};
           height: ${isLandscape ? "auto" : "80vh"};
           max-width: 100%;
           max-height: 80vh;
           min-width: 260px;
           background-color: ${borderEnabled ? borderColor : "transparent"};
        `}
      >
        <div
          class="absolute top-3 left-3 z-20 rounded bg-black/70 px-3 py-1 text-[11px] leading-tight text-white"
          data-testid="collage-preview-info"
        >
          <div>
            {COLLAGE_MESSAGES.PREVIEW_INFO(layout.width, layout.height, selectedRatioPreset)}
          </div>
        </div>
        {#each layout.placements as p, i}
          {@const uniqueId = collageItems[i]?.uniqueId}
          {@const detailSource = getDetailSource(p.img)}
          <!-- svelte-ignore a11y_no_static_element_interactions -->
          <div
            class="absolute overflow-hidden group bg-neutral-800/80 transition-colors cursor-move"
            style={`
                left: ${p.left}%;
                top: ${p.top}%;
                width: ${p.width}%;
                height: ${p.height}%;
            `}
            onmousedown={function startPan(e) {
              if (uniqueId) handleMouseDown(e, uniqueId);
            }}
            onwheel={function zoom(e) {
              if (uniqueId) handleWheel(e, uniqueId);
            }}
            ondragover={(e) => handleDragOver(e, i)}
            ondrop={(e) => handleDrop(e, i)}
            data-testid={`collage-preview-placement-${uniqueId || `empty-${i}`}`}
          >
            {#if uniqueId}
              <!-- svelte-ignore a11y_missing_attribute -->
              <img
                src={detailSource?.path ?? p.img.adminThumbUrl ?? p.img.sources?.[0]?.path}
                class="w-full h-full object-cover block pointer-events-none will-change-transform"
                data-testid={`collage-preview-image-${uniqueId}`}
                style:object-position={`${imageConfigs[uniqueId]?.x ?? 50}% ${imageConfigs[uniqueId]?.y ?? 50}%`}
                style:transform-origin={`${imageConfigs[uniqueId]?.x ?? 50}% ${imageConfigs[uniqueId]?.y ?? 50}%`}
                style:transform={`scale(${imageConfigs[uniqueId]?.scale ?? 1})`}
              />
            {:else}
              <div
                class="w-full h-full flex items-center justify-center text-white/30 text-xs font-mono uppercase tracking-widest bg-white/5"
              >
                {COLLAGE_MESSAGES.EMPTY_SLOT}
              </div>
            {/if}

            <div
              class="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-2 pointer-events-none"
              data-testid={`collage-preview-overlay-${uniqueId}`}
            >
              <!-- svelte-ignore a11y_no_static_element_interactions -->
              <div
                class="p-2 rounded-full bg-white/20 hover:bg-white/40 backdrop-blur-sm cursor-grab active:cursor-grabbing text-white mb-1 pointer-events-auto"
                draggable="true"
                ondragstart={(e) => handleDragStart(e, i)}
                onmousedown={(e) => e.stopPropagation()}
              >
                <Move class="w-4 h-4" />
              </div>

              <span
                class="text-white font-mono text-xs font-bold drop-shadow-md pointer-events-none mt-1"
              >
                {i + 1}
              </span>
            </div>
          </div>
        {/each}
      </div>
    </div>
  </div>
{/snippet}

{#snippet imageList()}
  <div class="space-y-3 flex-1" data-testid="collage-images-list">
    <div class="flex items-center justify-between">
      <Label>{COLLAGE_MESSAGES.SELECTED_IMAGES(images.length)}</Label>
    </div>
    <div class="space-y-2">
      {#each images as img, i}
        {@const detailSource = getDetailSource(img)}
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <div
          class={cn(
            "flex items-center gap-3 p-2 bg-card cursor-grab active:cursor-grabbing hover:bg-accent/50 transition-colors",
            dragSourceType === "source" && draggedSourceIndex === i && "opacity-50",
          )}
          draggable="true"
          ondragstart={function startDrag(e) {
            handleSourceDragStart(e, i);
          }}
          data-testid={`collage-source-item-${img.id}`}
        >
          <div
            class="h-12 min-w-12 flex items-center justify-center overflow-hidden rounded bg-muted"
          >
            <img
              src={img.adminThumbUrl ?? img.sources?.[0]?.path}
              alt={img.id}
              class="h-full w-auto max-w-full pointer-events-none"
              style={`aspect-ratio: ${getImageAspectRatio(img)};`}
              data-testid={`collage-image-thumb-${img.id}`}
            />
          </div>
          <div class="flex-1 min-w-0 flex flex-col gap-0.5 text-[11px] text-muted-foreground">
            <span class="truncate font-semibold text-[12px] text-foreground">
              {img.title ?? img.alt ?? img.id}
            </span>
            <span class="truncate">
              {COLLAGE_MESSAGES.ORIGIN_LABEL}: {formatDimensionLabel(img.width, img.height)} • {formatRatioLabel(
                img.width,
                img.height,
              )}
            </span>
            {#if detailSource?.width && detailSource?.height}
              <span class="truncate">
                {COLLAGE_MESSAGES.DETAIL_LABEL}: {formatDimensionLabel(
                  detailSource.width,
                  detailSource.height,
                )} • {formatRatioLabel(detailSource.width, detailSource.height)}
              </span>
            {/if}
          </div>
        </div>
      {/each}
    </div>
  </div>
{/snippet}

{#snippet settings()}
  <div class="space-y-4 border-t pt-4" data-testid="collage-settings">
    <div class="flex items-center justify-between">
      <Label>{COLLAGE_MESSAGES.BORDER_LABEL}</Label>
      <Switch bind:checked={borderEnabled} data-testid="collage-border-toggle" />
    </div>

    {#if borderEnabled}
      <div class="grid gap-2" data-testid="collage-border-width">
        <Label>{COLLAGE_MESSAGES.BORDER_WIDTH_LABEL}</Label>
        <Input
          type="number"
          bind:value={borderWidth}
          min="0"
          step="10"
          data-testid="collage-border-width-input"
        />
        <span class="text-xs text-muted-foreground">
          {COLLAGE_MESSAGES.BORDER_WIDTH_HINT(getNormalizedBorderWidth())}
        </span>
      </div>
      <div class="grid gap-2" data-testid="collage-border-color">
        <Label>{COLLAGE_MESSAGES.BORDER_COLOR_LABEL}</Label>
        <div class="flex gap-2">
          <Input
            type="color"
            bind:value={borderColor}
            class="w-10 p-0.5 h-9"
            data-testid="collage-border-color-picker"
          />
          <Input
            type="text"
            bind:value={borderColor}
            class="flex-1 font-mono uppercase"
            data-testid="collage-border-color-input"
          />
        </div>
      </div>
    {/if}
  </div>

  <div class="pt-4 mt-auto" data-testid="collage-create-section">
    <Button
      class="w-full"
      size="lg"
      onclick={createCollage}
      disabled={loading}
      data-testid="collage-create-button"
    >
      {#if loading}
        {isEditMode ? COLLAGE_MESSAGES.SAVING : COLLAGE_MESSAGES.CREATING}
      {:else}
        {isEditMode ? COLLAGE_MESSAGES.SAVE_BUTTON : COLLAGE_MESSAGES.CREATE_BUTTON}
      {/if}
    </Button>
    <p class="text-[10px] text-muted-foreground mt-2 text-center">
      {COLLAGE_MESSAGES.CREATE_HINT}
    </p>
  </div>
{/snippet}

<Dialog.Root {open} onOpenChange={handleOpenChange}>
  <Dialog.Content
    class="sm:max-w-screen w-screen h-screen max-w-none m-0 rounded-none flex flex-col p-0 gap-0 overflow-hidden border-none bg-black/95 text-white"
    data-testid="collage-dialog-content"
  >
    <div
      class="border-b border-border/20 p-4 flex items-center justify-between bg-muted/10"
      data-testid="collage-dialog-header"
    >
      {@render header()}
    </div>

    <div class="flex flex-1 overflow-hidden gap-6">
      {@render preview()}

      <div
        class="w-78 border-l border-border/20 bg-background text-foreground p-4 flex flex-col gap-4 overflow-y-auto z-10"
        data-testid="collage-sidebar"
      >
        {@render imageList()}
        {@render settings()}
      </div>
    </div>
  </Dialog.Content>
</Dialog.Root>
