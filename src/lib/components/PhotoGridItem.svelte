<script lang="ts">
  import Archive from "@lucide/svelte/icons/archive";
  import ArrowRightLeft from "@lucide/svelte/icons/arrow-right-left";
  import Copy from "@lucide/svelte/icons/copy";
  import Trash2 from "@lucide/svelte/icons/trash-2";

  import { useScrollspy } from "$lib/actions/scrollspy";
  import AspectRatioIcon from "$lib/components/AspectRatioIcon.svelte";
  import JsonViewer from "$lib/components/debug/JsonViewer.svelte";
  import { Button } from "$lib/components/ui/button";
  import * as ContextMenu from "$lib/components/ui/context-menu";
  import { editor } from "$lib/stores/editor.svelte";
  import { metadataClipboard } from "$lib/stores/metadata-clipboard.svelte";
  import { people } from "$lib/stores/people.svelte";
  import { ui } from "$lib/stores/ui.svelte";
  import type { CurationGroup, ImageEntry, ImageSource } from "$lib/types/manifest";
  import { cn } from "$lib/utils";
  import { getSources } from "$lib/utils/images";

  let {
    item,
    scrollspyId,
    curationGroup,
    onDelete,
    onArchive,
    onCopyMetadata,
    onPasteMetadata,

    onOpenCurationDialog,
    onSelect,
    mode = "grid",
    isAnchor = false,
  } = $props<{
    item: ImageEntry;
    scrollspyId?: string;
    curationGroup?: CurationGroup;
    onDelete?: (item: ImageEntry) => void;
    onArchive?: (item: ImageEntry) => void;
    onCopyMetadata?: (item: ImageEntry) => void;
    onPasteMetadata?: (item: ImageEntry, onlyThis?: boolean) => void;
    onOpenCurationDialog?: (group: CurationGroup) => void;
    onSelect?: (item: ImageEntry, shiftKey: boolean) => void;
    mode?: "grid" | "curation";
    isAnchor?: boolean;
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

  function isAdminThumb(source: ImageSource) {
    return source.variant === "admin_thumb";
  }

  function findAdminThumbSource(image: ImageEntry): ImageSource | undefined {
    return image.sources.find(isAdminThumb);
  }

  function shouldShowAspectRatioIcon(aspectRatio: string | undefined): boolean {
    if (!aspectRatio) return false;
    return !aspectRatio.startsWith("landscape");
  }

  function handleImageClick(id: string, e: MouseEvent | KeyboardEvent) {
    if (!editor.editMode) return;
    if (e instanceof KeyboardEvent && e.key !== "Enter" && e.key !== " ") return;
    e.preventDefault();
    if (onSelect) {
      onSelect(item, e.shiftKey);
    } else {
      editor.toggleSelection(id);
    }
  }

  let isSelected = $derived(editor.selection.has(item.id));
  let showCurationVisuals = $derived(ui.isCurationVisualsVisible(!!curationGroup, mode));
  let fallback = $derived(findFallbackSource(item) ?? item.sources[0]);
  let detailSource = $derived(findDetailSource(item));
  let adminThumb = $derived(findAdminThumbSource(item));

  // Simplified conditional logic via derived values
  let isInteractive = $derived(editor.editMode || showCurationVisuals);
  let elementTag = $derived(isInteractive ? "div" : "a");
  let linkHref = $derived(isInteractive ? undefined : detailSource?.path);
  let fancyboxAttr = $derived(isInteractive ? undefined : "gallery");
  let captionAttr = $derived(isInteractive ? undefined : item.alt);

  function handleOpenDialog(e: MouseEvent) {
    if (!ui.curationMode || !curationGroup) return;
    e.stopPropagation();
    e.preventDefault();
    onOpenCurationDialog?.(curationGroup);
  }

  function handleDelete(e: MouseEvent) {
    e.stopPropagation();
    e.preventDefault();
    onDelete?.(item);
  }
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
  <div class="mt-auto flex flex-col items-stretch gap-2 pt-2">
    <div class="flex items-center gap-2">
      <Button
        variant="destructive"
        size="sm"
        class="flex-1 gap-2"
        onclick={handleDelete}
        aria-label="Smazat tuto fotku"
      >
        <Trash2 class="size-3" />
        Smazat
      </Button>
      <Button
        variant="secondary"
        size="sm"
        class="flex-1 gap-2 border border-slate-200 dark:border-slate-800"
        onclick={(e) => {
          e.stopPropagation();
          onArchive?.(item);
        }}
        aria-label="Archivovat tuto fotku"
      >
        <Archive class="size-3" />
        Archivovat
      </Button>
    </div>
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
    {
      label: "Lidé",
      value: (item.people || [])
        .map((id) => people.people.find((p) => p.id === id)?.name)
        .filter(Boolean)
        .join(", "),
      isTechnical: true,
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
        ? `${item.analysis.aestheticScore?.toFixed(2) ?? ""} / ${item.analysis.sharpness?.toFixed(2) ?? "—"}<br /><span title="Quality Bucket">${item.analysis.qualityBucket ?? "—"}</span>`
        : "—",
      isTechnical: true,
    },
  ]}

  {#if editor.showMetadataOverlay}
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
                  "line-clamp-3 w-full max-w-full min-w-0 py-1 font-mono whitespace-pre-line",
                  field.isTechnical && "text-muted-foreground",
                )}
              >
                {#if field.value}
                  {@html field.value}
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
      mode === "curation"
        ? "flex w-64 flex-col rounded border bg-white p-2 shadow-sm transition-shadow hover:shadow-md dark:bg-slate-800"
        : "",
    )}
    data-testid={`photo-grid-item-container-${item.id}`}
    disabled={!editor.editMode && !(ui.curationMode && !!curationGroup)}
  >
    <svelte:element
      this={editor.editMode ? "div" : "a"}
      href={editor.editMode || showCurationVisuals ? undefined : detailSource?.path}
      data-fancybox={editor.editMode || showCurationVisuals ? undefined : "gallery"}
      data-caption={editor.editMode || showCurationVisuals ? undefined : item.alt}
      class="group relative block rounded-lg text-left"
      data-testid="photo-grid-item"
    >
      <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
      <!-- svelte-ignore a11y_click_events_have_key_events -->
      <figure
        data-label={item?.location ?? item?.caption ?? ""}
        id={item.id}
        data-testid="photo-grid-item-figure-{item.id}"
        class={cn(
          "outline-background relative overflow-hidden rounded-lg border-2 border-transparent bg-cover bg-center transition-[outline-color,border-color] duration-300 ease-in-out",
          editor.editMode ? "aspect-square" : "aspect-video",
          isSelected
            ? "ring-2 ring-blue-300 outline-4 outline-blue-500"
            : "outline-4 outline-offset-2 hover:outline-orange-100",
          showCurationVisuals && "border-amber-500 outline-2 outline-amber-500/50",
          ui.debugMode && "flex flex-col",
        )}
        style={`background-color: ${item.placeholderColor}`}
        onclick={(e) => (editor.editMode ? handleImageClick(item.id, e) : undefined)}
      >
        {#if scrollspyId}
          <div
            id={isAnchor ? scrollspyId : undefined}
            use:useScrollspy={{ id: scrollspyId }}
            class="pointer-events-none absolute inset-0"
            data-testid="photo-grid-item-scrollspy-anchor-{scrollspyId}"
          ></div>
        {/if}
        {#if !editor.editMode}
          <picture class={`${ui.debugMode ? "shrink-0" : ""}`}>
            {#each getSources(item) as source (source.type)}
              <source
                type={source.type}
                srcset={source.srcset}
                sizes="(min-width: 1280px) 25vw, (min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
              />
            {/each}
            <img
              src={fallback?.path ?? ""}
              alt={item.alt}
              loading="lazy"
              class="h-full w-full cursor-zoom-in object-cover"
              width={fallback.width}
              height={fallback.height}
              data-testid="photo-grid-item-image-{item.id}"
            />
          </picture>
        {:else}
          <img
            src={adminThumb?.path ?? item.adminThumbUrl}
            alt={item.alt}
            loading="lazy"
            class="h-full w-full object-contain"
            width={item.width}
            height={item.height}
            data-testid="photo-grid-item-image-edit-mode-{item.id}"
          />
        {/if}
      </figure>

      {#if showCurationVisuals}
        <div class="pointer-events-none absolute top-2 left-2 flex flex-col gap-1">
          <div class="rounded bg-amber-500 px-1.5 py-0.5 text-[10px] font-bold text-white shadow">
            DUPLICITY
          </div>
          {#if item.id === curationGroup?.bestCandidateId}
            <div
              class="rounded bg-green-600 px-1.5 py-0.5 text-[10px] font-bold text-white shadow"
              data-testid="curation-recommendation-badge"
            >
              DOPORUČENO
            </div>
          {/if}
        </div>
      {/if}

      {#if shouldShowAspectRatioIcon(item.aspectRatio)}
        <AspectRatioIcon aspectRatio={item.aspectRatio} />
      {/if}

      {#if editor.editMode || showCurationVisuals}
        <!-- svelte-ignore a11y_click_events_have_key_events -->
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <div
          class={cn(
            "absolute inset-0 cursor-pointer transition-colors",
            editor.editMode ? "aspect-square" : "aspect-video",
            isSelected ? "bg-blue-500/20" : "hover:bg-black/20",
            showCurationVisuals && "bg-amber-500/10 hover:bg-amber-500/20",
            !editor.editMode && ui.curationMode && !!curationGroup ? "" : "bg-black/10",
          )}
          data-testid={`photo-grid-item-overlay-${item.id}`}
          onclick={(e: MouseEvent) => (editor.editMode ? handleImageClick(item.id, e) : undefined)}
        >
          {#if editor.editMode}
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

          {#if showCurationVisuals}
            <div
              class="pointer-events-none absolute inset-0 flex items-center justify-center gap-2"
            >
              <Button
                variant="secondary"
                class="pointer-events-auto shadow-lg"
                onclick={handleOpenDialog}
              >
                <ArrowRightLeft class="mr-2 size-4" />
                Porovnat duplicity
              </Button>
            </div>
          {/if}
        </div>
      {:else}
        <!-- Ensure clickable link visually implies action if hovered? -->
        <span class="sr-only">Open detail</span>
      {/if}
    </svelte:element>

    {@render MetadataTable({ item })}

    {#if ui.debugMode}
      <div
        class="mt-2 rounded-md bg-slate-950 p-2 overflow-x-auto whitespace-nowrap text-xs text-white"
      >
        <JsonViewer data={item} />
      </div>
    {/if}
    {#if mode === "curation"}
      {@render MetadataBlock({ item })}
      {@render CurationActions()}
    {/if}
  </ContextMenu.Trigger>

  {#if editor.editMode}
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

        {#if metadataClipboard.sourceImage?.id !== item.id && metadataClipboard.data}
          <!-- Paste to ALL selected -->
          {#if editor.selection.has(item.id) && editor.selection.size > 1}
            <ContextMenu.Item
              class="flex items-center gap-2"
              onclick={() => onPasteMetadata?.(item)}
              data-testid="photo-grid-item-contextmenu-paste-metadata-selection"
            >
              <div class="flex flex-1 items-center gap-2">
                <Copy class="h-4 w-4 rotate-180" />
                <span>Vložit na {editor.selection.size} vybraných</span>
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
