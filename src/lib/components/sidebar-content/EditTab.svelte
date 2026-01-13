<script lang="ts">
  import { canApplyClap } from "$shared/utils/strings";
  import Crop from "@lucide/svelte/icons/crop";
  import Info from "@lucide/svelte/icons/info";
  import LayoutGrid from "@lucide/svelte/icons/layout-grid";
  import { toast } from "svelte-sonner";

  import MetadataPasteDialog from "$lib/components/MetadataPasteDialog.svelte";
  import ClapEditor from "$lib/components/admin/ClapEditor.svelte";
  import CollageDialog from "$lib/components/admin/CollageDialog.svelte";
  import LoadingOverlay from "$lib/components/ui/LoadingOverlay.svelte";
  import { Button } from "$lib/components/ui/button";
  import { Label } from "$lib/components/ui/label";
  import { getContentDir } from "$lib/config";
  import { createLogger } from "$lib/logger";
  import * as m from "$lib/paraglide/messages";
  import { applyMetadataUpdates } from "$lib/shared/metadata-utils";
  import { editor } from "$lib/stores/editor.svelte";
  import { manifest } from "$lib/stores/manifest.svelte";
  import { metadataClipboard } from "$lib/stores/metadata-clipboard.svelte";
  import type { CollageRequest } from "$lib/types/collage";
  import type { ImageEntry, Separator } from "$lib/types/manifest";
  import { tracedFetch } from "$lib/utils/api";
  import {
    createSourceImagePlaceholders,
    isCollage,
    loadCollageConfig,
  } from "$lib/utils/collage-config";
  import { smartToast } from "$lib/utils/toasts";

  import { invalidateAll } from "$app/navigation";

  import GeoDataSection from "./GeoDataSection.svelte";
  import MetadataInputField from "./MetadataInputField.svelte";
  import SelectedImagesBadges from "./SelectedImagesBadges.svelte";

  const logger = createLogger("EditTab");

  type DisplayItem = ImageEntry | Separator;

  const initialData = {
    title: "",
    author: "",
    location: "",
    city: "",
    state: "",
    country: "",
    countryCode: "",
    caption: "",
    keywords: "",
    snapshotType: "none" as "none" | "author" | "others",
    releaseDate: "",
  };

  /**
   * Helper to parse UTC ISO string into Local Date and Time parts
   */
  function getLocalParts(iso: string) {
    if (!iso) return { date: "", time: "" };
    try {
      const d = new Date(iso);
      if (Number.isNaN(d.getTime())) return { date: "", time: "" };
      const pad = (n: number) => n.toString().padStart(2, "0");
      return {
        date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
        time: `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`,
      };
    } catch {
      return { date: "", time: "" };
    }
  }

  /**
   * Updates formData.releaseDate by combining local date and time parts into UTC ISO
   */
  function updateReleaseDateParts(type: "date" | "time", val: string) {
    const current = getLocalParts(formData.releaseDate);
    const newParts = { ...current, [type]: val };

    if (newParts.date && newParts.time) {
      const d = new Date(`${newParts.date}T${newParts.time}`);
      if (!Number.isNaN(d.getTime())) {
        handleFieldInput("releaseDate", d.toISOString());
      }
    } else if (formData.releaseDate) {
      // If one part is cleared but we had a value, what to do?
      // Keep it as is or clear? Let's clear if date is gone.
      if (!newParts.date) handleFieldInput("releaseDate", "");
    }
  }

  function handleResetReleaseDate() {
    if (!activeImage?.exif?.date) return;
    // activeImage.exif.date is typically UTC ISO. Just copy it directly.
    handleFieldInput("releaseDate", activeImage.exif.date);
  }

  type FormData = typeof initialData;

  let { items = [] } = $props<{ items: DisplayItem[] }>();

  let formData = $state<FormData>({ ...initialData });
  let releaseDateParts = $derived(getLocalParts(formData.releaseDate));
  let explicitClears = $state<Partial<Record<keyof FormData, boolean>>>({});
  let previousGeoValues = $state<Partial<FormData>>({});

  let imageIds = $derived(Array.from(editor.selection));
  let selectedImages = $derived(
    items.filter(
      (item: DisplayItem) =>
        (item.type === "image" ||
          item.type === "sequence" ||
          item.type === "sequence-member" ||
          item.type === "panorama" ||
          item.type === "collage") &&
        editor.selection.has(item.id),
    ) as ImageEntry[],
  );
  let activeImage = $derived(selectedImages.length === 1 ? selectedImages[0] : undefined);

  let affectedItemsCount = $derived.by(() => {
    let count = 0;
    const processedSequences = new Set<string>();

    for (const img of selectedImages) {
      if (img.sequenceInfo && img.sequenceInfo.total > 1) {
        const baseId = img.sequenceInfo.baseId;
        // Check if we already counted this sequence group
        // If multiple visible items belong to same sequence (rare but possible), we count the group only once
        // But we must subtract the *other* selected members from this group to avoid undercounting?
        // Actually, if we just want "Total Items Touched":
        if (!processedSequences.has(baseId)) {
          count += img.sequenceInfo.total;
          processedSequences.add(baseId);
        }
        // If we revisit the same sequence via another selected member, we do nothing (already added total)
      } else {
        count += 1;
      }
    }
    return count;
  });

  $effect(function updateFormOnSelectionChange() {
    if (imageIds.length > 0) {
      populateForm();
    } else {
      formData = { ...initialData };
      explicitClears = {};
      previousGeoValues = {};
    }
  });

  function populateForm() {
    explicitClears = {};
    previousGeoValues = {};
    const images = selectedImages;
    if (images.length === 0) return;

    const getCommon = (getter: (img: ImageEntry) => string | undefined): string | null => {
      const first = getter(images[0]) || "";
      for (let i = 1; i < images.length; i++) {
        if ((getter(images[i]) || "") !== first) return null;
      }
      return first;
    };

    formData.title = getCommon((i) => i.title) ?? "";
    formData.author = getCommon((i) => i.author) ?? "";
    formData.location = getCommon((i) => i.location) ?? "";
    formData.city = getCommon((i) => i.city) ?? "";
    formData.state = getCommon((i) => i.exif?.state) ?? "";
    formData.country = getCommon((i) => i.exif?.country) ?? "";
    formData.countryCode = getCommon((i) => i.exif?.countryCode) ?? "";
    formData.caption = getCommon((i) => i.caption) ?? "";
    formData.keywords = getCommon((i) => i.keywords?.join(", ")) ?? "";

    const commonReleaseDate = getCommon((i) => i.exif?.releaseDate || i.exif?.date);
    // Store as is (UTC ISO) or empty
    formData.releaseDate = commonReleaseDate || "";

    // Determine snapshot type from flags
    const getSnapshotType = (img: ImageEntry): "none" | "author" | "others" => {
      if (!img.flags) return "none";
      if (img.flags.includes("snapshot-author")) return "author";
      if (img.flags.includes("snapshot-others")) return "others";
      return "none";
    };

    const firstType = getSnapshotType(images[0]);
    let allSame = true;
    for (let i = 1; i < images.length; i++) {
      if (getSnapshotType(images[i]) !== firstType) {
        allSame = false;
        break;
      }
    }
    formData.snapshotType = allSame ? firstType : "none";
  }

  let isSaving = $state(false);

  function buildUpdates(data: FormData, clears: Partial<Record<string, boolean>>) {
    const getValue = (field: keyof FormData) => {
      if (clears[field]) return null;
      return data[field] === "" ? undefined : data[field];
    };

    // Build flags array based on snapshot type
    let flags: string[] | undefined;
    if (data.snapshotType === "author") {
      flags = ["snapshot-author"];
    } else if (data.snapshotType === "others") {
      flags = ["snapshot-others"];
    } else if (data.snapshotType === "none") {
      flags = []; // Explicitly clear flags
    }

    return {
      title: getValue("title"),
      author: getValue("author"),
      location: getValue("location"),
      city: getValue("city"),
      state: getValue("state"),
      country: getValue("country"),
      countryCode: getValue("countryCode"),
      caption: getValue("caption"),
      releaseDate: getValue("releaseDate"), // Already ISO string
      keywords: clears.keywords
        ? null
        : data.keywords === ""
          ? undefined
          : data.keywords
              ?.split(",")
              .map(function trimKeyword(k) {
                return k.trim();
              })
              .filter(Boolean),
      flags,
    };
  }

  async function handleSubmit() {
    if (editor.selection.size === 0) return;

    isSaving = true;
    const updates = buildUpdates(formData, explicitClears);

    for (const img of selectedImages) {
      applyMetadataUpdates(img, updates);
    }

    try {
      const payload = {
        images: selectedImages.map((img) => ({ id: img.id, src: img.src })),
        updates,
      };

      const res = await tracedFetch("/api/images", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.message || m.image_metadata_update_failed());
      }

      const responseData = await res.json();

      if (responseData.updatedImages && Array.isArray(responseData.updatedImages)) {
        for (const updatedImg of responseData.updatedImages) {
          const localImg = selectedImages.find((i) => i.id === updatedImg.id);
          if (localImg) {
            Object.assign(localImg, updatedImg);
            if (updatedImg.exif && localImg.exif) {
              Object.assign(localImg.exif, updatedImg.exif);
            }
          }
        }
      }

      toast.success(m.image_imagesaved({ count: imageIds.length }));

      // If server returned fresh photoDays (e.g. after releaseDate change),
      // update the manifest store for smooth re-render without full page reload.
      if (responseData.photoDays && Array.isArray(responseData.photoDays)) {
        manifest.update({ photoDays: responseData.photoDays });
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toast.error(msg);
      invalidateAll();
    } finally {
      isSaving = false;
    }
  }

  function handleFieldInput(field: keyof FormData, value: string) {
    (formData as Record<string, unknown>)[field] = value;
    if (explicitClears[field]) {
      explicitClears[field] = false;
    }
  }

  function handleFieldClear(field: keyof FormData) {
    (formData as Record<string, unknown>)[field] = "";
    explicitClears[field] = true;
  }

  // Geo-specific handlers
  let isFetchingGeo = $state(false);

  function restoreGeoValue(field: keyof FormData) {
    const prevValue = previousGeoValues[field];
    if (prevValue !== undefined) {
      (formData as Record<string, unknown>)[field] = prevValue;
      explicitClears[field] = !formData[field];
      const newPrev = { ...previousGeoValues };
      delete newPrev[field];
      previousGeoValues = newPrev;
    }
  }

  async function handleFetchGeoData() {
    if (!activeImage?.exif?.latitude || !activeImage?.exif?.longitude) {
      toast.error(m.image_no_gps_coordinates());
      return;
    }

    isFetchingGeo = true;
    try {
      const { latitude, longitude } = activeImage.exif;
      const res = await fetch(`/api/geocode?lat=${latitude}&lng=${longitude}`);

      if (!res.ok) throw new Error(m.image_map_fetch_failed());

      const data = await res.json();
      const snapshot = { ...formData };
      const newPrevious: typeof previousGeoValues = {};

      const applyField = (field: keyof FormData, value: string | undefined) => {
        if (explicitClears[field]) return;
        if (value && value !== snapshot[field]) {
          (newPrevious as Record<string, unknown>)[field] = snapshot[field];
          (formData as Record<string, unknown>)[field] = value;
          explicitClears[field] = false;
        }
      };

      applyField("city", data.city);
      applyField("state", data.state);
      applyField("country", data.country);
      applyField("countryCode", data.countryCode);
      applyField("location", data.location);

      previousGeoValues = newPrevious;

      if (Object.keys(newPrevious).length > 0) {
        toast.success(m.image_geo_data_loaded());
      } else {
        toast.info(m.image_geo_data_same());
      }
    } catch (e) {
      logger.error({ err: e }, "Failed to fetch geo data");
      toast.error(m.image_geo_fetch_failed());
    } finally {
      isFetchingGeo = false;
    }
  }

  // Paste handlers
  let isPasteDialogOpen = $state(false);
  let isApplyingPaste = $state(false);

  let isClapEditorOpen = $state(false);
  // Collage handler
  let isCollageDialogOpen = $state(false);
  let collageSourceImages = $state<ImageEntry[]>([]);
  let existingCollageConfig = $state<CollageRequest | undefined>(undefined);

  // Clear collage state when dialog closes to ensure fresh data on next open
  $effect(() => {
    if (!isCollageDialogOpen) {
      collageSourceImages = [];
      existingCollageConfig = undefined;
    }
  });

  async function handleOpenCollageDialog() {
    const selected = selectedImages;

    // Check if single selection is a collage for re-edit
    if (selected.length === 1 && isCollage(selected[0].id)) {
      try {
        const config = await loadCollageConfig(selected[0].id);

        if (!config) {
          toast.error(m.collage_load_config_failed());
          return;
        }

        // For collages, source images have been moved to collage-sources/
        // and removed from the manifest. We need to create placeholders.
        const urlPrefix = `/${getContentDir()}`;
        const placeholders = await createSourceImagePlaceholders(config, urlPrefix);

        if (placeholders.length !== config.items.length) {
          toast.error(m.collage_source_images_not_found());
          logger.error(
            `[Collage] Created ${placeholders.length} placeholders but config has ${config.items.length} items`,
          );
          return;
        }

        collageSourceImages = placeholders;
        existingCollageConfig = config;
      } catch (e) {
        toast.error(m.collage_loadfailed({ err: String(e) }));
        return;
      }
    } else {
      // Create new collage
      collageSourceImages = selected;
      existingCollageConfig = undefined;
    }

    isCollageDialogOpen = true;
  }

  function handlePasteMetadata() {
    if (!metadataClipboard.data) {
      toast.error(m.image_no_clipboard_data());
      return;
    }
    isPasteDialogOpen = true;
  }

  async function confirmPaste(fieldsToApply: Record<string, boolean>) {
    const clipboard = metadataClipboard;
    if (!clipboard.data || imageIds.length === 0) return;

    isApplyingPaste = true;

    const performOperation = async () => {
      const data = clipboard.data;
      if (!data) return;
      const getVal = (field: keyof FormData) =>
        fieldsToApply[field] && data?.[field] ? (data[field] as string) : undefined;

      const updates: ReturnType<typeof buildUpdates> = {
        title: getVal("title"),
        author: getVal("author"),
        location: getVal("location"),
        city: getVal("city"),
        state: getVal("state"),
        country: getVal("country"),
        countryCode: getVal("countryCode"),
        caption: getVal("caption"),
        keywords: fieldsToApply.keywords && data.keywords?.length ? data.keywords : undefined,
        flags: undefined,
        releaseDate: undefined,
      };

      const payload = {
        images: selectedImages.map((img) => ({ id: img.id, src: img.src })),
        updates,
      };

      const res = await tracedFetch("/api/images", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || m.image_metadata_paste_failed());
      }

      for (const img of selectedImages) {
        applyMetadataUpdates(img, updates);
      }

      isPasteDialogOpen = false;
    };

    const promise = performOperation();

    smartToast(promise, {
      loading: m.image_applying_metadata_paste(),
      success: m.image_metadata_pasted(),
      error: (e) =>
        m.image_errortitle({ msg: e instanceof Error ? e.message : m.image_unknown_error() }),
      delay: 500,
    });

    try {
      await promise;
    } catch (e) {
      logger.error({ err: e }, "Failed to paste metadata");
      invalidateAll();
    } finally {
      isApplyingPaste = false;
    }
  }
