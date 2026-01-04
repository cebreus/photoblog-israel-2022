<script lang="ts">
  import RefreshCcw from "@lucide/svelte/icons/refresh-ccw";
  import X from "@lucide/svelte/icons/x";

  import { Button } from "$lib/components/ui/button";
  import Checkbox from "$lib/components/ui/checkbox/checkbox.svelte";
  import * as Dialog from "$lib/components/ui/dialog";
  import type { ImageEntry } from "$lib/types/manifest";
  import { cn } from "$lib/utils";

  type MetadataFieldKey =
    | "title"
    | "author"
    | "location"
    | "city"
    | "state"
    | "country"
    | "countryCode"
    | "caption"
    | "keywords";

  interface MetadataFieldDef {
    key: MetadataFieldKey;
    label: string;
  }

  const FIELD_DEFS: MetadataFieldDef[] = [
    { key: "title", label: "Název (Title)" },
    { key: "author", label: "Autor" },
    { key: "location", label: "Místo (Location)" },
    { key: "city", label: "Město" },
    { key: "state", label: "Stát / Provincie" },
    { key: "country", label: "Země" },
    { key: "countryCode", label: "Kód země" },
    { key: "caption", label: "Popisek (Caption)" },
    { key: "keywords", label: "Klíčová slova" },
  ];

  let {
    open = $bindable(false),
    clipboardData,
    images = [],
    onConfirm,
  }: {
    open: boolean;
    clipboardData: Partial<Record<string, unknown>> | null;
    images?: ImageEntry[];
    onConfirm: (fieldsToApply: Record<string, boolean>, excludedImageIds: string[]) => void;
    onOpenCurationDialog?: () => void;
  } = $props();

  // State
  let selectedFields = $state<Record<string, boolean>>({
    title: true,
    author: true,
    location: true,
    city: true,
    state: true,
    country: true,
    countryCode: true,
    caption: true,
    keywords: true,
  });

  // Track images excluded from the operation
  let excludedImageIds = $state<Set<string>>(new Set());

  // Helper derived for source values (from clipboard)
  let sourceValues = $derived.by(() => {
    const values: Record<string, string> = {};
    for (const def of FIELD_DEFS) {
      const raw = clipboardData?.[def.key];
      // Assume basic types for metadata values
      if (Array.isArray(raw)) {
        values[def.key] = raw.join(", ");
      } else if (typeof raw === "string" || typeof raw === "number") {
        values[def.key] = String(raw);
      } else {
        values[def.key] = "";
      }
    }
    return values;
  });

  // Calculate grid data
  let gridData = $derived.by(() => {
    return FIELD_DEFS.map((def) => {
      const sourceVal = sourceValues[def.key] || "";
      const isSelected = selectedFields[def.key];

      const imageCells = images.map((img) => {
        const isExcluded = excludedImageIds.has(img.id);
        const rawOrig = getValueFromImage(img, def.key);
        const originalVal = Array.isArray(rawOrig) ? rawOrig.join(", ") : (rawOrig ?? "");

        // Only mark as changing if not excluded
        const willChange =
          !isExcluded && isSelected && sourceVal !== "" && sourceVal !== originalVal;

        return {
          imageId: img.id,
          originalVal: originalVal || "-",
          willChange,
          isExcluded,
        };
      });

      return {
        ...def,
        sourceVal: sourceVal || "-",
        imageCells,
      };
    });
  });

  // Helper to safely extract value from ImageEntry
  function getValueFromImage(
    image: ImageEntry,
    key: MetadataFieldKey,
  ): string | string[] | undefined {
    switch (key) {
      case "title":
        return image.title;
      case "author":
        return image.author;
      case "location":
        return image.location;
      case "city":
        return image.city;
      case "state":
        return image.exif?.state;
      case "country":
        return image.exif?.country;
      case "countryCode":
        return image.exif?.countryCode;
      case "caption":
        return image.caption;
      case "keywords":
        return image.keywords;
      default:
        return undefined;
    }
  }

  // Resolve image path correctly using the fallback source
  function resolveThumbnail(image: ImageEntry) {
    // Find plain jpeg fallback or the first available source
    const fallback =
      image.sources?.find(
        (s) => s.variant === "fallback" || s.variant === ("xxs" as string),
        // Actually, better to just check for 'fallback' and maybe 'placeholder' if it has path?
        // Let's stick to 'fallback' and then first source.
      ) || image.sources?.[0];

    // If we have a path in the source, use it.
    if (fallback?.path) return fallback.path;

    // Fallback to src property if sources logic fails (legacy/fallback)
    // But basic fix: prepend '/' if missing.
    if (image.src.startsWith("/")) return image.src;
    return `/${image.src}`;
  }

  function handleConfirm() {
    onConfirm(selectedFields, Array.from(excludedImageIds));
    open = false;
  }

  function toggleImageExclusion(imageId: string) {
    const newSetName = new Set(excludedImageIds);
    if (newSetName.has(imageId)) {
      newSetName.delete(imageId);
    } else {
      newSetName.add(imageId);
    }
    excludedImageIds = newSetName;
  }

  // Toggle all logic
  let allSelected = $derived(FIELD_DEFS.every((f) => selectedFields[f.key] === true));
  let someSelected = $derived(FIELD_DEFS.some((f) => selectedFields[f.key] === true));

  function toggleAll(checked: boolean) {
    for (const def of FIELD_DEFS) {
      selectedFields[def.key] = checked;
    }
  }
