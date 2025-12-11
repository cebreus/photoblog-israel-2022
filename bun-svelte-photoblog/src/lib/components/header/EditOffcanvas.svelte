<script lang="ts">
  import { page } from "$app/stores";
  import { invalidateAll, goto } from "$app/navigation";
  import * as Offcanvas from "$lib/components/offcanvas";
  import { Button } from "$lib/components/ui/button";
  import { Input } from "$lib/components/ui/input";
  import { Textarea } from "$lib/components/ui/textarea";
  import { Badge } from "$lib/components/ui/badge";
  import * as Form from "$lib/components/ui/form";
  import type { ImageEntry, Separator } from "$lib/types/manifest";
  import { toast } from "svelte-sonner";
  import { Pencil, X, Trash2, RotateCcw } from "lucide-svelte";
  import { selection, editMode } from "$lib/stores/editorState";
  import { superForm } from "sveltekit-superforms";
  import * as Accordion from "$lib/components/ui/accordion";
  import DeleteImageDialog from "$lib/components/DeleteImageDialog.svelte";

  type DisplayItem = ImageEntry | Separator;

  let { items = [] } = $props<{ items: DisplayItem[] }>();

  let isOpen = $state(false);

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

  let activeImage = $derived(
    selectedImages.length === 1 ? selectedImages[0] : null,
  );

  // Open/Close visibility logic
  $effect(() => {
    if (activeEntry) {
      isOpen = true;
    } else {
      isOpen = false;
    }
  });

  // Data population logic - triggers whenever imageIds changes
  $effect(() => {
    // Reading imageIds ensures reactivity
    if (imageIds.length > 0) {
      populateForm();
    }
  });

  // Note: Manual URL <-> Store sync effects removed in favor of src/lib/stores/url-sync.ts

  function removeImage(id: string) {
    selection.toggle(id);
  }

  function toggleEditMode() {
    if ($editMode) {
      editMode.set(false);
      selection.clear();
    } else {
      editMode.set(true);
    }
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

    const getCommon = (
      getter: (img: ImageEntry) => string | undefined,
    ): string | null => {
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

  async function handleSubmit(data: typeof initialData) {
    if (imageIds.length === 0) return;

    try {
      const payload = {
        imageIds,
        metadata: {
          title: explicitClears.title
            ? null
            : data.title === ""
              ? undefined
              : data.title,
          author: explicitClears.author
            ? null
            : data.author === ""
              ? undefined
              : data.author,
          location: explicitClears.location
            ? null
            : data.location === ""
              ? undefined
              : data.location,
          city: explicitClears.city
            ? null
            : data.city === ""
              ? undefined
              : data.city,
          state: explicitClears.state
            ? null
            : data.state === ""
              ? undefined
              : data.state,
          country: explicitClears.country
            ? null
            : data.country === ""
              ? undefined
              : data.country,
          countryCode: explicitClears.countryCode
            ? null
            : data.countryCode === ""
              ? undefined
              : data.countryCode,
          caption: explicitClears.caption
            ? null
            : data.caption === ""
              ? undefined
              : data.caption,
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
        throw new Error(
          errorData.message || "Nepodařilo se aktualizovat metadata",
        );
      }

      toast.success(
        imageIds.length === 1
          ? `Uložen ${imageIds.length} obrázek.`
          : `Uloženo ${imageIds.length} obrázků.`,
      );
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toast.error(msg);
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

      const applyField = (
        field: keyof typeof initialData,
        value: string | undefined,
      ) => {
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

  let deleteOpen = $state(false);
  let isDeleting = $state(false);

  async function handleDelete() {
    if (imageIds.length === 0) return;
    isDeleting = true;
    try {
      // Prepare payload with source paths
      const itemsToDelete = selectedImages.map((img) => ({
        id: img.id,
        src: img.src,
      }));

      const res = await fetch("/api/images", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: itemsToDelete }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Chyba při mazání souborů");
      }

      const result = await res.json();

      if (result.errors && result.errors.length > 0) {
        result.errors.forEach((e: string) => toast.warning(e));
      }

      if (result.deleted.length > 0) {
        toast.success(
          `Úspěšně smazáno ${result.deleted.length} souborů. Stránka se obnoví.`,
        );
      }

      // Close dialog immediately
      deleteOpen = false;

      // 1. Remove 'edit' param via navigation to update URL source-of-truth
      // This triggers urlSync -> clears selection store -> closes offcanvas
      const newUrl = new URL($page.url);
      newUrl.searchParams.delete("edit");

      await goto(newUrl, {
        replaceState: true,
        noScroll: true,
        keepFocus: true,
      });

      // 2. Refresh data to remove deleted image from grid
      await invalidateAll();
    } catch (e: any) {
      console.error(e);
      toast.error(`Nepodařilo se smazat soubory: ${e.message}`);
    } finally {
      isDeleting = false;
    }
  }
</script>

<div class="flex items-center gap-2">
  <Button
    variant="ghost"
    size="icon"
    onclick={toggleEditMode}
    title="Přepnout režim úprav"
    aria-label="Přepnout režim úprav"
    data-testid="edit-offcanvas-trigger"
  >
    <Pencil strokeWidth={2.5} />
  </Button>

  {#if $selection.size > 0}
    <div class="w-px h-6 bg-slate-700 mx-2"></div>
    <Button variant="ghost" size="sm" onclick={() => selection.clear()}>
      Zrušit výběr ({$selection.size})
    </Button>
    <Button variant="secondary" size="sm" onclick={() => (isOpen = true)}>
      Upravit
    </Button>
  {/if}
</div>

<Offcanvas.Root bind:open={isOpen}>
  <Offcanvas.Content
    side="right"
    className="overflow-y-auto border-l p-6 dark:bg-slate-900"
  >
    <div class="flex flex-col space-y-2 text-center sm:text-left mb-6">
      <h2 class="text-lg font-semibold text-foreground">Upravit metadata</h2>
      <div class="text-sm text-muted-foreground flex flex-col gap-2">
        <span>
          {imageIds.length === 1
            ? `Úprava ${imageIds.length} obrázku:`
            : `Úprava ${imageIds.length} obrázků:`}
        </span>
        <div class="flex flex-wrap gap-1">
          {#if selectedImages.length > 1}
            <Badge
              variant="destructive"
              class="font-mono text-xs cursor-pointer hover:bg-destructive/90"
              onclick={() => selection.clear()}
            >
              Odebrat vše
            </Badge>
          {/if}
          {#each selectedImages as img (img.id)}
            <Badge
              variant="secondary"
              class="font-mono text-xs flex gap-1 items-center pr-1"
            >
              {img.src.split("/").pop()}
              <button
                onclick={() => removeImage(img.id)}
                class="text-muted-foreground hover:text-foreground p-0.5 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                title="Odebrat z výběru"
                type="button"
              >
                <X size={12} />
              </button>
            </Badge>
          {/each}
        </div>
      </div>
    </div>

    <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
    <form
      method="POST"
      use:enhance
      class="grid gap-4 py-4"
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
                title="Smazat hodnotu"
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
          <Accordion.Trigger class="text-sm font-medium">
            Geografické údaje
          </Accordion.Trigger>
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
                        variant={explicitClears.location
                          ? "destructive"
                          : "outline"}
                        size="icon"
                        type="button"
                        onclick={() => handleExplicitClear("location")}
                        title="Smazat hodnotu"
                      >
                        <Trash2 class="size-4" />
                      </Button>
                    </div>
                    {#if previousGeoValues.location !== undefined}
                      <button
                        type="button"
                        class="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 mt-1 transition-colors group"
                        onclick={() => restoreGeoValue("location")}
                        title="Kliknutím vrátíte popisek"
                      >
                        <RotateCcw
                          size={10}
                          class="group-hover:-rotate-90 transition-transform"
                        />
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
                        variant={explicitClears.city
                          ? "destructive"
                          : "outline"}
                        size="icon"
                        type="button"
                        onclick={() => handleExplicitClear("city")}
                        title="Smazat hodnotu"
                      >
                        <Trash2 class="size-4" />
                      </Button>
                    </div>
                    {#if previousGeoValues.city !== undefined}
                      <button
                        type="button"
                        class="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 mt-1 transition-colors group"
                        onclick={() => restoreGeoValue("city")}
                        title="Kliknutím vrátíte původní hodnotu"
                      >
                        <RotateCcw
                          size={10}
                          class="group-hover:-rotate-90 transition-transform"
                        />
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
                        variant={explicitClears.state
                          ? "destructive"
                          : "outline"}
                        size="icon"
                        type="button"
                        onclick={() => handleExplicitClear("state")}
                        title="Smazat hodnotu"
                      >
                        <Trash2 class="size-4" />
                      </Button>
                    </div>
                    {#if previousGeoValues.state !== undefined}
                      <button
                        type="button"
                        class="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 mt-1 transition-colors group"
                        onclick={() => restoreGeoValue("state")}
                        title="Kliknutím vrátíte původní hodnotu"
                      >
                        <RotateCcw
                          size={10}
                          class="group-hover:-rotate-90 transition-transform"
                        />
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
                        variant={explicitClears.country
                          ? "destructive"
                          : "outline"}
                        size="icon"
                        type="button"
                        onclick={() => handleExplicitClear("country")}
                        title="Smazat hodnotu"
                      >
                        <Trash2 class="size-4" />
                      </Button>
                    </div>
                    {#if previousGeoValues.country !== undefined}
                      <button
                        type="button"
                        class="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 mt-1 transition-colors group"
                        onclick={() => restoreGeoValue("country")}
                        title="Kliknutím vrátíte původní hodnotu"
                      >
                        <RotateCcw
                          size={10}
                          class="group-hover:-rotate-90 transition-transform"
                        />
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
                        variant={explicitClears.countryCode
                          ? "destructive"
                          : "outline"}
                        size="icon"
                        type="button"
                        onclick={() => handleExplicitClear("countryCode")}
                        title="Smazat hodnotu"
                      >
                        <Trash2 class="size-4" />
                      </Button>
                    </div>
                    {#if previousGeoValues.countryCode !== undefined}
                      <button
                        type="button"
                        class="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 mt-1 transition-colors group"
                        onclick={() => restoreGeoValue("countryCode")}
                        title="Kliknutím vrátíte původní hodnotu"
                      >
                        <RotateCcw
                          size={10}
                          class="group-hover:-rotate-90 transition-transform"
                        />
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

              {#if activeImage?.googleMapsUrl || activeImage?.mapyCzUrl}
                <div class="flex flex-col gap-2 pt-2">
                  <div class="flex gap-2 flex-wrap">
                    {#if activeImage.googleMapsUrl}
                      <Button
                        variant="link"
                        size="sm"
                        href={activeImage.googleMapsUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        Google Maps
                      </Button>
                    {/if}
                    {#if activeImage.mapyCzUrl}
                      <Button
                        variant="link"
                        size="sm"
                        href={activeImage.mapyCzUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        Mapy.cz
                      </Button>
                    {/if}
                    {#if activeImage?.exif?.latitude && activeImage?.exif?.longitude}
                      <Button
                        variant="outline"
                        size="sm"
                        class="ml-auto"
                        disabled={isFetchingGeo}
                        onclick={(e) => {
                          e.stopPropagation();
                          handleFetchGeoData();
                        }}
                      >
                        {isFetchingGeo ? "Stahuji..." : "Získat z webu"}
                      </Button>
                    {/if}
                  </div>
                </div>
              {/if}
            </div>
          </Accordion.Content>
        </Accordion.Item>
      </Accordion.Root>

      <Form.Field {form} name="keywords">
        <Form.Control>
          {#snippet children({ props })}
            <Form.Label>Klíčová slova</Form.Label>
            <div class="flex gap-2">
              <Input
                {...props}
                bind:value={$formData.keywords}
                oninput={() => handleInput("keywords")}
              />
              <Button
                variant={explicitClears.keywords ? "destructive" : "outline"}
                size="icon"
                type="button"
                onclick={() => handleExplicitClear("keywords")}
                title="Smazat hodnotu"
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
              <Input
                {...props}
                bind:value={$formData.author}
                oninput={() => handleInput("author")}
              />
              <Button
                variant={explicitClears.author ? "destructive" : "outline"}
                size="icon"
                type="button"
                onclick={() => handleExplicitClear("author")}
                title="Smazat hodnotu"
              >
                <Trash2 class="size-4" />
              </Button>
            </div>
          {/snippet}
        </Form.Control>
        <Form.FieldErrors />
      </Form.Field>

      <Form.Field {form} name="title">
        <Form.Control>
          {#snippet children({ props })}
            <Form.Label>Název</Form.Label>
            <div class="flex gap-2">
              <Input
                {...props}
                bind:value={$formData.title}
                oninput={() => handleInput("title")}
              />
              <Button
                variant={explicitClears.title ? "destructive" : "outline"}
                size="icon"
                type="button"
                onclick={() => handleExplicitClear("title")}
                title="Smazat hodnotu"
              >
                <Trash2 class="size-4" />
              </Button>
            </div>
          {/snippet}
        </Form.Control>
        <Form.FieldErrors />
      </Form.Field>

      <div
        class="flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2 mt-6 items-center"
      >
        <Button
          variant="destructive"
          size="sm"
          type="button"
          onclick={() => (deleteOpen = true)}
          data-testid="delete-pics-trigger"
        >
          Smazat {imageIds.length}
          {imageIds.length === 1 ? "položku" : "položek"}
        </Button>
        <Button type="submit">Uložit změny</Button>
      </div>
    </form>

    <DeleteImageDialog
      bind:open={deleteOpen}
      images={selectedImages}
      {isDeleting}
      onConfirm={handleDelete}
    />
  </Offcanvas.Content>
</Offcanvas.Root>
