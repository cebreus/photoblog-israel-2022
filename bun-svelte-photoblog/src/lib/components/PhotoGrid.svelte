<script lang="ts">
  import { getSources } from "$lib/utils/images";
  import type { ImageEntry, Separator, ImageSource } from "$lib/types/manifest";
  import { buttonVariants } from "$lib/components/ui/button";
  import * as Dialog from "$lib/components/ui/dialog";
  import { debug } from "$lib/stores/debug";
  import { selectedAuthors } from "$lib/stores/filters";
  import JsonViewer from "$lib/components/debug/JsonViewer.svelte";
  import { useScrollspy } from "$lib/actions/scrollspy"; // Import the useScrollspy action
  import AspectRatioIcon from "$lib/components/AspectRatioIcon.svelte";
  import { selection, editMode } from "$lib/stores/editorState";

  let { items } = $props<{
    items: DisplayItem[];
  }>();

  // Derived edit mode state
  let isEditMode = $derived($editMode);
  let hasSelection = $derived($selection.size > 0);

  function handleImageClick(id: string, e: MouseEvent) {
    if (!isEditMode) return;
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

  $effect(debugLog);

  function debugLog() {
    if ($debug) {
      console.debug("PhotoGrid render", {
        items: items.length,
        selectedAuthors: $selectedAuthors,
      });
    }
  }
</script>

{#each items as item (item.type === "image" ? item.src : item.location)}
  {#if item.type === "image"}
    {@const fallback = findFallbackSource(item)}
    <!-- style="background-image: url(/images/israel-2022/{item.placeholder});" -->
    {@const detailSource = findDetailSource(item)}
    {@const isSelected = $selection.has(item.id)}
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div
      class="relative block rounded-lg group"
      onclick={(e) => isEditMode && handleImageClick(item.id, e)}
      data-testid={`image-container-${item.id}`}
    >
      <a
        data-fancybox={isEditMode ? undefined : "gallery"}
        data-caption={item.alt}
        href={detailSource?.path}
        class={`block focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-200 rounded-lg ${isEditMode ? "pointer-events-none" : ""}`}
        onclick={(e) => {
          if (isEditMode) {
            e.preventDefault();
          }
        }}
      >
        <figure
          data-label={item?.location ?? item?.caption ?? ""}
          id={item.id}
          class={`relative bg-cover bg-center rounded-lg overflow-hidden duration-500 outline-background 
          ${isSelected ? "outline-4 outline-blue-500 ring-2 ring-blue-300" : "hover:outline-orange-100 outline-4 outline-offset-2"} 
          transition-[outline-color] ease-in-out ${$debug ? "flex flex-col" : ""}`}
          style="background-color: {item.placeholderColor}"
        >
          {#if fallback}
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
              />
            </picture>
            {#if shouldShowAspectRatioIcon(item.aspectRatio)}
              <AspectRatioIcon aspectRatio={item.aspectRatio} />
            {/if}
          {/if}
          {#if $debug}
            <div class="bg-black bg-opacity-75 p-2 w-full">
              <JsonViewer data={item} />
            </div>
          {/if}

          {#if isEditMode}
            <div
              class={`absolute inset-0 bg-black/10 transition-colors ${isSelected ? "bg-blue-500/20" : "hover:bg-black/20"}`}
            >
              <div class="absolute bottom-2 left-2 right-2 select-none pointer-events-none">
                <span
                  class="bg-black/70 text-white text-[10px] font-mono px-1.5 py-0.5 rounded shadow-sm inline-block max-w-full truncate"
                >
                  {item.src.split("/").pop()}
                </span>
              </div>
              <div class="absolute top-2 right-2">
                <div
                  class={`w-6 h-6 rounded border border-white ${isSelected ? "bg-blue-500" : "bg-black/50"} flex items-center justify-center`}
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
          {/if}
        </figure>
      </a>
    </div>
  {:else if item.type === "separator" && item.location}
    {@const separatorId = item.id}
    {#if item.story}
      <Dialog.Root>
        <Dialog.Trigger
          class="aspect-video flex flex-col items-center justify-center p-4 bg-linear-to-br from-slate-100 to-slate-300 rounded-lg duration-500 outline-background hover:outline-orange-100 outline-4 outline-offset-2 transition-[outline-color] ease-in-out"
        >
          <h3 class="text-lg">{item.location}</h3>
          {#if item.city}
            <p class="text-sm text-muted-foreground">{item.city}</p>
          {/if}
          <span
            class={buttonVariants({
              size: "sm",
              variant: "link",
              class: "text-sm mt-2",
            })}
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
          >
            {@html item.story}
          </div>
        </Dialog.Content>
      </Dialog.Root>
    {:else}
      <div
        class="aspect-video flex flex-col items-center justify-center p-4 bg-linear-to-br from-slate-100 to-slate-300 rounded-lg"
        id={separatorId}
        use:useScrollspy={{ id: separatorId }}
      >
        <h3 class="text-lg">{item.location}</h3>
        {#if item.city}
          <p class="text-sm text-muted-foreground mt-1">{item.city}</p>
        {/if}
      </div>
    {/if}
  {/if}
{/each}
