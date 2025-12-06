<script lang="ts">
  import { getSources } from "$lib/images";
  import type { ImageEntry, Separator, ImageSource } from "$lib/types/manifest";
  import { buttonVariants } from "$lib/components/ui/button";
  import { marked } from "marked";
  import * as Dialog from "$lib/components/ui/dialog";
  import { debug } from "$lib/stores/debug";
  import JsonViewer from "$lib/components/debug/JsonViewer.svelte";

  let { items } = $props<{
    items: (ImageEntry | Separator)[];
  }>();

  function renderStoryHtml(separator: Separator) {
    return separator.storyContent ? marked.parse(separator.storyContent) : "";
  }

  function findFallbackSource(image: ImageEntry): ImageSource | undefined {
    return image.sources.find((source) => source.variant === "fallback");
  }
</script>

{#each items as item (item.type === "image" ? item.src : item.location)}
  {#if item.type === "image"}
    {@const fallback = findFallbackSource(item)}
    <!-- style="background-image: url(/images/israel-2022/{item.placeholder});" -->
    <figure
      id={item.id}
      class={`bg-cover bg-center bg-[${
        item.placeholderColor
      }] rounded-lg overflow-hidden shadow-lg transition-transform duration-300 hover:scale-105 ${
        $debug ? "flex flex-col" : ""
      }`}
    >
      {#if fallback}
        <picture class={`${$debug ? "flex-shrink-0" : ""}`}>
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
            class="w-full h-full object-cover"
            width={fallback.width}
            height={fallback.height}
          />
        </picture>
      {/if}
      {#if $debug}
        <div class="bg-black bg-opacity-75 p-2 w-full">
          <JsonViewer data={item} />
        </div>
      {/if}
    </figure>
  {:else if item.type === "separator" && item.location}
    {@const separatorId = item.id}
    {#if item.storyContent}
      <Dialog.Root>
        <Dialog.Trigger
          class="aspect-video flex flex-col items-center justify-center p-4 bg-slate-100 dark:bg-slate-800/50 rounded-lg shadow-lg transition-transform duration-300 hover:scale-105 hover:ring-2 hover:ring-primary focus:outline-none"
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
          >
            {@html renderStoryHtml(item)}
          </div>
        </Dialog.Content>
      </Dialog.Root>
    {:else}
      <div
        class="aspect-video flex flex-col items-center justify-center p-4 bg-slate-100 dark:bg-slate-800/50 rounded-lg shadow-lg"
        id={separatorId}
      >
        <h3 class="text-lg">{item.location}</h3>
        {#if item.city}
          <p class="text-sm text-muted-foreground mt-1">{item.city}</p>
        {/if}
      </div>
    {/if}
  {/if}
{/each}
