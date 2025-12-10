<script lang="ts">
  import { page } from "$app/stores";
  import * as Offcanvas from "$lib/components/offcanvas";
  import { Button } from "$lib/components/ui/button";
  import { Input } from "$lib/components/ui/input";
  import { Textarea } from "$lib/components/ui/textarea";
  import { Badge } from "$lib/components/ui/badge";
  import * as Form from "$lib/components/ui/form";
  import type { ImageEntry, Separator } from "$lib/types/manifest";
  import { toast } from "svelte-sonner";
  import { Pencil, X, Trash2 } from "lucide-svelte";
  import { selection, editMode } from "$lib/stores/editorState";
  import { superForm } from "sveltekit-superforms";

  type DisplayItem = ImageEntry | Separator;

  let { items = [] } = $props<{ items: DisplayItem[] }>();

  let isOpen = $state(false);

  // Manual initial data (replaces Schema)
  const initialData = {
    title: "",
    author: "",
    location: "",
    city: "",
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
    // Reset explicit clears when repopulating
    explicitClears = {};
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
    const commonLocationValue = getCommon((i) => i.location); // Using i.location as per ImageEntry interface
    const commonCityValue = getCommon((i) => i.city);
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
                title="Smazat hodnotu"
              >
                <Trash2 class="size-4" />
              </Button>
            </div>
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
                title="Smazat hodnotu"
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
        class="flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2 mt-6"
      >
        <Button type="submit">Uložit změny</Button>
      </div>
    </form>
  </Offcanvas.Content>
</Offcanvas.Root>
