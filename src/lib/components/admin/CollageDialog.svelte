<script lang="ts">
  import { ArrowDown, ArrowUp, Columns, LayoutGrid, Rows } from "@lucide/svelte";
  import { toast } from "svelte-sonner";

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
    calculateNormalizedBorderWidth,
    determineAutoTemplate,
    formatDimensionLabel,
    formatRatioLabel,
    getDetailSource,
    getImageAspectRatio,
    parsePresetRatio,
  } from "$lib/utils/collage";
  import { COLLAGE_MESSAGES } from "$lib/utils/messages";

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
    label: string;
    icon: any;
    min: number;
    columns: number;
    rows: number;
  }[] = [
    { id: "row", label: COLLAGE_MESSAGES.TEMPLATE_ROW, icon: Columns, min: 2, columns: 2, rows: 1 },
    {
      id: "column",
      label: COLLAGE_MESSAGES.TEMPLATE_COLUMN,
      icon: Rows,
      min: 2,
      columns: 1,
      rows: 2,
    },
    {
      id: "grid-2x2",
      label: COLLAGE_MESSAGES.TEMPLATE_GRID,
      icon: LayoutGrid,
      min: 4,
      columns: 2,
      rows: 2,
    },
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

  // State
  let orderedImages = $state<ImageEntry[]>([]);
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

  // Init effects
  $effect(function initOrderedImages() {
    if (open) {
      // If existingConfig provided, load it for re-editing
      if (existingConfig) {
        selectedTemplate = existingConfig.template;
        if (existingConfig.border) {
          borderEnabled = true;
          borderWidth = existingConfig.border.width;
          borderColor = existingConfig.border.color;
        } else {
          borderEnabled = false;
        }

        // Load image configs (crop data)
        const configs: Record<string, CollageCrop> = {};
        for (const item of existingConfig.items) {
          if (item.crop) {
            configs[item.imageId] = item.crop;
          }
        }
        imageConfigs = configs;

        // Load aspect ratio if saved
        if (existingConfig.aspectRatio) {
          selectedRatioPreset = existingConfig.aspectRatio as RatioPresetId;
        }

        // Ensure images are set to orderedImages even for existing config
        orderedImages = [...images];
      } else if (orderedImages.length === 0 && images.length > 0) {
        // Try to restore draft
        try {
          const draftJson = localStorage.getItem("collage-draft");
          if (draftJson) {
            const draft = JSON.parse(draftJson);

            // Restore settings
            selectedTemplate = draft.selectedTemplate || "row";
            borderEnabled = draft.borderEnabled ?? true;
            borderWidth = draft.borderWidth || 10;
            borderColor = draft.borderColor || "#ffffff";
            selectedRatioPreset = draft.selectedRatioPreset || "auto";
            imageConfigs = draft.imageConfigs || {};

            // Restore order if possible
            if (draft.orderedImageIds && draft.orderedImageIds.length > 0) {
              const restored = [];
              for (const id of draft.orderedImageIds) {
                const img = images.find(function matchId(i) {
                  return i.id === id;
                });
                if (img) restored.push(img);
              }

              if (restored.length > 0) {
                orderedImages = restored;
                toast.success(COLLAGE_MESSAGES.RESTORED_DRAFT);
              } else {
                orderedImages = [...images];
              }
            } else {
              orderedImages = [...images];
            }
          } else {
            orderedImages = [...images];
          }
        } catch (e) {
          log.warn(`Nepodařilo se obnovit koncept: ${String(e)}`);
          orderedImages = [...images];
        }
      }
    }
  });

  $effect(function initImageConfigs() {
    const newConfigs = { ...imageConfigs };
    let changed = false;

    for (const img of orderedImages) {
      if (!newConfigs[img.id]) {
        newConfigs[img.id] = { x: 50, y: 50, scale: 1 };
        changed = true;
      }
    }

    if (changed) {
      imageConfigs = newConfigs;
    }
  });

  $effect(function autoSelectTemplate() {
    if (orderedImages.length === 0) return;
    if (aspectMode === "auto" && !userPickedTemplate) {
      selectedTemplate = determineAutoTemplate(orderedImages);
      return;
    }
    if (!userPickedTemplate) {
      selectedTemplate = aspectMode === "portrait" ? "column" : "row";
    }
  });

  // Derived state
  function getNormalizedBorderWidth() {
    return calculateNormalizedBorderWidth(borderWidth, orderedImages);
  }

  let layout = $derived(
    calculateCollageLayout(
      orderedImages,
      selectedTemplate,
      borderEnabled ? getNormalizedBorderWidth() : 0,
    ),
  );

  // Auto-save to localStorage (draft)
  $effect(function autoSaveCollageDraft() {
    if (!open || orderedImages.length === 0) return;

    const draft = {
      orderedImageIds: orderedImages.map(function getId(img) {
        return img.id;
      }),
      imageConfigs,
      selectedTemplate,
      borderEnabled,
      borderWidth,
      borderColor,
      selectedRatioPreset,
    };

    try {
      localStorage.setItem("collage-draft", JSON.stringify(draft));
    } catch (e) {
      log.warn(`Nepodařilo se uložit koncept koláže: ${String(e)}`);
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

  function moveImage(index: number, direction: -1 | 1) {
    const newOrder = [...orderedImages];
    const targetIndex = index + direction;
    if (targetIndex >= 0 && targetIndex < newOrder.length) {
      [newOrder[index], newOrder[targetIndex]] = [newOrder[targetIndex], newOrder[index]];
      orderedImages = newOrder;
    }
  }

  function handleDragStart(e: DragEvent, index: number) {
    draggedIndex = index;
    if (e.dataTransfer) {
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.dropEffect = "move";
    }
  }

  function handleDragOver(e: DragEvent, index: number) {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) return;
    if (e.dataTransfer) e.dataTransfer.dropEffect = "move";
  }

  function handleDrop(e: DragEvent, dropIndex: number) {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === dropIndex) return;

    const newOrder = [...orderedImages];
    const [item] = newOrder.splice(draggedIndex, 1);
    newOrder.splice(dropIndex, 0, item);
    orderedImages = newOrder;
    draggedIndex = null;
  }

  function handleMouseDown(e: MouseEvent, id: string) {
    e.preventDefault();
    activeImageId = id;
    startX = e.clientX;
    startY = e.clientY;
    window.addEventListener("mousemove", handleGlobalMouseMove);
    window.addEventListener("mouseup", handleGlobalMouseUp);
  }

  function handleGlobalMouseMove(e: MouseEvent) {
    if (!activeImageId || !imageConfigs[activeImageId]) return;

    const conf = imageConfigs[activeImageId];
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;
    const factor = 0.2 / conf.scale;

    const newX = Math.max(0, Math.min(100, conf.x - dx * factor));
    const newY = Math.max(0, Math.min(100, conf.y - dy * factor));

    // Trigger reactivity by reassigning
    imageConfigs = {
      ...imageConfigs,
      [activeImageId]: { ...conf, x: newX, y: newY },
    };

    startX = e.clientX;
    startY = e.clientY;
  }

  function handleGlobalMouseUp() {
    activeImageId = null;
    window.removeEventListener("mousemove", handleGlobalMouseMove);
    window.removeEventListener("mouseup", handleGlobalMouseUp);
  }

  function handleWheel(e: WheelEvent, id: string) {
    if (!imageConfigs[id]) return;
    e.preventDefault();
    e.stopPropagation();

    const conf = imageConfigs[id];
    const delta = -Math.sign(e.deltaY) * 0.1;
    const newScale = Math.max(1, Math.min(5, conf.scale + delta));

    // Trigger reactivity
    imageConfigs = {
      ...imageConfigs,
      [id]: { ...conf, scale: newScale },
    };
  }

  async function createCollage() {
    if (orderedImages.length < 2) return;

    loading = true;
    const startTotal = Date.now();

    try {
      const items = [];
      for (const img of orderedImages) {
        items.push({
          imageId: img.src, // Actual file path for backend processing
          id: img.id, // Image ID from manifest for re-edit correlation
          crop: imageConfigs[img.id] || { x: 50, y: 50, scale: 1 },
        });
      }

      const normalizedWidth = getNormalizedBorderWidth();
      const payload: CollageRequest = {
        items,
        template: selectedTemplate,
        border: borderEnabled ? { width: normalizedWidth, color: borderColor } : undefined,
        aspectRatio: selectedRatioPreset,
      };

      const startAPI = Date.now();
      const res = await fetch("/api/images/collage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = (await res.json()) as CollageResponse;
      log.debug(`[Collage] Doba volání API: ${Date.now() - startAPI}ms`);

      if (!res.ok || !data.success) {
        throw new Error(data.error || COLLAGE_MESSAGES.OPERATION_FAILED);
      }

      // Build direct URL to the static file (no query params)
      const contentDir = getContentDir();
      const collageUrl = `/${contentDir}/${data.outputPath}`;

      // Auto-open in new tab
      window.open(collageUrl, "_blank");

      // Show simple success toast (10s duration)
      toast.success(COLLAGE_MESSAGES.CREATED_SUCCESS(data.outputPath || ""), {
        duration: 10000,
      });

      // Clear draft on success
      try {
        localStorage.removeItem("collage-draft");
      } catch (e) {
        log.warn(`Nepodařilo se smazat koncept: ${String(e)}`);
      }

      log.info(`[Collage] Celkový čas na frontendu: ${Date.now() - startTotal}ms`);
      open = false;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      loading = false;
    }
  }

  function handleOpenChange(newOpen: boolean) {
    if (!newOpen) {
      if (confirm(COLLAGE_MESSAGES.CLOSE_CONFIRM)) {
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
        <Button
          variant={selectedTemplate === t.id ? "secondary" : "outline"}
          class={cn(
            "relative flex flex-col items-start gap-1 h-auto px-3 py-2 text-left text-sm transition-all",
            selectedTemplate === t.id
              ? "border-transparent bg-white/10 text-foreground"
              : "border-white/10 text-muted-foreground hover:border-white/50",
          )}
          onclick={function selectTemplate() {
            handleTemplateSelect(t.id);
          }}
          disabled={orderedImages.length < t.min}
          title={orderedImages.length < t.min ? COLLAGE_MESSAGES.MIN_IMAGES_HINT(t.min) : ""}
          data-testid={`collage-template-${t.id}`}
        >
          <div class="flex items-center gap-2">
            <t.icon class="w-4 h-4" />
            <div class="flex flex-col leading-tight">
              <span class="text-[10px] uppercase text-muted-foreground">
                {t.columns} × {t.rows}
              </span>
              <span>{t.label}</span>
            </div>
          </div>
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
           aspect-ratio: ${selectedRatioPreset === "auto" ? `${layout.width} / ${layout.height}` : `${parsePresetRatio(selectedRatioPreset).width} / ${parsePresetRatio(selectedRatioPreset).height}`};
           width: 100%;
           height: auto;
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
        {#each layout.placements as p}
          {@const detailSource = getDetailSource(p.img)}
          <!-- svelte-ignore a11y_no_static_element_interactions -->
          <div
            class="absolute overflow-hidden group bg-neutral-800 cursor-move"
            style={`
                left: ${p.left}%;
                top: ${p.top}%;
                width: ${p.width}%;
                height: ${p.height}%;
            `}
            onmousedown={function startPan(e) {
              handleMouseDown(e, p.img.id);
            }}
            onwheel={function zoom(e) {
              handleWheel(e, p.img.id);
            }}
            data-testid={`collage-preview-placement-${p.img.id}`}
          >
            <!-- svelte-ignore a11y_missing_attribute -->
            <img
              src={detailSource?.path ?? p.img.adminThumbUrl ?? p.img.sources?.[0]?.path}
              class="w-full h-full object-cover block pointer-events-none will-change-transform"
              data-testid={`collage-preview-image-${p.img.id}`}
              style:object-position={`${imageConfigs[p.img.id]?.x ?? 50}% ${imageConfigs[p.img.id]?.y ?? 50}%`}
              style:transform={`scale(${imageConfigs[p.img.id]?.scale ?? 1})`}
            />

            <div
              class="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white font-mono text-xs pointer-events-none transition-opacity"
              data-testid={`collage-preview-overlay-${p.img.id}`}
            >
              {orderedImages.indexOf(p.img) + 1}
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
      <Label>{COLLAGE_MESSAGES.SELECTED_IMAGES(orderedImages.length)}</Label>
    </div>
    <div class="space-y-2">
      {#each orderedImages as img, i}
        {@const detailSource = getDetailSource(img)}
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <div
          class={cn(
            "flex items-center gap-3 p-2 rounded border bg-card cursor-grab active:cursor-grabbing",
            draggedIndex === i && "opacity-50 dashed border-primary",
          )}
          draggable="true"
          ondragstart={function startDrag(e) {
            handleDragStart(e, i);
          }}
          ondragover={function dragOver(e) {
            handleDragOver(e, i);
          }}
          ondrop={function drop(e) {
            handleDrop(e, i);
          }}
          data-testid={`collage-image-item-${img.id}`}
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
          <div class="flex flex-col gap-0.5" data-testid={`collage-image-controls-${img.id}`}>
            <Button
              variant="ghost"
              size="icon"
              class="h-5 w-5"
              disabled={i === 0}
              onclick={function moveUp() {
                moveImage(i, -1);
              }}
              title={COLLAGE_MESSAGES.MOVE_UP}
              data-testid={`collage-move-up-${img.id}`}
            >
              <ArrowUp class="w-3 h-3" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              class="h-5 w-5"
              disabled={i === orderedImages.length - 1}
              onclick={function moveDown() {
                moveImage(i, 1);
              }}
              title={COLLAGE_MESSAGES.MOVE_DOWN}
              data-testid={`collage-move-down-${img.id}`}
            >
              <ArrowDown class="w-3 h-3" />
            </Button>
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
        {COLLAGE_MESSAGES.CREATING}
      {:else}
        {COLLAGE_MESSAGES.CREATE_BUTTON}
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
        class="w-96 border-l border-border/20 bg-background text-foreground p-4 flex flex-col gap-4 overflow-y-auto z-10"
        data-testid="collage-sidebar"
      >
        {@render imageList()}
        {@render settings()}
      </div>
    </div>
  </Dialog.Content>
</Dialog.Root>
