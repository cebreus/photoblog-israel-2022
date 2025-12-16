<script lang="ts">
  import { page } from "$app/stores";
  import { invalidateAll, goto } from "$app/navigation";
  import { Button } from "$lib/components/ui/button";
  import { Input } from "$lib/components/ui/input";
  import { Textarea } from "$lib/components/ui/textarea";
  import { Badge } from "$lib/components/ui/badge";
  import * as Form from "$lib/components/ui/form";
  import type { ImageEntry, Separator } from "$lib/types/manifest";
  import { toast } from "svelte-sonner";
  import { X, Trash2, RotateCcw } from "lucide-svelte";
  import MetadataPasteDialog from "$lib/components/MetadataPasteDialog.svelte";
  import { fade } from "svelte/transition";
  import { selection, editMode } from "$lib/stores/editorState";
  import { superForm } from "sveltekit-superforms";
  import * as Accordion from "$lib/components/ui/accordion";
  import { metadataClipboard } from "$lib/stores/metadataClipboard";
  import { Spinner } from "$lib/components/ui/spinner";

  type DisplayItem = ImageEntry | Separator;

  let { items = [] } = $props<{ items: DisplayItem[] }>();

  // Manual initial data (replaces Schema)
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

  // Form setup
  const form = superForm(initialData, {
    SPA: true,
    dataType: "json",
    validators: false as any, // Explicitly false to suppress warning
    // No validators - relying on manual optional fields
    onUpdate: async ({ form }) => {
      if (form.valid) {
        await handleSubmit(form.data);
      }
    },
  });

  const { form: formData, enhance } = form;

  // Track whether multiple selected images share a common value
  let commonTitle = $state<string | null>(null);
  let commonAuthor = $state<string | null>(null);
  let commonLocation = $state<string | null>(null);
  let commonCity = $state<string | null>(null);
  let commonState = $state<string | null>(null);
  let commonCountry = $state<string | null>(null);
  let commonCountryCode = $state<string | null>(null);
  let commonCaption = $state<string | null>(null);
  let commonKeywords = $state<string | null>(null);

  // Track explicit deletion requests to prevent accidental empty string overwrites
  let explicitClears = $state<Record<string, boolean>>({});

  // Derived state from stores (Centralized logic via urlSync.ts)
  let imageIds = $derived(Array.from($selection));
  let activeEntry = $derived($selection.size > 0);
  let isEditMode = $derived($editMode);

  // Derived file names
  let selectedImages = $derived(
    items.filter(
      (item: DisplayItem) => item.type === "image" && $selection.has(item.id),
    ) as ImageEntry[],
  );

  let activeImage = $derived(selectedImages.length === 1 ? selectedImages[0] : null);

  // Data population logic - triggers whenever imageIds changes
  $effect(() => {
    // Reading imageIds ensures reactivity
    if (imageIds.length > 0) {
      populateForm();
    }
  });

  function removeImage(id: string) {
    selection.toggle(id);
  }

  // Simplified findImages
  function findImages(): ImageEntry[] {
    return items.filter(
      (item: DisplayItem) => item.type === "image" && $selection.has(item.id),
    ) as ImageEntry[];
  }

  function populateForm() {
    // Reset explicit clears and previous values when repopulating (switching images)
    explicitClears = {};
    previousGeoValues = {};
    const images = findImages();
    if (images.length === 0) return;

    const getCommon = (getter: (img: ImageEntry) => string | undefined): string | null => {
      const first = getter(images[0]) || "";
      for (let i = 1; i < images.length; i++) {
        if ((getter(images[i]) || "") !== first) return null;
      }
      return first;
    };

    const commonTitleValue = getCommon((i) => i.exif?.title);
    const commonAuthorValue = getCommon((i) => i.author);
    const commonLocationValue = getCommon((i) => i.location);
    const commonCityValue = getCommon((i) => i.city);
    const commonStateValue = getCommon((i) => i.exif?.state);
    const commonCountryValue = getCommon((i) => i.exif?.country);
    const commonCountryCodeValue = getCommon((i) => i.exif?.countryCode);
    const commonCaptionValue = getCommon((i) => i.caption);
    const commonKeywordsValue = getCommon((i) => i.keywords?.join(", "));

    $formData.title = commonTitleValue ?? "";
    commonTitle = commonTitleValue;

    $formData.author = commonAuthorValue ?? "";
    commonAuthor = commonAuthorValue;

    $formData.location = commonLocationValue ?? "";
    commonLocation = commonLocationValue;

    $formData.city = commonCityValue ?? "";
    commonCity = commonCityValue;

    $formData.state = commonStateValue ?? "";
    commonState = commonStateValue;

    $formData.country = commonCountryValue ?? "";
    commonCountry = commonCountryValue;

    $formData.countryCode = commonCountryCodeValue ?? "";
    commonCountryCode = commonCountryCodeValue;

    $formData.caption = commonCaptionValue ?? "";
    commonCaption = commonCaptionValue;

    $formData.keywords = commonKeywordsValue ?? "";
    commonKeywords = commonKeywordsValue;
  }

  let isSaving = $state(false);

  async function handleSubmit(data: typeof initialData) {
    if (imageIds.length === 0) return;

    isSaving = true;
    try {
      const payload = {
        imageIds,
        metadata: {
          title: explicitClears.title ? null : data.title === "" ? undefined : data.title,
          author: explicitClears.author ? null : data.author === "" ? undefined : data.author,
          location: explicitClears.location
            ? null
            : data.location === ""
              ? undefined
              : data.location,
          city: explicitClears.city ? null : data.city === "" ? undefined : data.city,
          state: explicitClears.state ? null : data.state === "" ? undefined : data.state,
          country: explicitClears.country ? null : data.country === "" ? undefined : data.country,
          countryCode: explicitClears.countryCode
            ? null
            : data.countryCode === ""
              ? undefined
              : data.countryCode,
          caption: explicitClears.caption ? null : data.caption === "" ? undefined : data.caption,
          keywords: explicitClears.keywords
            ? null
            : data.keywords === ""
              ? undefined
              : data.keywords
                  ?.split(",")
                  .map((k: string) => k.trim())
                  .filter(Boolean),
        },
      };

      const res = await fetch("/api/metadata", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.message || "Nepodařilo se aktualizovat metadata");
      }

      toast.success(
        imageIds.length === 1
          ? `Uložen ${imageIds.length} obrázek.`
          : `Uloženo ${imageIds.length} obrázků.`,
      );
      // Invalidate server data to refresh manifest with updated metadata
      // Invalidate server data to refresh manifest with updated metadata
      // await invalidateAll(); // Refreshing too quickly kills the toast context or causes a re-render that might hide it.
      // Instead, we will rely on optimistic UI or manual update if needed, but for now let's just NOT hard refresh immediately
      // to see the toast. Or correct: invalidate keeps page state but data re-run might be clearing something?
      // Actually invalidateAll re-runs load functions. The toast should persist across navigation if it's in layout.

      // The issue is likely that invalidateAll() triggers a full re-render of the data which might be
      // causing the component mounting the toast (or the context) to reset if not handled carefully.
      // However, usually sonner handles this fine.

      // Let's try adding a small delay to see if it's a race condition with the UI update,
      // or simply remove it if we trust the UI state is local enough?
      // No, we need invalidate to update the sidebar/grid data from the server (manifest).

      // A common pattern is to wait a bit or use `applyAction` if it was form action.
      // Here it is fetch.

      setTimeout(() => {
        invalidateAll();
      }, 500);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toast.error(msg);
    } finally {
      isSaving = false;
    }
  }

  function handleExplicitClear(field: keyof typeof initialData) {
    $formData[field] = "";
    explicitClears[field] = true;
  }

  function handleInput(field: keyof typeof initialData) {
    if (explicitClears[field]) {
      explicitClears[field] = false;
    }
  }

  let isFetchingGeo = $state(false);
  let previousGeoValues = $state<Partial<typeof initialData>>({});

  function restoreGeoValue(field: keyof typeof initialData) {
    if (previousGeoValues[field] !== undefined) {
      $formData[field] = previousGeoValues[field]!;
      // Update explicit clears: if restored value is empty, mark as explicit clear?
      // Or just unmark explicit clear if it has value.
      if ($formData[field]) {
        explicitClears[field] = false;
      } else {
        // If restoring empty, usually we want to treat it as "cleared"
        explicitClears[field] = true;
      }

      const newPrev = { ...previousGeoValues };
      delete newPrev[field];
      previousGeoValues = newPrev;
    }
  }

  async function handleFetchGeoData() {
    if (!activeImage?.exif?.latitude || !activeImage?.exif?.longitude) {
      toast.error("Obrázek nemá GPS souřadnice.");
      return;
    }

    isFetchingGeo = true;
    try {
      const { latitude, longitude } = activeImage.exif;
      const res = await fetch(`/api/geocode?lat=${latitude}&lng=${longitude}`);

      if (!res.ok) throw new Error("Nepodařilo se načíst data z mapy.");

      const data = await res.json();
      const snapshot = { ...$formData };
      const newPrevious: typeof previousGeoValues = {};

      const applyField = (field: keyof typeof initialData, value: string | undefined) => {
        // Do not repopulate a field the user explicitly cleared
        if (explicitClears[field]) return;
        if (value && value !== snapshot[field]) {
          newPrevious[field] = snapshot[field];
          $formData[field] = value;
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
        toast.success("Data byla načtena z mapy (změny lze vrátit).");
      } else {
        toast.info("Data z mapy se shodují s aktuálními.");
      }
    } catch (e) {
      console.error(e);
      toast.error("Chyba při stahování dat.");
    } finally {
      isFetchingGeo = false;
    }
  }

  let isDeleting = $state(false);
  let isPastingOpen = $state(false);
  let isApplyingPaste = $state(false);

  function handlePasteMetadata() {
    const clipboard = $metadataClipboard;

    if (!clipboard.data) {
      toast.error("Žádná metadata v clipboard");
      return;
    }

    isPastingOpen = true;
  }

  async function confirmPaste(fieldsToApply: Record<string, boolean>) {
    const clipboard = $metadataClipboard;

    if (!clipboard.data || imageIds.length === 0) return;

    isApplyingPaste = true;
    try {
      const updatePayload = {
        images: selectedImages.map((img) => ({
          id: img.id,
          src: img.src,
        })),
        updates: {
          title: fieldsToApply.title && clipboard.data.title ? clipboard.data.title : undefined,
          author: fieldsToApply.author && clipboard.data.author ? clipboard.data.author : undefined,
          location:
            fieldsToApply.location && clipboard.data.location ? clipboard.data.location : undefined,
          city: fieldsToApply.city && clipboard.data.city ? clipboard.data.city : undefined,
          state: fieldsToApply.state && clipboard.data.state ? clipboard.data.state : undefined,
          country:
            fieldsToApply.country && clipboard.data.country ? clipboard.data.country : undefined,
          countryCode:
            fieldsToApply.countryCode && clipboard.data.countryCode
              ? clipboard.data.countryCode
              : undefined,
          caption:
            fieldsToApply.caption && clipboard.data.caption ? clipboard.data.caption : undefined,
          keywords:
            fieldsToApply.keywords && clipboard.data.keywords?.length
              ? clipboard.data.keywords
              : undefined,
        },
      };

      console.log("Sending PATCH payload:", updatePayload);

      const res = await fetch("/api/images", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updatePayload),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Chyba při ukládání metadata");
      }

      isPastingOpen = false;
      toast.success("Metadata úspěšně vložena");

      // Refresh data
      await invalidateAll();

      // Close offcanvas? No, just keep open in tab.
    } catch (e: any) {
      console.error(e);
      toast.error(`Chyba: ${e.message}`);
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
    bind:open={isPastingOpen}
    clipboardData={$metadataClipboard.data}
    onConfirm={confirmPaste}
  />

  {#if selectedImages.length > 0}
    <div class="flex flex-wrap gap-1 p-4 pt-2 border-b" data-testid="edit-tab-selected-images">
      {#if selectedImages.length > 1}
        <Badge
          variant="destructive"
          class="font-mono text-xs cursor-pointer"
          onclick={() => selection.clear()}
          data-testid="edit-tab-clear-selection"
        >
          Odebrat vše
        </Badge>
      {/if}

      {#if $metadataClipboard.data}
        <Badge
          class="font-mono text-ýxs cursor-pointer"
          onclick={handlePasteMetadata}
          aria-label="Vložit metadata na vybrané obrázky"
          data-testid="edit-tab-paste-metadata"
        >
          Vložit metadata
        </Badge>
      {/if}

      {#each selectedImages as img (img.id)}
        <Badge
          variant="secondary"
          class="font-mono text-xs flex gap-1 items-center pr-1"
          data-testid="edit-tab-selected-image-{img.id}"
        >
          {img.src.split("/").pop()}
          <button
            onclick={() => removeImage(img.id)}
            class="text-muted-foreground hover:text-foreground p-0.5 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
            aria-label="Odebrat z výběru"
            type="button"
          >
            <X size={12} />
          </button>
        </Badge>
      {/each}
    </div>
  {/if}

  <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
  <form
    method="POST"
    use:enhance
    class="grid gap-4 py-4 px-6"
    onkeydown={(e) => {
      if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        form.submit();
      }
    }}
  >
    <Form.Field {form} name="caption">
      <Form.Control>
        {#snippet children({ props })}
          <Form.Label>Popisek</Form.Label>
          <div class="flex gap-2 items-start">
            <Textarea
              {...props}
              bind:value={$formData.caption}
              oninput={() => handleInput("caption")}
            />
            <Button
              variant={explicitClears.caption ? "destructive" : "outline"}
              size="icon"
              type="button"
              onclick={() => handleExplicitClear("caption")}
              aria-label="Smazat hodnotu"
            >
              <Trash2 class="size-4" />
            </Button>
          </div>
        {/snippet}
      </Form.Control>
      <Form.FieldErrors />
    </Form.Field>

    <!-- Geografická data -->
    <Accordion.Root type="single" value="geo">
      <Accordion.Item value="geo">
        <Accordion.Trigger class="text-sm font-medium">Geografické údaje</Accordion.Trigger>
        <Accordion.Content class="border-b mb-2">
          <div class="space-y-4 pt-2">
            <Form.Field {form} name="location">
              <Form.Control>
                {#snippet children({ props })}
                  <Form.Label>Místo</Form.Label>
                  <div class="flex gap-2">
                    <Input
                      {...props}
                      bind:value={$formData.location}
                      oninput={() => handleInput("location")}
                    />
                    <Button
                      variant={explicitClears.location ? "destructive" : "outline"}
                      size="icon"
                      type="button"
                      onclick={() => handleExplicitClear("location")}
                      aria-label="Smazat hodnotu"
                    >
                      <Trash2 class="size-4" />
                    </Button>
                  </div>
                  {#if previousGeoValues.location !== undefined}
                    <button
                      type="button"
                      class="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 mt-1 transition-colors group"
                      onclick={() => restoreGeoValue("location")}
                      aria-label="Kliknutím vrátíte popisek"
                    >
                      <RotateCcw size={10} class="group-hover:-rotate-90 transition-transform" />
                      Původní:
                      <span class="font-mono bg-muted px-1 rounded"
                        >{previousGeoValues.location || "∅"}</span
                      >
                    </button>
                  {/if}
                {/snippet}
              </Form.Control>
              <Form.FieldErrors />
            </Form.Field>

            <Form.Field {form} name="city">
              <Form.Control>
                {#snippet children({ props })}
                  <Form.Label>Město</Form.Label>
                  <div class="flex gap-2">
                    <Input
                      {...props}
                      bind:value={$formData.city}
                      oninput={() => handleInput("city")}
                    />
                    <Button
                      variant={explicitClears.city ? "destructive" : "outline"}
                      size="icon"
                      type="button"
                      onclick={() => handleExplicitClear("city")}
                      aria-label="Smazat hodnotu"
                    >
                      <Trash2 class="size-4" />
                    </Button>
                  </div>
                  {#if previousGeoValues.city !== undefined}
                    <button
                      type="button"
                      class="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 mt-1 transition-colors group"
                      onclick={() => restoreGeoValue("city")}
                      aria-label="Kliknutím vrátíte původní hodnotu"
                    >
                      <RotateCcw size={10} class="group-hover:-rotate-90 transition-transform" />
                      Původní:
                      <span class="font-mono bg-muted px-1 rounded"
                        >{previousGeoValues.city || "∅"}</span
                      >
                    </button>
                  {/if}
                {/snippet}
              </Form.Control>
              <Form.FieldErrors />
            </Form.Field>

            <Form.Field {form} name="state">
              <Form.Control>
                {#snippet children({ props })}
                  <Form.Label>Stát / Provincie</Form.Label>
                  <div class="flex gap-2">
                    <Input
                      {...props}
                      bind:value={$formData.state}
                      oninput={() => handleInput("state")}
                    />
                    <Button
                      variant={explicitClears.state ? "destructive" : "outline"}
                      size="icon"
                      type="button"
                      onclick={() => handleExplicitClear("state")}
                      aria-label="Smazat hodnotu"
                    >
                      <Trash2 class="size-4" />
                    </Button>
                  </div>
                  {#if previousGeoValues.state !== undefined}
                    <button
                      type="button"
                      class="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 mt-1 transition-colors group"
                      onclick={() => restoreGeoValue("state")}
                      aria-label="Kliknutím vrátíte původní hodnotu"
                    >
                      <RotateCcw size={10} class="group-hover:-rotate-90 transition-transform" />
                      Původní:
                      <span class="font-mono bg-muted px-1 rounded"
                        >{previousGeoValues.state || "∅"}</span
                      >
                    </button>
                  {/if}
                {/snippet}
              </Form.Control>
              <Form.FieldErrors />
            </Form.Field>

            <Form.Field {form} name="country">
              <Form.Control>
                {#snippet children({ props })}
                  <Form.Label>Země</Form.Label>
                  <div class="flex gap-2">
                    <Input
                      {...props}
                      bind:value={$formData.country}
                      oninput={() => handleInput("country")}
                    />
                    <Button
                      variant={explicitClears.country ? "destructive" : "outline"}
                      size="icon"
                      type="button"
                      onclick={() => handleExplicitClear("country")}
                      aria-label="Smazat hodnotu"
                    >
                      <Trash2 class="size-4" />
                    </Button>
                  </div>
                  {#if previousGeoValues.country !== undefined}
                    <button
                      type="button"
                      class="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 mt-1 transition-colors group"
                      onclick={() => restoreGeoValue("country")}
                      aria-label="Kliknutím vrátíte původní hodnotu"
                    >
                      <RotateCcw size={10} class="group-hover:-rotate-90 transition-transform" />
                      Původní:
                      <span class="font-mono bg-muted px-1 rounded"
                        >{previousGeoValues.country || "∅"}</span
                      >
                    </button>
                  {/if}
                {/snippet}
              </Form.Control>
              <Form.FieldErrors />
            </Form.Field>

            <Form.Field {form} name="countryCode">
              <Form.Control>
                {#snippet children({ props })}
                  <Form.Label>Kód</Form.Label>
                  <div class="flex gap-2">
                    <Input
                      {...props}
                      bind:value={$formData.countryCode}
                      oninput={() => handleInput("countryCode")}
                    />
                    <Button
                      variant={explicitClears.countryCode ? "destructive" : "outline"}
                      size="icon"
                      type="button"
                      onclick={() => handleExplicitClear("countryCode")}
                      aria-label="Smazat hodnotu"
                    >
                      <Trash2 class="size-4" />
                    </Button>
                  </div>
                  {#if previousGeoValues.countryCode !== undefined}
                    <button
                      type="button"
                      class="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 mt-1 transition-colors group"
                      onclick={() => restoreGeoValue("countryCode")}
                      aria-label="Kliknutím vrátíte původní hodnotu"
                    >
                      <RotateCcw size={10} class="group-hover:-rotate-90 transition-transform" />
                      Původní:
                      <span class="font-mono bg-muted px-1 rounded"
                        >{previousGeoValues.countryCode || "∅"}</span
                      >
                    </button>
                  {/if}
                {/snippet}
              </Form.Control>
              <Form.FieldErrors />
            </Form.Field>

            <div class="flex gap-2 pt-2">
              {#if activeImage?.googleMapsUrl}
                <Button
                  variant="link"
                  size="sm"
                  href={activeImage.googleMapsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Otevřít v Google Maps"
                >
                  Google Maps
                </Button>
              {/if}
              <Button
                variant="outline"
                size="sm"
                class="flex-1 gap-2"
                onclick={handleFetchGeoData}
                disabled={isFetchingGeo || !activeImage?.exif?.latitude}
                aria-label="Načíst adresu z GPS souřadnic"
              >
                {#if isFetchingGeo}
                  Loading...
                {:else}
                  Načíst z mapy
                {/if}
              </Button>
            </div>
          </div>
        </Accordion.Content>
      </Accordion.Item>
    </Accordion.Root>

    <!-- Other Fields -->
    <Form.Field {form} name="title">
      <Form.Control>
        {#snippet children({ props })}
          <Form.Label>Titulek</Form.Label>
          <div class="flex gap-2">
            <Input {...props} bind:value={$formData.title} oninput={() => handleInput("title")} />
            <Button
              variant={explicitClears.title ? "destructive" : "outline"}
              size="icon"
              type="button"
              onclick={() => handleExplicitClear("title")}
              aria-label="Smazat hodnotu"
            >
              <Trash2 class="size-4" />
            </Button>
          </div>
        {/snippet}
      </Form.Control>
      <Form.FieldErrors />
    </Form.Field>

    <Form.Field {form} name="author">
      <Form.Control>
        {#snippet children({ props })}
          <Form.Label>Autor</Form.Label>
          <div class="flex gap-2">
            <Input {...props} bind:value={$formData.author} oninput={() => handleInput("author")} />
            <Button
              variant={explicitClears.author ? "destructive" : "outline"}
              size="icon"
              type="button"
              onclick={() => handleExplicitClear("author")}
              aria-label="Smazat hodnotu"
            >
              <Trash2 class="size-4" />
            </Button>
          </div>
        {/snippet}
      </Form.Control>
      <Form.FieldErrors />
    </Form.Field>

    <Form.Field {form} name="keywords">
      <Form.Control>
        {#snippet children({ props })}
          <Form.Label>Klíčová slova</Form.Label>
          <div class="flex gap-2">
            <Input
              {...props}
              bind:value={$formData.keywords}
              oninput={() => handleInput("keywords")}
              placeholder="čárkou oddělené"
            />
            <Button
              variant={explicitClears.keywords ? "destructive" : "outline"}
              size="icon"
              type="button"
              onclick={() => handleExplicitClear("keywords")}
              aria-label="Smazat hodnotu"
            >
              <Trash2 class="size-4" />
            </Button>
          </div>
        {/snippet}
      </Form.Control>
      <Form.FieldErrors />
    </Form.Field>

    <div class="flex justify-end pt-4 mt-auto">
      <Button class="w-full" size="lg" type="submit">Uložit změny</Button>
    </div>
  </form>
</div>
