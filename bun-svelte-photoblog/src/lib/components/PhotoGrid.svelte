<script lang="ts">
  import { getSources } from "$lib/utils/images";
  import type { ImageEntry, Separator, ImageSource } from "$lib/types/manifest";
  import { buttonVariants } from "$lib/components/ui/button";
  import * as Dialog from "$lib/components/ui/dialog";
  import * as ContextMenu from "$lib/components/ui/context-menu";
  import { debug } from "$lib/stores/debug";
  import { selectedAuthors } from "$lib/stores/filters";
  import JsonViewer from "$lib/components/debug/JsonViewer.svelte";
  import { useScrollspy } from "$lib/actions/scrollspy"; // Import the useScrollspy action
  import AspectRatioIcon from "$lib/components/AspectRatioIcon.svelte";
  import DeleteImageDialog from "$lib/components/DeleteImageDialog.svelte";
  import MetadataPasteDialog from "$lib/components/MetadataPasteDialog.svelte";
  import { selection, editMode } from "$lib/stores/editorState";
  import { metadataClipboard } from "$lib/stores/metadataClipboard";
  import { toast } from "svelte-sonner";
  import { invalidateAll } from "$app/navigation";
  import { page } from "$app/stores";
  import { Trash2, Copy } from "lucide-svelte";

  let { items } = $props<{
    items: DisplayItem[];
  }>();

  // Derived edit mode state
  let isEditMode = $derived($editMode);
  let hasSelection = $derived($selection.size > 0);

  function handleImageClick(id: string, e: MouseEvent | KeyboardEvent) {
    if (!isEditMode) return;
    if (e instanceof KeyboardEvent && e.key !== "Enter" && e.key !== " ")
      return;
    e.preventDefault();
    selection.toggle(id);
  }

  $effect(() => {
    // Clear selection if mode disabled
    if (!isEditMode && $selection.size > 0) {
      selection.clear();
    }
  });

  type DisplayItem = ImageEntry | Separator;

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

  let isDeleting = $state(false);
  let deleteDialogOpen = $state(false);
  let imageToDelete = $state<ImageEntry | null>(null);

  let isPastingOpen = $state(false);
  let imagesToPaste = $state<ImageEntry[]>([]);
  let isApplyingPaste = $state(false);

  function openDeleteDialog(item: ImageEntry) {
    imageToDelete = item;
    deleteDialogOpen = true;
  }

  async function confirmDelete() {
    if (!imageToDelete) return;

    isDeleting = true;
    try {
      const itemsToDelete = [{ id: imageToDelete.id, src: imageToDelete.src }];

      const res = await fetch("/api/images", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: itemsToDelete }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Chyba při mazání souboru");
      }

      const result = await res.json();

      if (result.errors && result.errors.length > 0) {
        result.errors.forEach((e: string) => toast.warning(e));
      }

      if (result.deleted.length > 0) {
        toast.success(`Úspěšně smazán soubor. Stránka se obnoví.`);
      }

      // Close dialog
      deleteDialogOpen = false;

      // Remove from selection if selected
      if ($selection.has(imageToDelete.id)) {
        selection.remove(imageToDelete.id);
      }

      // Refresh data to remove deleted image from grid
      await invalidateAll();

      // Clear the imageToDelete
      imageToDelete = null;
    } catch (e: any) {
      console.error(e);
      toast.error(`Nepodařilo se smazat soubor: ${e.message}`);
    } finally {
      isDeleting = false;
    }
  }

  function handleCopyMetadata(item: ImageEntry) {
    metadataClipboard.copy(item);
    toast.success(`Metadata zkopírována z "${item.src.split("/").pop()}"`);
  }

  function handlePasteMetadata(item: ImageEntry) {
    const clipboard = $metadataClipboard;

    // Prevent pasting to the same image that was copied
    if (clipboard.sourceImage?.id === item.id) {
      toast.error(
        "Nemůžete vkládat metadata do stejného obrázku, ze kterého jste je kopírovali",
      );
      return;
    }

    imagesToPaste = [item];
    isPastingOpen = true;
  }

  async function confirmPaste(fieldsToApply: Record<string, boolean>) {
    const clipboard = $metadataClipboard;

    if (!clipboard.data || imagesToPaste.length === 0) return;

    isApplyingPaste = true;
    try {
      const updatePayload = {
        images: imagesToPaste.map((img) => ({
          id: img.id,
          src: img.src,
        })),
        updates: {
          title:
            fieldsToApply.title && clipboard.data.title
              ? clipboard.data.title
              : undefined,
          author:
            fieldsToApply.author && clipboard.data.author
              ? clipboard.data.author
              : undefined,
          location:
            fieldsToApply.location && clipboard.data.location
              ? clipboard.data.location
              : undefined,
          city:
            fieldsToApply.city && clipboard.data.city
              ? clipboard.data.city
              : undefined,
          state:
            fieldsToApply.state && clipboard.data.state
              ? clipboard.data.state
              : undefined,
          country:
            fieldsToApply.country && clipboard.data.country
              ? clipboard.data.country
              : undefined,
          countryCode:
            fieldsToApply.countryCode && clipboard.data.countryCode
              ? clipboard.data.countryCode
              : undefined,
          caption:
            fieldsToApply.caption && clipboard.data.caption
              ? clipboard.data.caption
              : undefined,
          keywords:
            fieldsToApply.keywords && clipboard.data.keywords?.length
              ? clipboard.data.keywords
              : undefined,
        },
      };

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
    } catch (e: any) {
      console.error(e);
      toast.error(`Chyba: ${e.message}`);
    } finally {
      isApplyingPaste = false;
    }
  }

  $effect(debugLog);

  function debugLog() {
    console.log("PhotoGrid debug store value:", $debug);
    if ($debug) {
      console.debug("PhotoGrid render", {
        items: items.length,
        selectedAuthors: $selectedAuthors,
      });
    }
  }
