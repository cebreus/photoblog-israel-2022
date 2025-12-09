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

  type DisplayItem = ImageEntry | (Separator & { storyContent?: string });

  let { items } = $props<{
    items: DisplayItem[];
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
    <a
      data-fancybox="gallery"
      data-caption={item.alt}
      href={detailSource?.path}
      class="block focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-200 rounded-lg"
    >
      <figure
        data-label={item?.location ?? item?.caption ?? ""}
        id={item.id}
        class={`relative bg-cover bg-center rounded-lg overflow-hidden duration-500 outline-background hover:outline-orange-100 outline-4 outline-offset-2 transition-[outline-color] ease-in-out ${
          $debug ? "flex flex-col" : ""
        }`}
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
      </figure>
    </a>
  {:else if item.type === "separator" && item.location}
    {@const separatorId = item.id}
    {#if item.storyContent}
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
            {@html item.storyContent}
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
