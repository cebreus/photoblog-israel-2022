<script lang="ts">
  import type { ImageEntry } from "$lib/types/manifest";
  import * as Dialog from "$lib/components/ui/dialog";
  import { Button } from "$lib/components/ui/button";

  interface MetadataField {
    key: string;
    label: string;
    original: string;
    updated: string;
    enabled: boolean;
  }

  let {
    open = $bindable(false),
    images,
    sourceImage,
    clipboardData,
    isApplying = false,
    onConfirm,
  }: {
    open: boolean;
    images: ImageEntry[];
    sourceImage: ImageEntry;
    clipboardData: Record<string, any>;
    isApplying?: boolean;
    onConfirm: (fieldsToApply: Record<string, boolean>) => void;
  } = $props();

  let fields = $derived.by(() => {
    const result: MetadataField[] = [
      {
        key: "title",
        label: "Název",
        original: images[0]?.exif?.title || "-",
        updated: clipboardData.title || "-",
        enabled: true,
      },
      {
        key: "author",
        label: "Autor",
        original: images[0]?.author || "-",
        updated: clipboardData.author || "-",
        enabled: true,
      },
      {
        key: "location",
        label: "Místo",
        original: images[0]?.location || "-",
        updated: clipboardData.location || "-",
        enabled: true,
      },
      {
        key: "city",
        label: "Město",
        original: images[0]?.city || "-",
        updated: clipboardData.city || "-",
        enabled: true,
      },
      {
        key: "state",
        label: "Stát / Provincie",
        original: images[0]?.exif?.state || "-",
        updated: clipboardData.state || "-",
        enabled: true,
      },
      {
        key: "country",
        label: "Země",
        original: images[0]?.exif?.country || "-",
        updated: clipboardData.country || "-",
        enabled: true,
      },
      {
        key: "countryCode",
        label: "Kód země",
        original: images[0]?.exif?.countryCode || "-",
        updated: clipboardData.countryCode || "-",
        enabled: true,
      },
      {
        key: "caption",
        label: "Popisek",
        original: images[0]?.caption || "-",
        updated: clipboardData.caption || "-",
        enabled: true,
      },
      {
        key: "keywords",
        label: "Klíčová slova",
        original: images[0]?.keywords?.join(", ") || "-",
        updated:
          (Array.isArray(clipboardData.keywords)
            ? clipboardData.keywords.join(", ")
            : clipboardData.keywords) || "-",
        enabled: true,
      },
    ];
    return result;
  });

  function handleConfirm() {
    const fieldsToApply: Record<string, boolean> = {};
    fields.forEach((field) => {
      fieldsToApply[field.key] = field.enabled;
    });
    onConfirm(fieldsToApply);
  }
</script>

<Dialog.Root bind:open>
  <Dialog.Content class="max-w-2xl max-h-[80vh] flex flex-col">
    <Dialog.Header>
      <Dialog.Title>Vložit metadata</Dialog.Title>
      <Dialog.Description>
        Vyberte metadata, která chcete vložit do {images.length === 1
          ? "obrázku"
          : `${images.length} obrázků`}
      </Dialog.Description>
    </Dialog.Header>

    <div class="flex-1 overflow-y-auto">
      <table class="w-full text-sm">
        <thead class="sticky top-0 bg-muted">
          <tr>
            <th class="px-3 py-2 text-left font-semibold w-6"></th>
            <th class="px-3 py-2 text-left font-semibold">Metadata</th>
            <th class="px-3 py-2 text-left font-semibold">Původní hodnota</th>
            <th class="px-3 py-2 text-left font-semibold">Nová hodnota</th>
          </tr>
        </thead>
        <tbody>
          {#each fields as field, index}
            {@const isDifferent =
              field.original !== field.updated &&
              field.updated !== "-" &&
              field.original !== "-"}
            <tr
              class={`border-b ${isDifferent ? "bg-blue-50 dark:bg-blue-950/30" : ""}`}
            >
              <td class="px-3 py-3">
                <input
                  type="checkbox"
                  bind:checked={field.enabled}
                  disabled={isApplying}
                  class="w-4 h-4"
                />
              </td>
              <td class="px-3 py-3 font-medium">{field.label}</td>
              <td class="px-3 py-3 font-mono text-xs text-muted-foreground">
                {field.original}
              </td>
              <td class="px-3 py-3 font-mono text-xs">
                {#if isDifferent}
                  <span class="text-blue-600 dark:text-blue-400 font-semibold">
                    {field.updated}
                  </span>
                {:else}
                  <span class="text-muted-foreground">{field.updated}</span>
                {/if}
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>

    <Dialog.Footer>
      <Button variant="outline" onclick={() => (open = false)}>Zrušit</Button>
      <Button onclick={handleConfirm} disabled={isApplying}>
        {isApplying ? "Vkládám..." : "Vložit metadata"}
      </Button>
    </Dialog.Footer>
  </Dialog.Content>
</Dialog.Root>