</script>

{#snippet MetadataTable({ item }: { item: ImageEntry })}
  {@const fileName = item.src.split("/").pop() ?? item.src}
  {@const metadataRows = [
    { label: "Soubor", value: fileName },
    { label: "Popisek", value: item.caption },
    { label: "Místo", value: item.location },
    { label: "Město", value: item.city },
    { label: "Stát / Provincie", value: item.exif?.state },
    {
      label: "Země",
      value: item.exif?.country
        ? `${item.exif.country}${item.exif.countryCode ? ` (${item.exif.countryCode})` : ""}`
        : item.exif?.countryCode || "∅",
    },
    { label: "Klíčová slova", value: item.keywords?.join(", ") },
    { label: "Autor", value: item.author },
    { label: "Název", value: item.exif?.title },
  ]}

  <div data-testid="image-metadata-container">
    <table
      class="w-full text-[10px] bg-slate-900/70 rounded-sm"
      data-testid="image-metadata-table"
    >
      <tbody>
        {#each metadataRows as field, index}
          <tr
            class={index < metadataRows.length - 1
              ? "border-b border-slate-600"
              : ""}
            data-testid="metadata-row-{field.label
              .toLowerCase()
              .replace(/\s+/g, '-')}"
          >
            <td
              class="px-1 align-top text-muted-foreground font-medium min-w-16 pb-0.5 whitespace-nowrap"
            >
              {field.label}
            </td>
            <td class="font-mono truncate max-w-full min-w-0 w-full pb-0.5">
              {#if field.value}
                {field.value}
              {:else}
                <span class="text-muted-foreground">-</span>
              {/if}
            </td>
          </tr>
        {/each}
      </tbody>
    </table>
  </div>
{/snippet}

{#snippet ImageItem({ item }: { item: ImageEntry })}
  {@const fallback = findFallbackSource(item)!}
  {@const detailSource = findDetailSource(item)}
  {@const isSelected = $selection.has(item.id)}

  <ContextMenu.Root>
    <ContextMenu.Trigger
      class="relative block rounded-lg group text-left"
      data-testid={`image-container-${item.id}`}
      disabled={!isEditMode}
    >
      <svelte:element
        this={isEditMode ? "div" : "a"}
        href={isEditMode ? undefined : detailSource?.path}
        data-fancybox={isEditMode ? undefined : "gallery"}
        data-caption={isEditMode ? undefined : item.alt}
        class="relative block rounded-lg group text-left"
      >
        <figure
          data-label={item?.location ?? item?.caption ?? ""}
          id={item.id}
          data-testid="image-figure-{item.id}"
          class={`relative bg-cover bg-center rounded-lg overflow-hidden duration-500 outline-background 
          ${isSelected ? "outline-4 outline-blue-500 ring-2 ring-blue-300" : "hover:outline-orange-100 outline-4 outline-offset-2"} 
          transition-[outline-color] ease-in-out ${$debug ? "flex flex-col" : ""}`}
          style={`background-color: ${item.placeholderColor}`}
        >
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
              class="w-full h-full object-cover cursor-zoom-in"
              width={fallback.width}
              height={fallback.height}
              data-testid="image-{item.id}"
            />
          </picture>
          {#if shouldShowAspectRatioIcon(item.aspectRatio)}
            <AspectRatioIcon aspectRatio={item.aspectRatio} />
          {/if}

          {#if $debug}
            <div class="bg-black bg-opacity-75 p-2 w-full">
              <JsonViewer data={item} />
            </div>
          {/if}

          {#if isEditMode}
            <!-- svelte-ignore a11y_click_events_have_key_events -->
            <!-- svelte-ignore a11y_no_static_element_interactions -->
            <div
              class={`absolute inset-0 bg-black/10 transition-colors cursor-pointer ${isSelected ? "bg-blue-500/20" : "hover:bg-black/20"}`}
              data-testid="image-edit-overlay-{item.id}"
              onclick={(e: MouseEvent) => handleImageClick(item.id, e)}
            >
              <!-- svelte-ignore a11y_no_static_element_interactions -->
              <div
                class="absolute bottom-2 left-2 right-2 pointer-events-auto select-text"
                onclick={(e) => e.stopPropagation()}
              >
                {@render MetadataTable({ item })}
              </div>
              <div class="absolute top-2 right-2 pointer-events-auto">
                <div
                  class={`w-6 h-6 rounded border border-white ${isSelected ? "bg-blue-500" : "bg-black/50"} flex items-center justify-center shrink-0`}
                  data-testid="image-checkbox-{item.id}"
                >
                  {#if isSelected}
                    <svg
                      data-testid="image-selection-checkbox"
                      xmlns="http://www.w3.org/2000/svg"
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="3"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      class="text-white"
                      ><polyline points="20 6 9 17 4 12"></polyline></svg
                    >
                  {/if}
                </div>
              </div>
            </div>
          {:else}
            <span class="sr-only">Open detail</span>
          {/if}
        </figure>
      </svelte:element>
    </ContextMenu.Trigger>

    {#if isEditMode}
      <ContextMenu.Portal>
        <ContextMenu.Content class="w-56">
          <ContextMenu.Item
            class="flex items-center gap-2"
            onclick={() => handleCopyMetadata(item)}
          >
            <Copy class="h-4 w-4" />
            <span>Kopírovat metadata</span>
          </ContextMenu.Item>

          {#if $metadataClipboard.sourceImage?.id !== item.id && $metadataClipboard.data}
            <ContextMenu.Item
              class="flex items-center gap-2"
              onclick={() => handlePasteMetadata(item)}
            >
              <Copy class="h-4 w-4 rotate-180" />
              <span>Vložit metadata</span>
            </ContextMenu.Item>
          {/if}

          <ContextMenu.Separator />

          <ContextMenu.Item
            class="flex items-center gap-2 text-red-600 focus:text-red-600 focus:bg-red-50 dark:focus:bg-red-950"
            onclick={() => openDeleteDialog(item)}
          >
            <Trash2 class="h-4 w-4" />
            <span>Smazat obrázek</span>
          </ContextMenu.Item>
        </ContextMenu.Content>
      </ContextMenu.Portal>
    {/if}
  </ContextMenu.Root>
{/snippet}

{#each items as item (item.type === "image" ? item.src : item.location)}
  {#if item.type === "image"}
    {@render ImageItem({ item })}
  {:else if item.type === "separator" && item.location}
    {@const separatorId = item.id}
    {#if item.story}
      <Dialog.Root>
        <Dialog.Trigger
          class="aspect-video flex flex-col items-center justify-center p-4 bg-linear-to-br from-slate-100 to-slate-300 rounded-lg duration-500 outline-background hover:outline-orange-100 outline-4 outline-offset-2 transition-[outline-color] ease-in-out dark:from-slate-700 dark:to-slate-800"
          data-testid="separator-trigger-{separatorId}"
        >
          <h3 class="text-lg" data-testid="separator-location">
            {item.location}
          </h3>
          {#if item.city}
            <p
              class="text-sm text-muted-foreground"
              data-testid="separator-city"
            >
              {item.city}
            </p>
          {/if}
          <span
            class={buttonVariants({
              size: "sm",
              variant: "link",
              class: "text-sm mt-2",
            })}
            data-testid="separator-show-story"
          >
            Zobrazit příběh
          </span>
        </Dialog.Trigger>
        <Dialog.Content>
          <Dialog.Header>
            <Dialog.Title>{item.location}</Dialog.Title>
            {#if item.city}
              <Dialog.Description>{item.city}</Dialog.Description>
            {/if}
          </Dialog.Header>
          <div
            class="prose prose-sm dark:prose-invert max-w-none mt-4"
            id={separatorId}
            use:useScrollspy={{ id: separatorId }}
            data-testid="separator-story-{separatorId}"
          >
            {@html item.story}
          </div>
        </Dialog.Content>
      </Dialog.Root>
    {:else}
      <div
        class="aspect-video flex flex-col items-center justify-center p-4 bg-linear-to-br from-slate-100 to-slate-300 rounded-lg dark:from-slate-700 dark:to-slate-800"
        id={separatorId}
        use:useScrollspy={{ id: separatorId }}
        data-testid="separator-simple-{separatorId}"
      >
        <h3 class="text-lg" data-testid="separator-location">
          {item.location}
        </h3>
        {#if item.city}
          <p class="text-sm text-muted-foreground mt-1">{item.city}</p>
        {/if}
      </div>
    {/if}
  {/if}
{/each}

{#if imageToDelete}
  <DeleteImageDialog
    bind:open={deleteDialogOpen}
    images={[imageToDelete]}
    {isDeleting}
    onConfirm={confirmDelete}
  />
{/if}

{#if imagesToPaste.length > 0 && $metadataClipboard.data}
  <MetadataPasteDialog
    bind:open={isPastingOpen}
    images={imagesToPaste}
    sourceImage={$metadataClipboard.sourceImage!}
    clipboardData={$metadataClipboard.data}
    isApplying={isApplyingPaste}
    onConfirm={confirmPaste}
  />
{/if}