</script>

<Dialog.Root bind:open>
  <Dialog.Content class="flex max-h-[95vh] flex-col gap-0 p-0 xl:max-w-7xl">
    <Dialog.Header class="p-6 pb-4">
      <Dialog.Title>Vložit metadata</Dialog.Title>
      <Dialog.Description>
        Vyberte pole k přepsání. Zobrazuji náhled změn pro {images.length - excludedImageIds.size} z {images.length}
        {images.length === 1
          ? "obrázku"
          : images.length >= 2 && images.length <= 4
            ? "obrázků"
            : "obrázků"}.
      </Dialog.Description>
    </Dialog.Header>

    <div class="bg-muted/10 relative min-h-0 flex-1 overflow-auto border-y">
      {#if !clipboardData}
        <div class="text-muted-foreground p-8 text-center text-sm">
          Žádná data nejsou ve schránce.
        </div>
      {:else}
        <table class="w-max min-w-full border-collapse border-spacing-0 text-sm">
          <thead>
            <tr>
              <!-- Controls Header (Sticky Left + Top) -->
              <th
                class="bg-background sticky top-0 left-0 z-30 w-72 border-r border-b px-4 py-3 text-left"
              >
                <div class="flex items-center gap-2">
                  <Checkbox
                    checked={allSelected}
                    indeterminate={someSelected && !allSelected}
                    onCheckedChange={(v) => toggleAll(v === true)}
                  />
                  <span>Vybrat vše</span>
                </div>
              </th>

              <!-- Image Thumbnails Headers (Sticky Top) -->
              {#each images as img (img.id)}
                {@const isExcluded = excludedImageIds.has(img.id)}
                <th
                  class={cn(
                    "bg-background/95 sticky top-0 z-20 min-w-[220px] border-b px-4 py-3 text-left backdrop-blur-sm transition-opacity",
                    isExcluded && "opacity-50 grayscale",
                  )}
                  data-testid={`metadata-paste-dialog-header-${img.id}`}
                >
                  <div class="flex items-center justify-between gap-3">
                    <div class="flex items-center gap-3">
                      <img
                        src={resolveThumbnail(img)}
                        alt=""
                        class="bg-muted h-10 w-10 rounded border object-cover"
                      />
                      <div class="flex flex-col truncate">
                        <span
                          class="text-muted-foreground max-w-[120px] truncate font-mono text-xs"
                          title={img.src.split("/").pop()}
                        >
                          {img.src.split("/").pop()}
                        </span>
                        {#if isExcluded}
                          <span class="text-[10px] font-bold text-red-500">VYLUČENO</span>
                        {/if}
                      </div>
                    </div>
                    <!-- Exclusion toggle -->
                    <Button
                      variant="ghost"
                      size="icon"
                      class="h-6 w-6 rounded-full hover:bg-red-100 dark:hover:bg-red-900/30"
                      title={isExcluded ? "Zahrnout obrázek zpět" : "Vyjmout obrázek z vkládání"}
                      onclick={() => toggleImageExclusion(img.id)}
                      data-testid={`metadata-paste-dialog-exclude-${img.id}`}
                    >
                      {#if isExcluded}
                        <RefreshCcw class="text-muted-foreground h-3.5 w-3.5" />
                      {:else}
                        <X class="h-3.5 w-3.5 text-red-500" />
                      {/if}
                    </Button>
                  </div>
                </th>
              {/each}
            </tr>
          </thead>
          <tbody class="divide-y">
            {#each gridData as row (row.key)}
              <tr class="hover:bg-muted/30">
                <!-- Field Control Cell (Sticky Left) -->
                <td
                  class={cn(
                    "bg-background valign-top sticky left-0 z-20 border-r px-4 py-3 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] transition-colors",
                    selectedFields[row.key] && "bg-blue-50 dark:bg-blue-950/40",
                  )}
                  onclick={(e) => {
                    // Prevent toggling when clicking directly on checkbox
                    if (e.target instanceof HTMLElement && e.target.closest('[role="checkbox"]'))
                      return;
                    selectedFields[row.key] = !selectedFields[row.key];
                  }}
                  data-testid={`metadata-paste-dialog-row-${row.key}`}
                >
                  <div class="flex flex-col gap-1">
                    <div class="flex cursor-pointer items-start gap-3">
                      <Checkbox
                        bind:checked={selectedFields[row.key]}
                        class="mt-1"
                        data-testid={`metadata-paste-dialog-checkbox-${row.key}`}
                      />
                      <div class="flex min-w-0 flex-1 flex-col">
                        <span class="font-medium">{row.label}</span>
                        <span
                          class="w-40 truncate font-mono text-xs text-blue-600 dark:text-blue-400"
                          title={row.sourceVal}
                        >
                          {row.sourceVal}
                        </span>
                      </div>
                    </div>
                  </div>
                </td>

                <!-- Per-Image Values -->
                {#each row.imageCells as cell (cell.imageId)}
                  <td
                    class={cn(
                      "min-w-[220px] px-4 py-3 align-top transition-opacity",
                      cell.isExcluded && "bg-muted/20 opacity-30 grayscale",
                    )}
                  >
                    <div class="flex flex-col gap-1 font-mono text-xs">
                      {#if cell.willChange}
                        <!-- Change Mode: Original -> New -->
                        <div
                          class="text-muted-foreground/60 text-[10px]"
                          aria-label="Původní hodnota"
                        >
                          {cell.originalVal}
                        </div>
                        <div
                          class="-ml-1.5 flex w-fit max-w-48 items-center gap-1.5 rounded bg-emerald-50 px-1.5 py-1 font-semibold text-emerald-600 dark:bg-emerald-950/30 dark:text-emerald-400"
                          title="Nová hodnota"
                        >
                          <span>→</span>
                          <span class="truncate">{row.sourceVal}</span>
                        </div>
                      {:else}
                        <!-- No Change Mode -->
                        <div
                          class="text-muted-foreground truncate p-1 pl-0"
                          aria-label={cell.originalVal}
                        >
                          {cell.originalVal}
                        </div>
                      {/if}
                    </div>
                  </td>
                {/each}
              </tr>
            {/each}
          </tbody>
        </table>
      {/if}
    </div>

    <Dialog.Footer class="bg-background z-20 gap-2 border-t p-4 pt-4">
      <Button variant="outline" onclick={() => (open = false)}>Zrušit</Button>
      <Button
        onclick={handleConfirm}
        disabled={images.length - excludedImageIds.size === 0}
        data-testid="metadata-paste-dialog-confirm"
      >
        Vložit ({images.length - excludedImageIds.size})
      </Button>
    </Dialog.Footer>
  </Dialog.Content>
</Dialog.Root>
