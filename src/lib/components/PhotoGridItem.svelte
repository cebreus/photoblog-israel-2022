<script lang="ts">
  import { useScrollspy } from "$lib/actions/scrollspy";
  import AspectRatioIcon from "$lib/components/AspectRatioIcon.svelte";
  import JsonViewer from "$lib/components/debug/JsonViewer.svelte";
  import * as ContextMenu from "$lib/components/ui/context-menu";
  import { debug } from "$lib/stores/debug";
  import { editMode, selection, showMetadataOverlay } from "$lib/stores/editorState";
  import { metadataClipboard } from "$lib/stores/metadataClipboard";
  import { isCurationMode } from "$lib/stores/uiState";
  import type { CurationGroup, ImageEntry, ImageSource } from "$lib/types/manifest";
  import { cn } from "$lib/utils";
  import { getSources } from "$lib/utils/images";
  import Archive from "lucide-svelte/icons/archive";
  import Check from "lucide-svelte/icons/check";
  import Copy from "lucide-svelte/icons/copy";
  import Info from "lucide-svelte/icons/info";
  import Trash2 from "lucide-svelte/icons/trash-2";

  let {
    item,
    scrollspyId,
    curationGroup,
    onDelete,
    onArchive,
    onCopyMetadata,
    onPasteMetadata,
    onKeepGroup,
    onSelect,
    mode = "grid",
  } = $props<{
    item: ImageEntry;
    scrollspyId?: string;
    curationGroup?: CurationGroup;
    onDelete?: (item: ImageEntry) => void;
    onArchive?: (item: ImageEntry) => void;
    onCopyMetadata?: (item: ImageEntry) => void;
    onPasteMetadata?: (item: ImageEntry, onlyThis?: boolean) => void;
    onKeepGroup?: (item: ImageEntry, group: CurationGroup) => void;
    onSelect?: (item: ImageEntry, shiftKey: boolean) => void;
    mode?: "grid" | "curation";
  }>();

  function isFallback(source: ImageSource) {
    return source.variant === "fallback";
  }

  function findFallbackSource(image: ImageEntry): ImageSource | undefined {
    return image.sources.find(isFallback);
  }

  function isDetail(source: ImageSource) {
    return source.variant === "detail";
  }

  function findDetailSource(image: ImageEntry): ImageSource | undefined {
    return image.sources.find(isDetail) ?? image.sources[0];
  }

  function shouldShowAspectRatioIcon(aspectRatio: string | undefined): boolean {
    if (!aspectRatio) return false;
    return !aspectRatio.startsWith("landscape");
  }

  function handleImageClick(id: string, e: MouseEvent | KeyboardEvent) {
    if (!isEditMode) return;
    if (e instanceof KeyboardEvent && e.key !== "Enter" && e.key !== " ") return;
    e.preventDefault();
    if (onSelect) {
      onSelect(item, e.shiftKey);
    } else {
      selection.toggle(id);
    }
  }

  let isEditMode = $derived($editMode);
  let isSelected = $derived($selection.has(item.id));
  let isCurationActive = $derived($isCurationMode && !!curationGroup);
  let fallback = $derived(findFallbackSource(item)!);
  let detailSource = $derived(findDetailSource(item));

  function handleKeep(e: MouseEvent) {
    if (!isCurationActive || !curationGroup) return;
    e.stopPropagation();
    e.preventDefault();
    onKeepGroup?.(item, curationGroup);
  }

  function handleDelete(e: MouseEvent) {
    e.stopPropagation();
    e.preventDefault();
    onDelete?.(item);
  }

  let isCurationModeLayout = $derived(mode === "curation");
</script>