</script>

<div class="relative flex h-full flex-col" data-testid="edit-tab">
  <LoadingOverlay visible={isSaving} label={m.image_saving_metadata()} />

  <MetadataPasteDialog
    bind:open={isPasteDialogOpen}
    clipboardData={metadataClipboard.data}
    onConfirm={confirmPaste}
  />

  <ClapEditor bind:open={isClapEditorOpen} image={activeImage} />

  <CollageDialog
    bind:open={isCollageDialogOpen}
    images={collageSourceImages}
    existingConfig={existingCollageConfig}
  />

  {#if import.meta.env.DEV && (selectedImages.length >= 2 || (selectedImages.length === 1 && isCollage(selectedImages[0].id)))}
    {@const isEditMode = selectedImages.length === 1 && isCollage(selectedImages[0].id)}
    <div class="px-4 pt-2">
      <Button variant="outline" class="w-full gap-2" onclick={handleOpenCollageDialog}>
        <LayoutGrid class="size-4" strokeWidth={2.5} />
        {#if isEditMode}
          {m.collage_edit_button()}
        {:else}
          {m.collage_createtriggerbutton({ count: selectedImages.length })}
        {/if}
      </Button>
    </div>
  {/if}

  {#if import.meta.env.DEV && selectedImages.length === 1 && canApplyClap(selectedImages[0])}
    <div class="px-4 pt-2">
      <Button variant="outline" class="w-full gap-2" onclick={() => (isClapEditorOpen = true)}>
        <Crop class="size-4" strokeWidth={2.5} />
        {m.ui_edit_crop()}
      </Button>
    </div>
  {/if}

  <SelectedImagesBadges
    images={selectedImages}
    hasClipboardData={!!metadataClipboard.data}
    onRemove={(id) => editor.toggleSelection(id)}
    onClearAll={() => editor.clearSelection()}
    onPaste={handlePasteMetadata}
  />

  {#if affectedItemsCount > selectedImages.length}
    <div class="px-6 py-2">
      <div
        class="flex items-center gap-2 rounded-md bg-blue-50 p-2 text-sm text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
      >
        <Info class="size-4 shrink-0" strokeWidth={2.5} />
        <span>
          {@html m.ui_selection_contains_groups({ count: affectedItemsCount })}
        </span>
      </div>
    </div>
  {/if}

  <form
    method="POST"
    class="grid gap-4 px-6 py-4"
    onsubmit={(e) => {
      e.preventDefault();
      handleSubmit();
    }}
  >
    <div class="space-y-1">
      <Label>{m.image_field_release_date()}</Label>
      <div class="flex flex-col gap-1">
        <div class="flex gap-2">
          <input
            type="date"
            class="border-input placeholder:text-muted-foreground focus-visible:ring-ring flex h-9 w-full rounded-md border bg-transparent px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium focus-visible:ring-1 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
            value={releaseDateParts.date}
            oninput={(e) => updateReleaseDateParts("date", e.currentTarget.value)}
          />
          <input
            type="time"
            step="1"
            class="border-input placeholder:text-muted-foreground focus-visible:ring-ring flex h-9 w-32 rounded-md border bg-transparent px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium focus-visible:ring-1 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
            value={releaseDateParts.time}
            oninput={(e) => updateReleaseDateParts("time", e.currentTarget.value)}
          />
        </div>
        {#if activeImage?.exif?.date}
          <div class="text-muted-foreground flex items-center gap-2 text-xs">
            <span>{m.ui_original_exif()}</span>
            <button
              type="button"
              class="hover:text-foreground cursor-pointer underline"
              onclick={handleResetReleaseDate}
              title={m.aria_use_original_time()}
              aria-label={m.aria_use_original_time()}
            >
              {new Date(activeImage.exif.date).toLocaleString()}
            </button>
          </div>
        {/if}
      </div>
    </div>
    <MetadataInputField
      label={m.image_label_caption()}
      name="caption"
      type="textarea"
      value={formData.caption}
      onInput={(v) => handleFieldInput("caption", v)}
      onClear={() => handleFieldClear("caption")}
      isCleared={explicitClears.caption}
    />

    <GeoDataSection
      location={formData.location}
      city={formData.city}
      state={formData.state}
      country={formData.country}
      countryCode={formData.countryCode}
      previousValues={previousGeoValues}
      clearedFields={explicitClears}
      onFieldInput={handleFieldInput}
      onFieldClear={handleFieldClear}
      onRestore={restoreGeoValue}
      onFetchGeo={handleFetchGeoData}
      isFetching={isFetchingGeo}
      hasGpsCoords={!!activeImage?.exif?.latitude}
      googleMapsUrl={activeImage?.googleMapsUrl}
    />

    <MetadataInputField
      label={m.image_label_title()}
      name="title"
      value={formData.title}
      onInput={(v) => handleFieldInput("title", v)}
      onClear={() => handleFieldClear("title")}
      isCleared={explicitClears.title}
    />

    <MetadataInputField
      label={m.image_label_author()}
      name="author"
      value={formData.author}
      onInput={(v) => handleFieldInput("author", v)}
      onClear={() => handleFieldClear("author")}
      isCleared={explicitClears.author}
    />

    <MetadataInputField
      label={m.image_label_keywords()}
      name="keywords"
      value={formData.keywords}
      placeholder={m.image_keywords_placeholder()}
      onInput={function handleKeywordsInput(v) {
        handleFieldInput("keywords", v);
      }}
      onClear={function handleKeywordsClear() {
        handleFieldClear("keywords");
      }}
      isCleared={explicitClears.keywords}
    />

    <div class="grid gap-2">
      <Label for="snapshot-type" class="text-sm font-medium">{m.ui_photo_type()}</Label>
      <select
        id="snapshot-type"
        class="border-input placeholder:text-muted-foreground focus-visible:ring-ring flex h-9 w-full rounded-md border bg-transparent px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium focus-visible:ring-1 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
        value={formData.snapshotType}
        onchange={function handleSnapshotChange(e) {
          formData.snapshotType = e.currentTarget.value as "none" | "author" | "others";
        }}
        data-testid="edit-tab-snapshot-type"
      >
        <option value="none">{m.ui_regular_photo()}</option>
        <option value="author">{m.image_flag_snapshot()}</option>
        <option value="others">{m.image_flag_others()}</option>
      </select>
      <p class="text-muted-foreground text-xs">
        {m.image_flag_others_hint()}
      </p>
    </div>

    <div class="mt-auto flex justify-end pt-4">
      <Button class="w-full" size="lg" type="submit" data-testid="edit-tab-submit-button">
        {m.image_save_changes()}
      </Button>
    </div>
  </form>
</div>
