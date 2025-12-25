<script lang="ts">
  import { fade } from "svelte/transition";
  import { toast } from "svelte-sonner";
  import { invalidateAll } from "$app/navigation";
  import MetadataPasteDialog from "$lib/components/MetadataPasteDialog.svelte";
  import { Button } from "$lib/components/ui/button";
  import { Spinner } from "$lib/components/ui/spinner";
  import { createLogger } from "$lib/logger";
  import { applyMetadataUpdates } from "$lib/shared/metadata-utils";
  import { editor } from "$lib/stores/editor.svelte";
  import { metadataClipboard } from "$lib/stores/metadata-clipboard.svelte";
  import type { ImageEntry, Separator } from "$lib/types/manifest";
  import { IMAGE_MESSAGES } from "$lib/utils/messages";

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
  };

  type FormData = typeof initialData;

  let { items = [] } = $props<{ items: DisplayItem[] }>();

  let formData = $state<FormData>({ ...initialData });
  let explicitClears = $state<Partial<Record<keyof FormData, boolean>>>({});
  let previousGeoValues = $state<Partial<FormData>>({});

  let imageIds = $derived(Array.from(editor.selection));
  let selectedImages = $derived(
    items.filter(
      (item: DisplayItem) => item.type === "image" && editor.selection.has(item.id),
    ) as ImageEntry[],
  );
  let activeImage = $derived(selectedImages.length === 1 ? selectedImages[0] : null);

  $effect(() => {
    if (imageIds.length > 0) {
      populateForm();
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

    formData.title = getCommon((i) => i.exif?.title) ?? "";
    formData.author = getCommon((i) => i.author) ?? "";
    formData.location = getCommon((i) => i.location) ?? "";
    formData.city = getCommon((i) => i.city) ?? "";
    formData.state = getCommon((i) => i.exif?.state) ?? "";
    formData.country = getCommon((i) => i.exif?.country) ?? "";
    formData.countryCode = getCommon((i) => i.exif?.countryCode) ?? "";
    formData.caption = getCommon((i) => i.caption) ?? "";
    formData.keywords = getCommon((i) => i.keywords?.join(", ")) ?? "";
  }

  let isSaving = $state(false);

  function buildUpdates(data: FormData, clears: Partial<Record<string, boolean>>) {
    const getValue = (field: keyof FormData) => {
      if (clears[field]) return null;
      return data[field] === "" ? undefined : data[field];
    };

    return {
      title: getValue("title"),
      author: getValue("author"),
      location: getValue("location"),
      city: getValue("city"),
      state: getValue("state"),
      country: getValue("country"),
      countryCode: getValue("countryCode"),
      caption: getValue("caption"),
      keywords: clears.keywords
        ? null
        : data.keywords === ""
          ? undefined
          : data.keywords
              ?.split(",")
              .map((k) => k.trim())
              .filter(Boolean),
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

      const res = await fetch("/api/images", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.message || "Nepodařilo se aktualizovat metadata");
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

      toast.success(IMAGE_MESSAGES.imageSaved(imageIds.length));
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toast.error(msg);
      invalidateAll();
    } finally {
      isSaving = false;
    }
  }

  function handleFieldInput(field: keyof FormData, value: string) {
    formData[field] = value;
    if (explicitClears[field]) {
      explicitClears[field] = false;
    }
  }

  function handleFieldClear(field: keyof FormData) {
    formData[field] = "";
    explicitClears[field] = true;
  }

  // Geo-specific handlers
  let isFetchingGeo = $state(false);

  function restoreGeoValue(field: keyof FormData) {
    const prevValue = previousGeoValues[field];
    if (prevValue !== undefined) {
      formData[field] = prevValue;
      explicitClears[field] = !formData[field];
      const newPrev = { ...previousGeoValues };
      delete newPrev[field];
      previousGeoValues = newPrev;
    }
  }

  async function handleFetchGeoData() {
    if (!activeImage?.exif?.latitude || !activeImage?.exif?.longitude) {
      toast.error(IMAGE_MESSAGES.NO_GPS_COORDINATES);
      return;
    }

    isFetchingGeo = true;
    try {
      const { latitude, longitude } = activeImage.exif;
      const res = await fetch(`/api/geocode?lat=${latitude}&lng=${longitude}`);

      if (!res.ok) throw new Error("Nepodařilo se načíst data z mapy.");

      const data = await res.json();
      const snapshot = { ...formData };
      const newPrevious: typeof previousGeoValues = {};

      const applyField = (field: keyof FormData, value: string | undefined) => {
        if (explicitClears[field]) return;
        if (value && value !== snapshot[field]) {
          newPrevious[field] = snapshot[field];
          formData[field] = value;
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
        toast.success(IMAGE_MESSAGES.GEO_DATA_LOADED);
      } else {
        toast.info(IMAGE_MESSAGES.GEO_DATA_SAME);
      }
    } catch (e) {
      logger.error(e);
      toast.error(IMAGE_MESSAGES.GEO_FETCH_FAILED);
    } finally {
      isFetchingGeo = false;
    }
  }

  // Paste handlers
  let isPasteDialogOpen = $state(false);
  let isApplyingPaste = $state(false);

  function handlePasteMetadata() {
    if (!metadataClipboard.data) {
      toast.error(IMAGE_MESSAGES.NO_CLIPBOARD_DATA);
      return;
    }
    isPasteDialogOpen = true;
  }

  async function confirmPaste(fieldsToApply: Record<string, boolean>) {
    const clipboard = metadataClipboard;
    if (!clipboard.data || imageIds.length === 0) return;

    isApplyingPaste = true;
    try {
      const getVal = (field: keyof FormData) =>
        fieldsToApply[field] && clipboard.data?.[field]
          ? (clipboard.data[field] as string)
          : undefined;

      const updates: ReturnType<typeof buildUpdates> = {
        title: getVal("title"),
        author: getVal("author"),
        location: getVal("location"),
        city: getVal("city"),
        state: getVal("state"),
        country: getVal("country"),
        countryCode: getVal("countryCode"),
        caption: getVal("caption"),
        keywords:
          fieldsToApply.keywords && clipboard.data.keywords?.length
            ? clipboard.data.keywords
            : undefined,
      };

      const payload = {
        images: selectedImages.map((img) => ({ id: img.id, src: img.src })),
        updates,
      };

      const res = await fetch("/api/images", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Chyba při ukládání metadata");
      }

      for (const img of selectedImages) {
        applyMetadataUpdates(img, updates);
      }

      isPasteDialogOpen = false;
      toast.success(IMAGE_MESSAGES.METADATA_PASTED);
    } catch (e) {
      logger.error(e);
      toast.error(`Chyba: ${e instanceof Error ? e.message : "Neznámá chyba"}`);
      invalidateAll();
    } finally {
      isApplyingPaste = false;
    }
  }
</script>

<div class="flex flex-col h-full relative" data-testid="edit-tab">
  {#if isSaving}
    <div
      class="absolute inset-0 z-50 bg-background/80 flex items-center justify-center backdrop-blur-sm transition-all duration-200"
      transition:fade={{ duration: 200 }}
    >
      <div class="flex flex-col items-center gap-3">
        <Spinner size="lg" />
        <span class="text-sm text-muted-foreground font-medium animate-pulse"
          >Ukládám metadata...</span
        >
      </div>
    </div>
  {/if}

  <MetadataPasteDialog
    bind:open={isPasteDialogOpen}
    clipboardData={metadataClipboard.data}
    onConfirm={confirmPaste}
  />

  <SelectedImagesBadges
    images={selectedImages}
    hasClipboardData={!!metadataClipboard.data}
    onRemove={(id) => editor.toggleSelection(id)}
    onClearAll={() => editor.clearSelection()}
    onPaste={handlePasteMetadata}
  />

  <form
    method="POST"
    class="grid gap-4 py-4 px-6"
    onsubmit={(e) => {
      e.preventDefault();
      handleSubmit();
    }}
  >
    <MetadataInputField
      label="Popisek"
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
      label="Titulek"
      name="title"
      value={formData.title}
      onInput={(v) => handleFieldInput("title", v)}
      onClear={() => handleFieldClear("title")}
      isCleared={explicitClears.title}
    />

    <MetadataInputField
      label="Autor"
      name="author"
      value={formData.author}
      onInput={(v) => handleFieldInput("author", v)}
      onClear={() => handleFieldClear("author")}
      isCleared={explicitClears.author}
    />

    <MetadataInputField
      label="Klíčová slova"
      name="keywords"
      value={formData.keywords}
      placeholder="čárkou oddělené"
      onInput={(v) => handleFieldInput("keywords", v)}
      onClear={() => handleFieldClear("keywords")}
      isCleared={explicitClears.keywords}
    />

    <div class="flex justify-end pt-4 mt-auto">
      <Button class="w-full" size="lg" type="submit" data-testid="edit-tab-submit-button">
        Uložit změny
      </Button>
    </div>
  </form>
</div>