{#snippet MetadataBlock({ item }: { item: ImageEntry })}
  <div class="space-y-1 pt-2 text-sm">
    <div class="truncate font-bold" title={item.src.split("/").pop()}>
      {item.src.split("/").pop()}
    </div>

    <div class="text-muted-foreground flex flex-col gap-0.5 text-xs">
      {#if item.date}
        <div class="flex items-center gap-1">
          <span>
            {new Date(item.date).toLocaleString([], {
              dateStyle: "short",
              timeStyle: "short",
            })}
          </span>
        </div>
      {/if}
      {#if item.author}
        <div class="truncate" title={item.author}>Author: {item.author}</div>
      {/if}
      {#if item.width && item.height}
        <div class="opacity-70">{item.width}x{item.height}</div>
      {/if}
    </div>
  </div>
{/snippet}

{#snippet CurationActions()}
  <div class="mt-auto flex items-center gap-2 pt-2">
    <button
      class="flex w-full items-center justify-center gap-2 rounded bg-red-600/90 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-red-700"
      aria-label="Smazat tuto fotku"
      onclick={handleDelete}
    >
      <Trash2 class="size-4" /> Smazat duplicitu
    </button>
  </div>
{/snippet}

{#snippet MetadataTable({ item }: { item: ImageEntry })}
  {@const fileName = item.src.split("/").pop() ?? item.src}
  {@const metadataRows = [
    { label: "Soubor", value: fileName, isTechnical: true },
    {
      label: "Datum pořízení",
      value: item.date
        ? new Date(item.date).toLocaleString([], {
            dateStyle: "short",
            timeStyle: "short",
          })
        : undefined,
    },
    { label: "Autor", value: item.author },
    { label: "Místo", value: item.location },
    { label: "Město", value: item.city },
    { label: "Stát / Provincie", value: item.exif?.state },
    {
      label: "Země",
      value: item.exif?.country
        ? `${item.exif.country}${item.exif.countryCode ? ` (${item.exif.countryCode})` : ""}`
        : item.exif?.countryCode || "",
    },
    { label: "Klíčová slova", value: item.keywords?.join(", ") },
    { label: "Popisek", value: item.caption },
    { label: "Název", value: item.exif?.title },
    {
      label: "Rozměry",
      value: item.width && item.height ? `${item.width} x ${item.height}` : "",
      isTechnical: true,
    },
    {
      label: "Velikost",
      value: item.sizeMB != null ? `${item.sizeMB} MB` : "",
      isTechnical: true,
    },
    {
      label: "Aesthetic / Sharpness",
      value: item.analysis
        ? `${item.analysis.aestheticScore?.toFixed(2) ?? ""} / ${item.analysis.sharpness?.toFixed(2) ?? "—"}`
        : "—",
      isTechnical: true,
    },
  ]}

  {#if $showMetadataOverlay}
    <div data-testid="photo-grid-item-metadata-container">
      <table
        class="mt-2 w-full rounded-md text-xs bg-slate-50 dark:bg-slate-950"
        data-testid="photo-grid-item-metadata-table"
      >
        <tbody>
          {#each metadataRows as field, index}
            <tr
              class={index < metadataRows.length - 1
                ? "border-b border-slate-400 dark:border-slate-700"
                : ""}
              data-testid="photo-grid-item-metadata-row-{field.label
                .toLowerCase()
                .replace(/\s+/g, '-')}"
            >
              <th class="text-muted-foreground min-w-16 px-1 py-1 align-baseline font-medium">
                {field.label}
              </th>
              <td
                class={cn(
                  "line-clamp-3 w-full max-w-full min-w-0 py-1 font-mono",
                  field.isTechnical && "text-muted-foreground",
                )}
              >
                {#if field.value}
                  {field.value}
                {:else}
                  <span class="text-muted-foreground"></span>
                {/if}
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  {/if}
{/snippet}

<ContextMenu.Root>
  <ContextMenu.Trigger
    class={cn(
      "group relative block rounded-lg text-left",
      isCurationModeLayout
        ? "flex w-64 flex-col rounded border bg-white p-2 shadow-sm transition-shadow hover:shadow-md dark:bg-slate-800"
        : "",
    )}
    data-testid={`photo-grid-item-container-${item.id}`}
    disabled={!isEditMode && !isCurationActive}
  >
    <svelte:element
      this={isEditMode ? "div" : "a"}
      href={isEditMode || (isCurationActive && !isCurationModeLayout)
        ? undefined
        : detailSource?.path}
      data-fancybox={isEditMode || (isCurationActive && !isCurationModeLayout)
        ? undefined
        : "gallery"}
      data-caption={isEditMode || (isCurationActive && !isCurationModeLayout)
        ? undefined
        : item.alt}
      class="group relative block rounded-lg text-left"
      data-testid="photo-grid-item"
    >
      <figure
        data-label={item?.location ?? item?.caption ?? ""}
        id={item.id}
        data-testid="photo-grid-item-figure-{item.id}"
        class={cn(
          "outline-background relative aspect-video overflow-hidden rounded-lg border-2 border-transparent bg-cover bg-center transition-[outline-color,border-color] duration-300 ease-in-out",
          isSelected
            ? "ring-2 ring-blue-300 outline-4 outline-blue-500"
            : "outline-4 outline-offset-2 hover:outline-orange-100",
          // Only apply amber border if NOT in curation layout mode (where layout itself indicates grouping)
          isCurationActive &&
            !isCurationModeLayout &&
            "border-amber-500 outline-2 outline-amber-500/50",
          $debug && "flex flex-col",
        )}
        style={`background-color: ${item.placeholderColor}`}
      >
        {#if scrollspyId}
          <div
            id={scrollspyId}
            use:useScrollspy={{ id: scrollspyId }}
            class="pointer-events-none absolute inset-0"
            data-testid="photo-grid-item-scrollspy-anchor-{scrollspyId}"
          ></div>
        {/if}
        <picture class={`${$debug ? "shrink-0" : ""}`}>
          {#each getSources(item) as source (source.type)}
            <source
              type={source.type}
              srcset={source.srcset}
              sizes="(min-width: 1280px) 25vw, (min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
            />
          {/each}
          <img
            src={fallback.path}
            alt={item.alt}
            loading="lazy"
            class="h-full w-full cursor-zoom-in object-cover"
            width={fallback.width}
            height={fallback.height}
            data-testid="photo-grid-item-image-{item.id}"
          />
        </picture>
      </figure>

      {#if isCurationActive && !isCurationModeLayout}
        <div class="pointer-events-none absolute top-2 left-2">
          <div class="rounded bg-amber-500 px-1.5 py-0.5 text-[10px] font-bold text-white shadow">
            DUPLICITY
          </div>
        </div>
      {/if}

      {#if shouldShowAspectRatioIcon(item.aspectRatio)}
        <AspectRatioIcon aspectRatio={item.aspectRatio} />
      {/if}

      {#if isEditMode || (isCurationActive && !isCurationModeLayout)}
        <!-- svelte-ignore a11y_click_events_have_key_events -->
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <div
          class={cn(
            "absolute inset-0 aspect-video cursor-pointer transition-colors",
            isSelected ? "bg-blue-500/20" : "hover:bg-black/20",
            isCurationActive && !isCurationModeLayout && "bg-amber-500/10 hover:bg-amber-500/20",
            !isEditMode && isCurationActive ? "" : "bg-black/10",
          )}
          data-testid={`photo-grid-item-overlay-${item.id}`}
          onclick={(e: MouseEvent) => (isEditMode ? handleImageClick(item.id, e) : undefined)}
        >
          {#if isEditMode}
            <div class="pointer-events-auto absolute top-2 right-2">
              <div
                class={`h-6 w-6 rounded border border-white ${isSelected ? "bg-blue-500" : "bg-black/50"} flex shrink-0 items-center justify-center`}
                data-testid="photo-grid-item-checkbox-{item.id}"
              >
                {#if isSelected}
                  <svg
                    data-testid={`photo-grid-item-selection-indicator-${item.id}`}
                    xmlns="http://www.w3.org/2000/svg"
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="3"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    class="text-white"><polyline points="20 6 9 17 4 12"></polyline></svg
                  >
                {/if}
              </div>
            </div>
          {/if}

          {#if isCurationActive && !isCurationModeLayout}
            <div
              class="pointer-events-none absolute inset-0 flex items-center justify-center gap-2"
            >
              <div
                class="pointer-events-auto flex items-center gap-4 rounded-full bg-black/60 p-2 backdrop-blur-sm"
              >
                <button
                  class="rounded-full bg-green-600 p-2 text-white transition-colors hover:bg-green-700"
                  aria-label="Ponechat tuto fotku a smazat ostatní"
                  onclick={handleKeep}
                >
                  <Check class="size-6" />
                </button>
                <button
                  class="rounded-full bg-red-600 p-2 text-white transition-colors hover:bg-red-700"
                  aria-label="Smazat tuto fotku"
                  onclick={handleDelete}
                >
                  <Trash2 class="size-6" />
                </button>
                <button
                  class="rounded-full bg-slate-600 p-2 text-white transition-colors hover:bg-slate-700"
                  aria-label="Informace o skupině"
                >
                  <Info class="size-6" />
                </button>
              </div>
            </div>
          {/if}
        </div>
      {:else}
        <!-- Ensure clickable link visually implies action if hovered? -->
        <span class="sr-only">Open detail</span>
      {/if}
    </svelte:element>

    {@render MetadataTable({ item })}

    {#if $debug}
      <div
        class="mt-2 rounded-md bg-slate-950 p-2 overflow-x-auto whitespace-nowrap text-xs text-white"
      >
        <JsonViewer data={item} />
      </div>
    {/if}
    {#if isCurationModeLayout}
      {@render MetadataBlock({ item })}
      {@render CurationActions()}
    {/if}
  </ContextMenu.Trigger>

  {#if isEditMode}
    <ContextMenu.Portal>
      <ContextMenu.Content class="w-56">
        <ContextMenu.Item
          class="flex items-center gap-2"
          onclick={() => onCopyMetadata?.(item)}
          data-testid="photo-grid-item-contextmenu-copy-metadata"
        >
          <Copy class="h-4 w-4" />
          <span>Kopírovat metadata</span>
        </ContextMenu.Item>

        {#if $metadataClipboard.sourceImage?.id !== item.id && $metadataClipboard.data}
          <!-- Paste to ALL selected -->
          {#if $selection.has(item.id) && $selection.size > 1}
            <ContextMenu.Item
              class="flex items-center gap-2"
              onclick={() => onPasteMetadata?.(item)}
              data-testid="photo-grid-item-contextmenu-paste-metadata-selection"
            >
              <div class="flex flex-1 items-center gap-2">
                <Copy class="h-4 w-4 rotate-180" />
                <span>Vložit na {$selection.size} vybraných</span>
              </div>
            </ContextMenu.Item>

            <!-- Paste ONLY to this one (ignoring selection) -->
            <ContextMenu.Item
              class="flex items-center gap-2"
              onclick={() => onPasteMetadata?.(item, true)}
              data-testid="photo-grid-item-contextmenu-paste-metadata-single"
            >
              <div class="text-muted-foreground flex flex-1 items-center gap-2 pl-6 text-xs">
                <span>↳ Pouze na tento obrázek</span>
              </div>
            </ContextMenu.Item>
          {:else}
            <!-- Standard single paste -->
            <ContextMenu.Item
              class="flex items-center gap-2"
              onclick={() => onPasteMetadata?.(item)}
              data-testid="photo-grid-item-contextmenu-paste-metadata"
            >
              <Copy class="h-4 w-4 rotate-180" />
              <span>Vložit metadata</span>
            </ContextMenu.Item>
          {/if}
        {/if}

        <ContextMenu.Separator />

        <ContextMenu.Item
          class="flex items-center gap-2 text-red-600 focus:bg-red-50 focus:text-red-600 dark:focus:bg-red-950"
          onclick={() => onDelete?.(item)}
          data-testid="photo-grid-item-contextmenu-delete-image"
        >
          <Trash2 class="h-4 w-4" />
          <span>Smazat obrázek</span>
        </ContextMenu.Item>

        <ContextMenu.Item
          class="flex items-center gap-2"
          onclick={() => onArchive?.(item)}
          data-testid="photo-grid-item-contextmenu-archive-image"
        >
          <Archive class="h-4 w-4" />
          <span>Archivovat fotku</span>
        </ContextMenu.Item>
      </ContextMenu.Content>
    </ContextMenu.Portal>
  {/if}
</ContextMenu.Root>
